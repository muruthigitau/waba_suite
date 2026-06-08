import frappe
from frappe import _


@frappe.whitelist()
def create(contact_name, mobile_no, email, whatsapp_account=None):
	contact = frappe.get_doc(
		{
			"doctype": "WhatsApp Contact",
			"contact_name": contact_name,
			"mobile_no": mobile_no,
			"email": email,
		}
	)
	contact.save(ignore_permissions=True)
	return contact.name


@frappe.whitelist()
def get(email, whatsapp_account=None):
	if not whatsapp_account:
		whatsapp_account = frappe.db.get_single_value("WhatsApp Settings", "default_incoming_account")

	if not whatsapp_account:
		return []

	message_rows = frappe.get_all(
		"WhatsApp Message",
		filters={"whatsapp_account": whatsapp_account},
		fields=["whatsapp_contact"],
	)

	contact_names = list(set([m.whatsapp_contact for m in message_rows if m.whatsapp_contact]))

	if not contact_names:
		return []

	contacts = frappe.get_all(
		"WhatsApp Contact",
		filters={"name": ["in", contact_names]},
		fields=[
			"name",
			"contact_name",
			"mobile_no",
			"last_message",
			"is_read",
		],
	)

	for contact in contacts:
		last_message = frappe.get_all(
			"WhatsApp Message",
			filters={
				"whatsapp_contact": contact.name,
				"whatsapp_account": whatsapp_account,
			},
			fields=[
				"name",
				"message",
				"type",
				"status",
				"creation",
				"whatsapp_account",
				"to",
				"from",
			],
			order_by="creation desc",
			limit=1,
		)

		contact["last_message"] = last_message[0] if last_message else None

		unread_count = frappe.db.count(
			"WhatsApp Message",
			filters={
				"whatsapp_contact": contact.name,
				"whatsapp_account": whatsapp_account,
				"type": "Incoming",
				"status": "draft",
			},
		)

		contact["unread_incoming"] = unread_count

	contacts.sort(
		key=lambda x: x.get("last_message", {}).get("creation") if x.get("last_message") else "",
		reverse=True,
	)

	return contacts
