"""Shared contact helpers.

Contains the 24-hour customer-service-window constant and the contact payload
builder used by contacts.py, message.py, and session.py.

Key dependencies:
    - frappe
"""

import frappe
from datetime import timedelta

# WhatsApp allows businesses to send free-form messages (text/media/reactions)
# only within a 24-hour customer service window. Outside that window, only
# approved template messages may be delivered.
CUSTOMER_SERVICE_WINDOW_HOURS = 24


def contact_payload(contact_name, whatsapp_account=None):
    """Build a contact payload with chat existence and 24h-window info.

    Args:
        contact_name: WhatsApp Contact document name.
        whatsapp_account: Optional WhatsApp account to scope the has-chat check.

    Returns:
        Dict with name, contact_name, mobile_no, has_chat, last incoming message
        timestamp, and whether the contact is inside the 24h window.
    """
    contact = frappe.get_doc("WhatsApp Contact", contact_name)

    last_incoming = frappe.db.get_value(
        "WhatsApp Message",
        {"from": contact.mobile_no, "type": "Incoming"},
        "creation",
        order_by="creation desc",
    )

    has_chat = bool(
        frappe.db.exists(
            "WhatsApp Message",
            {"whatsapp_contact": contact.name, "whatsapp_account": whatsapp_account},
        )
    )

    now = frappe.utils.now_datetime()
    within_window = False
    if last_incoming:
        last_incoming_dt = frappe.utils.get_datetime(last_incoming)
        window_start = now - timedelta(hours=CUSTOMER_SERVICE_WINDOW_HOURS)
        within_window = last_incoming_dt >= window_start

    return {
        "name": contact.name,
        "contact_name": contact.contact_name or contact.mobile_no,
        "mobile_no": contact.mobile_no,
        "has_chat": has_chat,
        "last_incoming_at": str(last_incoming) if last_incoming else None,
        "within_24h_window": within_window,
        "can_send_direct": within_window,
    }