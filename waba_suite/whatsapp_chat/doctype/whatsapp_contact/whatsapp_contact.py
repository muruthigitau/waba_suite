import frappe
from frappe.model.document import Document

from waba_suite.utils import format_number


class WhatsAppContact(Document):
	def after_insert(self):
		if self.email:
			frappe.publish_realtime(
				"new_room_creation",
				{"user": self.email, "room_name": self.contact_name or self.mobile_no},
				user=self.email,
			)

	def validate(self):
		if self.mobile_no and not self.contact_name:
			self.contact_name = self.mobile_no

		if self.mobile_no:
			formatted_num = format_number(self.mobile_no)

			if not self.whatsapp_profile:
				profile_name = frappe.db.get_value("WhatsApp Profiles", {"number": formatted_num}, "name")
				if profile_name:
					self.whatsapp_profile = profile_name

			if not self.contact:
				erpnext_contact = frappe.db.get_value(
					"Contact Phone", {"phone": ["like", f"%{formatted_num}%"]}, "parent"
				)
				if erpnext_contact:
					self.contact = erpnext_contact

			if self.whatsapp_profile and self.contact:
				frappe.db.set_value("WhatsApp Profiles", self.whatsapp_profile, "contact", self.contact)
