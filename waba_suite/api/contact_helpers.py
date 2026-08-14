"""Shared contact helpers.

Contains the 24-hour customer-service-window constant and the contact payload
builder used by contacts.py, message.py, and session.py.

Key dependencies:
    - frappe
"""

import frappe

# WhatsApp allows businesses to send free-form messages (text/media/reactions)
# only within a 24-hour customer service window. Outside that window, only
# approved template messages may be delivered.
CUSTOMER_SERVICE_WINDOW_HOURS = 24


def get_session(contact_name, whatsapp_account=None):
    """Return the single WhatsApp Session for a contact+account, if any.

    Args:
        contact_name: WhatsApp Contact document name.
        whatsapp_account: WhatsApp account to scope the session.

    Returns:
        The WhatsApp Session document, or None.
    """
    if not contact_name or not whatsapp_account:
        return None
    session_name = frappe.db.get_value(
        "WhatsApp Session",
        {
            "whatsapp_contact": contact_name,
            "whatsapp_account": whatsapp_account,
        },
        "name",
        order_by="creation desc",
    )
    if not session_name:
        return None
    try:
        return frappe.get_doc("WhatsApp Session", session_name)
    except Exception:
        return None


def is_session_expired(session):
    """Return True if a session is explicitly Expired/Ended or past expiry.

    A session is considered expired when status is Expired/Ended, or when an
    Active session's expires_at (message datetime + 24h) has elapsed.

    Args:
        session: WhatsApp Session document or None.

    Returns:
        True if the session is expired, else False.
    """
    if not session:
        return True
    if session.status in ("Expired", "Ended"):
        return True
    if session.status == "Active" and session.expires_at:
        exp = session.expires_at
        if isinstance(exp, str):
            exp = frappe.utils.get_datetime(exp)
        if exp and frappe.utils.now_datetime() > exp:
            return True
    return False


def contact_payload(contact_name, whatsapp_account=None):
    """Build a contact payload with chat existence and session/expiry info.

    The session window is anchored on the single WhatsApp Session for the
    contact+account. A contact has no chat until the first message exists.

    Args:
        contact_name: WhatsApp Contact document name.
        whatsapp_account: Optional WhatsApp account to scope the session check.

    Returns:
        Dict with name, contact_name, mobile_no, has_chat, session status,
        session expiry, and whether the session is expired.
    """
    contact = frappe.get_doc("WhatsApp Contact", contact_name)

    has_chat = bool(
        frappe.db.exists(
            "WhatsApp Message",
            {"whatsapp_contact": contact.name, "whatsapp_account": whatsapp_account},
        )
    )

    session = get_session(contact.name, whatsapp_account)
    session_status = session.status if session else None
    session_expires_at = session.expires_at if session else None

    return {
        "name": contact.name,
        "contact_name": contact.contact_name or contact.mobile_no,
        "mobile_no": contact.mobile_no,
        "has_chat": has_chat,
        "session_status": session_status,
        "session_expires_at": (
            str(session_expires_at) if session_expires_at else None
        ),
        "is_session_expired": is_session_expired(session),
    }
