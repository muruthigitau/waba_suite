# Copyright (c) 2022, Shridhar Patil and contributors
# For license information, please see license.txt

import json

import frappe
from frappe.model.document import Document


class WhatsAppNotificationLog(Document):
	def validate(self):
		if not self.meta_data:
			return

		meta_data = self.meta_data if isinstance(self.meta_data, dict) else json.loads(self.meta_data)

		phone_id = None
		wa_id = None
		message_id = None
		message_status = None

		for entry in meta_data.get("entry", []):
			for change in entry.get("changes", []):
				value = change.get("value", {})

				metadata = value.get("metadata", {})
				phone_id = metadata.get("phone_number_id")

				contacts = value.get("contacts", [])
				if contacts:
					wa_id = contacts[0].get("wa_id")

				statuses = value.get("statuses", [])
				if statuses:
					status_data = statuses[0]

					if not wa_id:
						wa_id = status_data.get("recipient_id")

					message_id = status_data.get("id")
					message_status = status_data.get("status")

		if phone_id:
			self.whatsapp_account = frappe.db.get_value(
				"WhatsApp Account",
				{"phone_id": phone_id},
				"name",
			)

		if wa_id:
			self.whatsapp_contact = frappe.db.get_value(
				"WhatsApp Contact",
				{"mobile_no": wa_id},
				"name",
			)

		if message_id:
			self.whatsapp_message = frappe.db.get_value(
				"WhatsApp Message",
				{"message_id": message_id},
				"name",
			)

			if self.whatsapp_message and message_status:
				frappe.db.set_value(
					"WhatsApp Message",
					self.whatsapp_message,
					"status",
					message_status,
					update_modified=False,
				)
