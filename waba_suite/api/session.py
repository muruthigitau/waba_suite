"""Advanced WhatsApp Session management.

Maintains exactly one WhatsApp Session per contact per account, and keeps the
session status in sync with the WhatsApp 24-hour customer-service window:

  - Active  : the contact messaged us within the last 24h (or we are within
              the window).
  - Expired : the window has elapsed (no interaction for 24h).
  - Ended   : the contact explicitly ended the conversation (e.g. "stop").

The single session per contact+account is reused and simply re-activated /
re-statused on each interaction, rather than creating duplicate records.

Key dependencies:
    - frappe
    - waba_suite.api.contacts: window constant
"""

import frappe
from datetime import timedelta

from waba_suite.api.contact_helpers import CUSTOMER_SERVICE_WINDOW_HOURS

# Commands a recipient can send to end the conversation.
END_COMMANDS = {"stop", "end", "close", "unsubscribe", "unsub", "resign"}


def get_or_create_session(mobile_no, whatsapp_account, whatsapp_contact=None):
    """Return the single session for a contact+account, creating if needed.

    Guarantees one session row per (whatsapp_contact, whatsapp_account). If a
    session already exists (Active, Expired, or Ended) it is reused and its
    status is reconciled with the current window before returning.

    Args:
        mobile_no: The contact's phone number.
        whatsapp_account: The WhatsApp Account name.
        whatsapp_contact: Optional WhatsApp Contact name (resolved if omitted).

    Returns:
        The WhatsApp Session document.
    """
    if not whatsapp_contact and mobile_no:
        whatsapp_contact = frappe.db.get_value(
            "WhatsApp Contact", {"mobile_no": mobile_no}, "name"
        )

    now = frappe.utils.now_datetime()

    session_name = frappe.db.get_value(
        "WhatsApp Session",
        {
            "whatsapp_contact": whatsapp_contact,
            "whatsapp_account": whatsapp_account,
        },
        "name",
        order_by="creation desc",
    )

    if session_name:
        session = frappe.get_doc("WhatsApp Session", session_name)
        # Reconcile Expired based on window
        if (
            session.status == "Active"
            and session.expires_at
            and now > session.expires_at
        ):
            session.db_set("status", "Expired", update_modified=False)
        if not session.phone and mobile_no:
            session.db_set("phone", mobile_no, update_modified=False)
        return session

    # Create a fresh session — default Expired until the contact interacts.
    session = frappe.get_doc(
        {
            "doctype": "WhatsApp Session",
            "phone": mobile_no,
            "whatsapp_contact": whatsapp_contact,
            "whatsapp_account": whatsapp_account,
            "status": "Expired",
            "started_at": now,
            "last_interaction": now,
            "expires_at": now,  # expired until they contact us
            "temp_data": "{}",
        }
    )
    session.insert(ignore_permissions=True)
    frappe.db.commit()
    return session


def activate_session(mobile_no, whatsapp_account, whatsapp_contact=None, ended=False):
    """Mark the session Active (within window) or Ended on incoming message.

    Args:
        mobile_no: The contact's phone number.
        whatsapp_account: The WhatsApp Account name.
        whatsapp_contact: Optional WhatsApp Contact name.
        ended: True if the recipient explicitly ended the conversation.

    Returns:
        The session name.
    """
    session = get_or_create_session(mobile_no, whatsapp_account, whatsapp_contact)
    now = frappe.utils.now_datetime()

    if ended:
        session.db_set(
            {"status": "Ended", "last_interaction": now, "expires_at": now},
            update_modified=False,
        )
    else:
        session.db_set(
            {
                "status": "Active",
                "last_interaction": now,
                "expires_at": now + timedelta(hours=CUSTOMER_SERVICE_WINDOW_HOURS),
            },
            update_modified=False,
        )

    frappe.db.commit()
    return session.name


def expire_outdated_sessions():
    """Scheduled job: mark Active sessions as Expired once the window elapses."""
    now = frappe.utils.now_datetime()
    session_names = frappe.get_all(
        "WhatsApp Session",
        filters={"status": "Active", "expires_at": ["<", now]},
        fields=["name"],
    )
    for s in session_names:
        frappe.db.set_value(
            "WhatsApp Session", s.name, "status", "Expired", update_modified=False
        )
    if session_names:
        frappe.db.commit()
    return len(session_names)


def get_session_status(mobile_no, whatsapp_account):
    """Return the current session status + window flag for a contact/account."""
    session = get_or_create_session(mobile_no, whatsapp_account)
    return {
        "session": session.name,
        "status": session.status,
        "expires_at": str(session.expires_at) if session.expires_at else None,
        "last_interaction": (
            str(session.last_interaction) if session.last_interaction else None
        ),
        "within_24h_window": session.status == "Active",
    }


def on_whatsapp_message_after_insert(doc, method=None):
    """Doc event hook: update the session when an incoming message is stored.

    Runs after a WhatsApp Message is inserted. Outgoing/template messages are
    ignored for status (they do not open a customer window).

    Args:
        doc: The WhatsApp Message document.
        method: Unused (frappe hook signature).
    """
    try:
        if doc.get("type") != "Incoming":
            return

        whatsapp_account = doc.get("whatsapp_account")
        if not whatsapp_account:
            return

        mobile_no = doc.get("from")
        whatsapp_contact = doc.get("whatsapp_contact")
        if not whatsapp_contact and mobile_no:
            whatsapp_contact = frappe.db.get_value(
                "WhatsApp Contact", {"mobile_no": mobile_no}, "name"
            )

        if not whatsapp_contact:
            # No contact record yet; message creation will have created one in
            # most flows, but guard anyway.
            return

        text = (doc.get("message") or "").strip().lower()
        ended = text in END_COMMANDS

        activate_session(
            mobile_no=mobile_no,
            whatsapp_account=whatsapp_account,
            whatsapp_contact=whatsapp_contact,
            ended=ended,
        )
    except Exception:
        frappe.log_error(
            title="WhatsApp Session Hook Error",
            message=frappe.get_traceback(),
            reference_doctype="WhatsApp Message",
            reference_name=doc.get("name"),
        )