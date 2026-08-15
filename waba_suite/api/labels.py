"""Chat Labels API for WhatsApp.

Provides whitelisted endpoints to manage WhatsApp Chat Labels and their
assignment to WhatsApp Contacts (chats), enabling filtering in the React app.
"""

import frappe
from frappe import _


@frappe.whitelist()
def get_all():
    """List all enabled WhatsApp Chat Labels for the picker/filter.

    Returns:
        List of label dicts with name, label_name, color, description.
    """
    labels = frappe.get_all(
        "WhatsApp Chat Label",
        filters={"disabled": 0},
        fields=["name", "label_name", "color", "description"],
        order_by="label_name asc",
    )
    return labels


@frappe.whitelist()
def get_for_contact(whatsapp_contact):
    """Get the labels assigned to a specific WhatsApp Contact.

    Args:
        whatsapp_contact: WhatsApp Contact document name.

    Returns:
        List of label dicts with name, label_name, color.
    """
    if not whatsapp_contact:
        return []

    assignments = frappe.get_all(
        "WhatsApp Chat Label Assignment",
        filters={"whatsapp_contact": whatsapp_contact},
        fields=["whatsapp_chat_label"],
    )
    label_names = [a.whatsapp_chat_label for a in assignments if a.whatsapp_chat_label]
    if not label_names:
        return []

    labels = frappe.get_all(
        "WhatsApp Chat Label",
        filters={"name": ["in", label_names], "disabled": 0},
        fields=["name", "label_name", "color"],
    )
    return labels


@frappe.whitelist()
def set_assignments(whatsapp_contact, label_ids):
    """Set the full set of label assignments for a contact.

    Removes any existing assignments not in label_ids, and creates new ones
    for label_ids not already assigned.

    Args:
        whatsapp_contact: WhatsApp Contact document name.
        label_ids: JSON array (or comma string) of WhatsApp Chat Label names.

    Returns:
        Dict with status and the updated list of label dicts.
    """
    if not whatsapp_contact:
        frappe.throw(_("WhatsApp Contact is required"))

    import json

    if isinstance(label_ids, str):
        try:
            label_ids = json.loads(label_ids)
        except (json.JSONDecodeError, TypeError):
            label_ids = [x.strip() for x in label_ids.split(",") if x.strip()]
    label_ids = list(dict.fromkeys(label_ids or []))

    # Remove assignments not in the new list
    existing = frappe.get_all(
        "WhatsApp Chat Label Assignment",
        filters={"whatsapp_contact": whatsapp_contact},
        fields=["name", "whatsapp_chat_label"],
    )
    existing_map = {e.whatsapp_chat_label: e.name for e in existing}

    for label_name, assignment_name in existing_map.items():
        if label_name not in label_ids:
            frappe.delete_doc("WhatsApp Chat Label Assignment", assignment_name, force=1)

    # Create new assignments for the labels in the list
    for label_name in label_ids:
        if label_name not in existing_map:
            frappe.get_doc(
                {
                    "doctype": "WhatsApp Chat Label Assignment",
                    "whatsapp_contact": whatsapp_contact,
                    "whatsapp_chat_label": label_name,
                }
            ).insert(ignore_permissions=True)

    return {
        "status": "ok",
        "labels": get_for_contact(whatsapp_contact),
    }