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
		frappe.throw(_("WhatsApp Account is required"))

	messages_with_account = frappe.get_all(
		"WhatsApp Message", filters={"whatsapp_account": whatsapp_account}, fields=["whatsapp_contact"]
	)

	contact_names = list(set([m.whatsapp_contact for m in messages_with_account if m.whatsapp_contact]))

	if not contact_names:
		return []

	contacts = frappe.get_all(
		"WhatsApp Contact",
		filters={"name": ["in", contact_names]},
		fields=["name", "contact_name", "mobile_no", "last_message", "is_read"],
	)

	for contact in contacts:
		contact["messages"] = frappe.get_all(
			"WhatsApp Message",
			filters={"whatsapp_contact": contact.name, "whatsapp_account": whatsapp_account},
			fields=["name", "message", "type", "status", "creation", "content_type", "message_id"],
			order_by="creation desc",
			limit=50,
		)

	return contacts
