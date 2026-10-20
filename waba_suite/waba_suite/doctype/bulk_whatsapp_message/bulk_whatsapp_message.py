# Bulk WhatsApp Messaging for WABA Suite
# bulk_whatsapp_messaging.py

import json

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import cint, get_datetime, now

# WhatsApp Message statuses considered successfully processed. Delivery and
# read receipts are terminal states for an outgoing message.
SUCCESS_STATUSES = {"sent", "delivered", "read", "success", "marked_as_read"}
READ_STATUSES = {"read", "marked_as_read"}
FAILED_STATUSES = {"failed"}
QUEUED_STATUSES = {"queued"}

# Add these files to your waba_suite app

# 1. First, create a new DocType for Bulk WhatsApp Messaging
# Save this as a Python file in your app's folder:
# waba_suite/waba_suite/doctype/bulk_whatsapp_message/bulk_whatsapp_message.py


class BulkWhatsAppMessage(Document):
	def autoname(self):
		self.name = make_autoname("BULK-WA-.YYYY.-.#####")

	def validate(self):
		# self.validate_message()
		self.validate_recipients()

	def validate_message(self):
		if not self.message_content:
			frappe.throw(_("Message content is required"))

	def validate_recipients(self):
		if not self.recipients and not self.recipient_list:
			frappe.throw(_("At least one recipient or a recipient list is required"))

		# If recipient list is provided, count recipients
		if self.recipient_type == "Recipient List" and self.recipient_list:
			recipient_count = frappe.db.count("WhatsApp Recipient", {"parent": self.recipient_list})
			if recipient_count == 0:
				frappe.throw(_("Selected recipient list has no recipients"))
			self.recipient_count = recipient_count
		# If individual recipients are provided
		elif self.recipients:
			self.recipient_count = len(self.recipients)

	def on_submit(self):
		self.db_set("status", "Queued")
		self.queue_messages()

	def queue_messages(self):
		"""Queue messages for sending"""
		if self.recipient_type == "Recipient List" and self.recipient_list:
			# Fetch recipients from the recipient list
			recipients = frappe.get_all(
				"WhatsApp Recipient",
				filters={"parent": self.recipient_list},
				fields=["mobile_number", "name", "recipient_name", "recipient_data"],
			)

			for recipient in recipients:
				frappe.enqueue_doc(
					self.doctype,
					self.name,
					"create_single_message",
					"long",
					4000,
					recipient=recipient,
				)
		else:
			# Use recipients from the current document
			for recipient in self.recipients:
				frappe.enqueue_doc(
					self.doctype,
					self.name,
					"create_single_message",
					"long",
					4000,
					recipient=recipient,
				)

	def create_single_message(self, recipient):
		"""Create a single message in the queue."""
		wa_message = frappe.new_doc("WhatsApp Message")
		wa_message.to = recipient.get("mobile_number")
		wa_message.message_type = "Text"
		wa_message.flags.custom_ref_doc = json.loads(recipient.get("recipient_data", "{}"))
		wa_message.bulk_message_reference = self.name
		if self.whatsapp_account:
			wa_message.whatsapp_account = self.whatsapp_account

		if self.use_template:
			wa_message.template = self.template
			wa_message.message_type = "Template"
			wa_message.use_template = self.use_template

			if recipient.get("recipient_data") and self.variable_type == "Unique":
				wa_message.body_param = recipient.get("recipient_data")
			elif self.template_variables and self.variable_type == "Common":
				wa_message.body_param = self.template_variables
				wa_message.message = self.get_common_body_values()
			if self.attach:
				wa_message.attach = self.attach

		wa_message.status = "Queued"
		try:
			wa_message.insert(ignore_permissions=True)
		except Exception:
			self.db_set("status", "Partially Failed")
		self.db_set("sent_count", cint(self.sent_count) + 1)
		if self.recipient_count == self.sent_count:
			self.db_set("status", "Completed")

	def get_common_body_values(self):
		"""Serialise common template variables for the WhatsApp Message sender.

		The WhatsApp Message template sender expects a JSON object in `message`
		and sends its `body_values` list as the template body parameters.

		Returns:
		    JSON string containing `{"body_values": [...]}`, or None when the
		    stored `template_variables` value is not a JSON array.
		"""
		try:
			values = json.loads(self.template_variables or "[]")
		except (TypeError, ValueError):
			frappe.log_error(
				f"Invalid template variables: {self.template_variables}",
				"WhatsApp Bulk Messaging",
			)
			return None
		if not isinstance(values, list):
			return None
		return json.dumps({"body_values": [str(value) for value in values if value is not None]})

	def retry_failed(self):
		"""Retry failed messages"""
		failed_messages = frappe.get_all(
			"WhatsApp Message",
			filters={"bulk_message_reference": self.name, "status": "Failed"},
			fields=["name"],
		)

		count = 0
		for msg in failed_messages:
			message_doc = frappe.get_doc("WhatsApp Message", msg.name)
			message_doc.status = "Queued"
			message_doc.save(ignore_permissions=True)
			count += 1

		frappe.msgprint(_("{0} messages have been requeued for sending").format(count))

	def get_progress(self):
		"""Aggregate per-status message counts for this bulk campaign.

		Counts every status encountered on linked `WhatsApp Message` rows so the
		UI can display the full delivery funnel. `sent` is the number of
		successfully processed messages and includes delivered/read receipts;
		delivered/read are also returned separately as a breakdown.

		Returns:
		    dict: total, sent, delivered, read, queued, pending, failed,
		    processed, percent and the raw per-status counts.
		"""
		total = cint(self.recipient_count)
		rows = frappe.get_all(
			"WhatsApp Message",
			filters={"bulk_message_reference": self.name},
			fields=["status", "count(name) as message_count"],
			group_by="status",
		)

		status_counts = {}
		for row in rows:
			status = (row.get("status") or "draft").strip().lower()
			status_counts[status] = status_counts.get(status, 0) + cint(row.get("message_count"))

		sent = sum(count for status, count in status_counts.items() if status in SUCCESS_STATUSES)
		read = sum(count for status, count in status_counts.items() if status in READ_STATUSES)
		failed = sum(count for status, count in status_counts.items() if status in FAILED_STATUSES)
		queued = sum(count for status, count in status_counts.items() if status in QUEUED_STATUSES)
		known_statuses = SUCCESS_STATUSES | FAILED_STATUSES | QUEUED_STATUSES
		pending = sum(count for status, count in status_counts.items() if status not in known_statuses)
		processed = sent + failed
		percent = min(100.0, processed / total * 100) if total else 0

		return {
			"total": total,
			"sent": sent,
			"delivered": status_counts.get("delivered", 0),
			"read": read,
			"failed": failed,
			"queued": queued,
			"pending": pending,
			"processed": processed,
			"percent": percent,
			"status_counts": status_counts,
		}
