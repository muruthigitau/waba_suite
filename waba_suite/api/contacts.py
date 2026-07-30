"""Contacts API for WhatsApp.

Provides endpoints to create and retrieve WhatsApp contacts with their
associated chat preferences and last message details.

Key dependencies:
    - frappe: ERPNext framework
    - waba_suite.utils: Utility functions for WhatsApp operations
"""

import frappe
from frappe import _


@frappe.whitelist()
def create(contact_name, mobile_no, email, whatsapp_account=None):
    """Create a new WhatsApp Contact.

    Args:
        contact_name: Display name for the contact.
        mobile_no: Phone number of the contact.
        email: Email address of the contact.
        whatsapp_account: Optional WhatsApp account identifier.

    Returns:
        Name (ID) of the created contact document.
    """
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
    """Retrieve WhatsApp contacts with their last message and preferences.

    Fetches contacts that have at least one WhatsApp Message, along with
    the current user's chat preferences (pin, star, archive status).

    Args:
        email: Not currently used; kept for API compatibility.
        whatsapp_account: Optional filter for a specific WhatsApp account.
            Falls back to the default incoming account if not provided.

    Returns:
        List of contact dicts sorted by last message creation date (newest first).
        Each contact includes: name, contact_name, mobile_no, last_message,
        is_read, profile_picture, unread_incoming count, and preference flags.
    """
    if not whatsapp_account:
        whatsapp_account = frappe.db.get_single_value(
            "WhatsApp Settings", "default_incoming_account"
        )

    if not whatsapp_account:
        return []

    message_rows = frappe.get_all(
        "WhatsApp Message",
        filters={"whatsapp_account": whatsapp_account},
        fields=["whatsapp_contact"],
    )

    contact_names = list(
        set([m.whatsapp_contact for m in message_rows if m.whatsapp_contact])
    )

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
            "profile_picture",
        ],
    )

    user = frappe.session.user
    prefs_list = frappe.get_all(
        "WhatsApp Chat Preference",
        filters={"user": user},
        fields=["whatsapp_contact", "is_pinned", "is_starred", "is_archived"],
    )
    prefs_map = {}
    for p in prefs_list:
        prefs_map[p.whatsapp_contact] = {
            "is_pinned": bool(p.is_pinned),
            "is_starred": bool(p.is_starred),
            "is_archived": bool(p.is_archived),
        }

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
                "use_template",
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

        pref = prefs_map.get(contact.name, {})
        contact["is_pinned"] = pref.get("is_pinned", False)
        contact["is_starred"] = pref.get("is_starred", False)
        contact["is_archived"] = pref.get("is_archived", False)
        contact["preference"] = prefs_list

    contacts.sort(
        key=lambda x: (
            x.get("last_message", {}).get("creation") if x.get("last_message") else ""
        ),
        reverse=True,
    )

    return contacts