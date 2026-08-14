"""Chat Preferences API for WhatsApp.

Provides endpoints to manage per-user chat preferences including
pin, star, and archive status for WhatsApp contacts.

Key dependencies:
    - frappe: ERPNext framework
"""

import json

import frappe
from frappe import _


@frappe.whitelist()
def get_preferences(user=None):
    """Get all chat preferences for a user.

    Args:
        user: Optional user identifier. Defaults to current session user.

    Returns:
        List of preference records with fields: name, user_contact_key,
        whatsapp_contact, whatsapp_contact_name, whatsapp_account, mobile_no,
        is_pinned, is_starred, is_archived, and timestamp fields.
    """
    if not user:
        user = frappe.session.user

    prefs = frappe.get_all(
        "WhatsApp Chat Preference",
        filters={"user": user},
        fields=[
            "name",
            "user_contact_key",
            "whatsapp_contact",
            "whatsapp_contact_name",
            "whatsapp_account",
            "mobile_no",
            "is_pinned",
            "is_starred",
            "is_archived",
            "pinned_at",
            "starred_at",
            "archived_at",
        ],
    )

    return prefs


@frappe.whitelist()
def set_preference(
    whatsapp_contact,
    mobile_no=None,
    contact_name=None,
    whatsapp_account=None,
    **kwargs,
):
    """Set chat preferences for a user+contact combination.

    Creates one record per user+contact. Supports flags: is_pinned (0/1),
    is_starred (0/1), is_archived (0/1). Updates existing record or creates new.

    Args:
        whatsapp_contact: Contact identifier.
        mobile_no: Optional phone number.
        contact_name: Optional display name.
        whatsapp_account: Optional WhatsApp account.
        **kwargs: Preference flags (is_pinned, is_starred, is_archived).

    Returns:
        Dict with status and current preference states.
    """
    user = frappe.session.user
    key = f"{user}_{whatsapp_contact}"
    existing = frappe.db.exists("WhatsApp Chat Preference", {"user_contact_key": key})
    now = frappe.utils.now()

    is_pinned = int(kwargs.get("is_pinned", 0)) if "is_pinned" in kwargs else None
    is_starred = int(kwargs.get("is_starred", 0)) if "is_starred" in kwargs else None
    is_archived = (
        int(kwargs.get("is_archived", 0)) if "is_archived" in kwargs else None
    )

    if existing:
        doc = frappe.get_doc("WhatsApp Chat Preference", existing)
        if is_pinned is not None:
            doc.is_pinned = is_pinned
            doc.pinned_at = now if is_pinned else None
        if is_starred is not None:
            doc.is_starred = is_starred
            doc.starred_at = now if is_starred else None
        if is_archived is not None:
            doc.is_archived = is_archived
            doc.archived_at = now if is_archived else None
        doc.save(ignore_permissions=True)
        return {
            "status": "ok",
            "is_pinned": bool(doc.is_pinned),
            "is_starred": bool(doc.is_starred),
            "is_archived": bool(doc.is_archived),
        }

    doc = frappe.get_doc(
        {
            "doctype": "WhatsApp Chat Preference",
            "user_contact_key": key,
            "user": user,
            "whatsapp_contact": whatsapp_contact,
            "whatsapp_contact_name": contact_name,
            "whatsapp_account": whatsapp_account,
            "mobile_no": mobile_no,
            "is_pinned": is_pinned if is_pinned is not None else 0,
            "is_starred": is_starred if is_starred is not None else 0,
            "is_archived": is_archived if is_archived is not None else 0,
            "pinned_at": now if is_pinned else None,
            "starred_at": now if is_starred else None,
            "archived_at": now if is_archived else None,
        }
    )
    doc.insert(ignore_permissions=True)
    return {
        "status": "ok",
        "is_pinned": bool(doc.is_pinned),
        "is_starred": bool(doc.is_starred),
        "is_archived": bool(doc.is_archived),
    }


