import json

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint


class WhatsAppRecipientList(Document):
	def validate(self):
		self.validate_recipients()

	def on_update(self):
		self.sync_draft_campaign_counts()

	def validate_recipients(self):
		if not self.is_new():
			if not self.recipients:
				frappe.throw(_("At least one recipient is required"))

	def sync_draft_campaign_counts(self):
		"""Refresh `recipient_count` on draft campaigns using this list.

		Draft campaigns read their recipient list at submit time, so their
		cached count must follow edits made here. Submitted campaigns keep the
		historical count they were queued with.
		"""
		count = frappe.db.count("WhatsApp Recipient", {"parent": self.name})
		campaigns = frappe.get_all(
			"Bulk WhatsApp Message",
			filters={
				"recipient_list": self.name,
				"recipient_type": "Recipient List",
				"docstatus": 0,
			},
			fields=["name", "recipient_count"],
		)
		for campaign in campaigns:
			if cint(campaign.recipient_count) == count:
				continue
			frappe.get_doc("Bulk WhatsApp Message", campaign.name).db_set(
				"recipient_count", count, notify=True
			)
	
	def import_list_from_doctype(self, doctype, mobile_field, name_field=None, filters=None, limit=None, data_fields=None):
		"""Import recipients from another DocType"""
		self.doctype_to_import = doctype
		self.mobile_field = mobile_field
		self.filters = filters
		if data_fields:
			self.data_fields = json.dumps(data_fields)

		if limit:
			self.import_limit = limit

		fields = [mobile_field]
		if name_field:
			fields.append(name_field)
		if data_fields:
			meta = frappe.get_meta(doctype)
			# print(meta.fields)
			for field in meta.fields:
				if field.fieldname not in fields and field.fieldname in data_fields:
					fields.append(field.fieldname)
		# Get records from the doctype
		records = frappe.get_all(
			doctype,
			filters=filters,
			fields=fields,
			limit=limit
		)
		
		# Clear existing recipients
		self.recipients = []
		
		# Add recipients
		for record in records:
			if not record.get(mobile_field):
				continue
				
			# Format mobile number
			mobile = record.get(mobile_field)
			# Remove any non-numeric characters except '+'
			mobile = ''.join(char for char in mobile if char.isdigit() or char == '+')
			
			if not mobile:
				continue

			recipient_data = {}
			if data_fields:
				for field in data_fields:
					if record.get(field):
						# Use field name as the variable name in recipient data
						variable_name = field.lower().replace(" ", "_")
						recipient_data[variable_name] = record.get(field)

				
			recipient = {
				"mobile_number": mobile,
				"recipient_data": json.dumps(recipient_data)
			}
			
			if name_field and record.get(name_field):
				recipient["recipient_name"] = record.get(name_field)
				
			self.append("recipients", recipient)
		
		return len(self.recipients)