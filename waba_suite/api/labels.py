"""Chat Labels API for WhatsApp.

Provides whitelisted endpoints to manage WhatsApp Chat Labels and their
assignment to WhatsApp Contacts (chats), enabling filtering in the React app.
"""

import frappe
from frappe import _

from waba_suite.api.contact_helpers import require_whatsapp_access


@frappe.whitelist()
def get_all():
    require_whatsapp_access()
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
def get_for_contact(whatsapp_contact, whatsapp_account=None):
    require_whatsapp_access()
    """Get the labels assigned to a specific WhatsApp Contact.

    Args:
        whatsapp_contact: WhatsApp Contact document name.
        whatsapp_account: Optional WhatsApp Account filter. If provided, only
            assignments scoped to that account are returned.

    Returns:
        List of label dicts with name, label_name, color.
    """
    if not whatsapp_contact:
        return []

    filters = {"whatsapp_contact": whatsapp_contact}
    if whatsapp_account:
        filters["whatsapp_account"] = whatsapp_account

    assignments = frappe.get_all(
        "WhatsApp Chat Label Assignment",
        filters=filters,
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
def set_assignments(whatsapp_contact, label_ids, whatsapp_account=None):
    require_whatsapp_access()
    """Set the full set of label assignments for a contact.

    Removes any existing assignments not in label_ids, and creates new ones
    for label_ids not already assigned. Assignments are scoped per WhatsApp
    Account.

    Args:
        whatsapp_contact: WhatsApp Contact document name.
        label_ids: JSON array (or comma string) of WhatsApp Chat Label names.
        whatsapp_account: Optional WhatsApp Account to scope the assignment.

    Returns:
        Dict with status and the updated list of label dicts.
    """
    if not whatsapp_contact:
        frappe.throw(_("WhatsApp Contact is required"))
    if not whatsapp_account:
        frappe.throw(_("WhatsApp Account is required"))

    import json

    if isinstance(label_ids, str):
        try:
            label_ids = json.loads(label_ids)
        except (json.JSONDecodeError, TypeError):
            label_ids = [x.strip() for x in label_ids.split(",") if x.strip()]
    label_ids = list(dict.fromkeys(label_ids or []))

    # Remove assignments not in the new list (for this contact + account)
    existing = frappe.get_all(
        "WhatsApp Chat Label Assignment",
        filters={
            "whatsapp_contact": whatsapp_contact,
            "whatsapp_account": whatsapp_account,
        },
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
                    "whatsapp_account": whatsapp_account,
                    "whatsapp_chat_label": label_name,
                }
            ).insert(ignore_permissions=True)

    return {
        "status": "ok",
        "labels": get_for_contact(whatsapp_contact, whatsapp_account),
    }