@frappe.whitelist()
def toggle_pin(
    whatsapp_contact,
    mobile_no=None,
    contact_name=None,
    whatsapp_account=None,
):
    """Toggle pin status for a chat.

    Args:
        whatsapp_contact: Contact identifier.
        mobile_no: Optional phone number.
        contact_name: Optional display name.
        whatsapp_account: Optional WhatsApp account.

    Returns:
        Result from set_preference with toggled is_pinned value.
    """
    user = frappe.session.user
    key = f"{user}_{whatsapp_contact}"
    existing = frappe.db.exists("WhatsApp Chat Preference", {"user_contact_key": key})

    if existing:
        doc = frappe.get_doc("WhatsApp Chat Preference", existing)
        new_val = 0 if doc.is_pinned else 1
        return set_preference(
            whatsapp_contact=whatsapp_contact,
            mobile_no=mobile_no or doc.mobile_no,
            contact_name=contact_name or doc.whatsapp_contact_name,
            whatsapp_account=whatsapp_account or doc.whatsapp_account,
            is_pinned=new_val,
        )

    return set_preference(
        whatsapp_contact=whatsapp_contact,
        mobile_no=mobile_no,
        contact_name=contact_name,
        whatsapp_account=whatsapp_account,
        is_pinned=1,
    )


@frappe.whitelist()
def toggle_star(
    whatsapp_contact,
    mobile_no=None,
    contact_name=None,
    whatsapp_account=None,
):
    """Toggle star status for a chat.

    Args:
        whatsapp_contact: Contact identifier.
        mobile_no: Optional phone number.
        contact_name: Optional display name.
        whatsapp_account: Optional WhatsApp account.

    Returns:
        Result from set_preference with toggled is_starred value.
    """
    user = frappe.session.user
    key = f"{user}_{whatsapp_contact}"
    existing = frappe.db.exists("WhatsApp Chat Preference", {"user_contact_key": key})

    if existing:
        doc = frappe.get_doc("WhatsApp Chat Preference", existing)
        new_val = 0 if doc.is_starred else 1
        return set_preference(
            whatsapp_contact=whatsapp_contact,
            mobile_no=mobile_no or doc.mobile_no,
            contact_name=contact_name or doc.whatsapp_contact_name,
            whatsapp_account=whatsapp_account or doc.whatsapp_account,
            is_starred=new_val,
        )

    return set_preference(
        whatsapp_contact=whatsapp_contact,
        mobile_no=mobile_no,
        contact_name=contact_name,
        whatsapp_account=whatsapp_account,
        is_starred=1,
    )


@frappe.whitelist()
def toggle_archive(
    whatsapp_contact,
    mobile_no=None,
    contact_name=None,
    whatsapp_account=None,
):
    """Toggle archive status for a chat.

    Args:
        whatsapp_contact: Contact identifier.
        mobile_no: Optional phone number.
        contact_name: Optional display name.
        whatsapp_account: Optional WhatsApp account.

    Returns:
        Result from set_preference with toggled is_archived value.
    """
    user = frappe.session.user
    key = f"{user}_{whatsapp_contact}"
    existing = frappe.db.exists("WhatsApp Chat Preference", {"user_contact_key": key})

    if existing:
        doc = frappe.get_doc("WhatsApp Chat Preference", existing)
        new_val = 0 if doc.is_archived else 1
        return set_preference(
            whatsapp_contact=whatsapp_contact,
            mobile_no=mobile_no or doc.mobile_no,
            contact_name=contact_name or doc.whatsapp_contact_name,
            whatsapp_account=whatsapp_account or doc.whatsapp_account,
            is_archived=new_val,
        )

    return set_preference(
        whatsapp_contact=whatsapp_contact,
        mobile_no=mobile_no,
        contact_name=contact_name,
        whatsapp_account=whatsapp_account,
        is_archived=1,
    )


@frappe.whitelist()
def bulk_get(whatsapp_contacts, user=None):
    """Get preferences for multiple contacts at once.

    Args:
        whatsapp_contacts: JSON array of contact identifiers.
        user: Optional user identifier. Defaults to current session user.

    Returns:
        Dict mapping contact identifiers to their preference states.
    """
    if not user:
        user = frappe.session.user

    try:
        contacts = json.loads(whatsapp_contacts)
    except (json.JSONDecodeError, TypeError):
        return {}

    if not contacts:
        return {}

    prefs_list = frappe.get_all(
        "WhatsApp Chat Preference",
        filters={
            "user": user,
            "whatsapp_contact": ["in", contacts],
        },
        fields=["whatsapp_contact", "is_pinned", "is_starred", "is_archived"],
    )

    result = {}
    for p in prefs_list:
        result[p.whatsapp_contact] = {
            "is_pinned": bool(p.is_pinned),
            "is_starred": bool(p.is_starred),
            "is_archived": bool(p.is_archived),
        }
    return result