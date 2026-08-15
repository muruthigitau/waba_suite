"""Messages API for WhatsApp.

Provides whitelisted endpoints to retrieve, send, and manage WhatsApp
messages including template messages, read receipts, and reactions.

Key dependencies:
    - frappe
    - waba_suite.api.message_utils: Internal message processing utilities
    - waba_suite.api.message_templates: Template payload builders
    - waba_suite.api.contact_helpers: Shared window constant
"""

import json
import mimetypes
from datetime import timedelta

import frappe

from waba_suite.api.message_utils import (
    resolve_template_message,
    send_whatsapp_read_receipts_sync,
)
from waba_suite.api.message_templates import build_template_message_data
from waba_suite.api.contact_helpers import (
    CUSTOMER_SERVICE_WINDOW_HOURS,
    require_whatsapp_access,
)


@frappe.whitelist()
def get_all(room, user_no, whatsapp_account=None):
    """Retrieve all messages for a chat room.

    Fetches messages where the user number appears in either the 'to' or 'from'
    field, processes template messages with variable resolution, and aggregates
    reactions.

    Args:
        room: WhatsApp Contact name (room identifier).
        user_no: User's phone number for message filtering.
        whatsapp_account: Optional filter for a specific WhatsApp account.

    Returns:
        List of message dicts sorted by creation date (ascending).
    """
    require_whatsapp_access()
    try:
        filters = {
            "to": ["in", [user_no, ""]],
            "from": ["in", [user_no, ""]],
        }
        if whatsapp_account:
            filters["whatsapp_account"] = whatsapp_account

        messages = frappe.get_all(
            "WhatsApp Message",
            filters=filters,
            fields="*",
            order_by="creation asc",
        )

        message_dict = {}
        reactions_dict = {}

        for msg in messages:
            if msg.get("content_type") == "reaction":
                parent_id = msg.get("reply_to_message")
                if parent_id:
                    reactions_dict.setdefault(parent_id, []).append(
                        {
                            "emoji": msg.get("message", "👍"),
                            "sender": msg.get("to") or msg.get("from", "Administrator"),
                            "message_id": msg.get("name"),
                        }
                    )
                continue

            if msg.get("message_type") == "Template":
                msg["content"] = msg.get("message", "")
                msg["content_type"] = "template"
                msg["caption"] = None
            elif msg.get("content_type") == "text":
                msg["content"] = msg.get("message", "")
                msg["caption"] = None
            else:
                msg["content"] = msg.get("attach", msg.get("message", ""))
                msg["caption"] = (
                    msg.get("message") if msg.get("content_type") != "text" else None
                )

            msg["sender_user_no"] = msg.get("to") or "Administrator"

            if msg.get("message_type") == "Template":
                msg["template_name"] = msg.get("template")
                msg["is_template"] = True
                resolve_template_message(msg)
            else:
                msg["is_template"] = False

            message_dict[msg.get("name")] = msg

        for msg_id, reactions in reactions_dict.items():
            if msg_id in message_dict:
                reaction_counts = {}
                for reaction in reactions:
                    emoji = reaction.get("emoji")
                    if emoji:
                        reaction_counts[emoji] = reaction_counts.get(emoji, 0) + 1
                aggregated = [
                    {"emoji": e, "count": c} for e, c in reaction_counts.items()
                ]
                if aggregated:
                    message_dict[msg_id]["reactions"] = aggregated

        result = list(message_dict.values())
        result.sort(key=lambda x: x.get("creation", ""))
        return result
    except Exception:
        frappe.log_error(title="WhatsApp get_all Error", message=frappe.get_traceback())
        return []


@frappe.whitelist()
def mark_as_read(room, whatsapp_account=None):
    """Mark all incoming messages in a room as read.

    Updates the contact's is_read flag and sends read receipts for unread
    incoming messages.

    Args:
        room: WhatsApp Contact name.
        whatsapp_account: Optional WhatsApp account identifier.

    Returns:
        "ok" on success, "error" on failure.
    """
    require_whatsapp_access()
    try:
        frappe.db.set_value("WhatsApp Contact", room, "is_read", 1, update_modified=False)
        if whatsapp_account:
            contact = frappe.get_doc("WhatsApp Contact", room)
            if contact.mobile_no:
                frappe.db.set_value(
                    "WhatsApp Message",
                    {
                        "from": contact.mobile_no,
                        "type": "Incoming",
                        "status": ["not in", ["read", "marked_as_read"]],
                    },
                    "status",
                    "marked_as_read",
                )
        frappe.db.commit()
        send_whatsapp_read_receipts_sync(room, whatsapp_account)
        return "ok"
    except Exception:
        frappe.log_error(
            title=f"WhatsApp mark_as_read Error for {room}",
            message=frappe.get_traceback(),
        )
        return "error"


def is_within_24h_window(mobile_no):
    """Check whether a customer has messaged us within the 24h service window.

    WhatsApp only allows free-form messages (text, media, reactions, etc.) to
    be delivered to a recipient who has messaged us within the last 24 hours.
    Outside that window, only approved template messages may be sent.

    Args:
        mobile_no: The recipient's (or contact's) phone number.

    Returns:
        True if a free-form message may currently be delivered, else False.
    """
    if not mobile_no:
        return False

    last_incoming = frappe.db.get_value(
        "WhatsApp Message",
        {"from": mobile_no, "type": "Incoming"},
        "creation",
        order_by="creation desc",
    )
    if not last_incoming:
        return False

    now = frappe.utils.now_datetime()
    window_start = now - timedelta(hours=CUSTOMER_SERVICE_WINDOW_HOURS)
    last_incoming_dt = frappe.utils.get_datetime(last_incoming)
    return last_incoming_dt >= window_start


def ensure_can_send_direct(room):
    """Raise an exception if the contact is outside the 24h service window.

    Used by message.send to block free-form messages (text/files/reactions)
    that can't legally be delivered via WhatsApp outside the window.

    Args:
        room: WhatsApp Contact name.

    Raises:
        frappe.ValidationError if outside the 24h window.
    """
    contact = frappe.get_cached_doc("WhatsApp Contact", room)
    if not is_within_24h_window(contact.mobile_no):
        frappe.throw(
            "This contact is outside the 24-hour customer service window. "
            "Only template messages can be sent. Use the template button instead.",
            frappe.ValidationError,
        )


@frappe.whitelist()
def send(
    content,
    user,
    room,
    user_no,
    attachment=None,
    message_id=None,
    whatsapp_account=None,
    reply_to_message_id=None,
    content_type=None,
):
    """Send a WhatsApp message.

    Creates a WhatsApp Message document with the specified content and
    attachment, determining the content type from the file if needed.

    Args:
        content: Message text content.
        user: User identifier.
        room: WhatsApp Contact name.
        user_no: Recipient phone number.
        attachment: Optional file attachment URL or name.
        message_id: Optional message ID for replies.
        whatsapp_account: Optional WhatsApp account identifier.
        reply_to_message_id: Optional message ID being replied to.
        content_type: Optional content type override.

    Returns:
        Dict with status and message_id on success, or status and error.
    """
    require_whatsapp_access()
    try:
        if not content_type:
            content_type = "text"

        # Enforce the 24h window: reactions to an existing parent reference
        # check the parent's contact; everything else requires a direct window.
        if content_type in ("reaction",):
            parent = reply_to_message_id
            if parent:
                msg_doc = frappe.get_doc("WhatsApp Message", parent)
                if not is_within_24h_window(msg_doc.get("from") or msg_doc.get("to")):
                    frappe.throw(
                        "Reaction not allowed outside the 24-hour service window. "
                        "Only template messages can be sent.",
                        frappe.ValidationError,
                    )
            else:
                ensure_can_send_direct(room)
        else:
            ensure_can_send_direct(room)

        contact = frappe.get_doc("WhatsApp Contact", room)
        if attachment:
            content_type = _detect_content_type(content, content_type)
        msg_doc = frappe.get_doc(
            {
                "doctype": "WhatsApp Message",
                "to": user_no,
                "type": "Outgoing",
                "attach": attachment,
                "message": content,
                "content_type": content_type,
                "status": "sent",
                "whatsapp_account": whatsapp_account or contact.whatsapp_account,
                "reply_to_message": reply_to_message_id,
            }
        )
        msg_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return {"status": "ok", "message_id": msg_doc.name}
    except Exception:
        frappe.log_error(
            title=f"WhatsApp send Error for {user_no}",
            message=frappe.get_traceback(),
        )
        return {"status": "error", "message": str(frappe.get_traceback())}


def _detect_content_type(content, current_type):
    """Detect content type from a file's MIME type.

    Args:
        content: File content or URL to analyze.
        current_type: Current content type as fallback.

    Returns:
        Detected content type string.
    """
    ft = mimetypes.guess_type(content)[0] or ""
    if any(
        t in ft
        for t in [
            "image/apng",
            "image/avif",
            "image/gif",
            "image/jpeg",
            "image/png",
            "image/svg",
            "image/webp",
        ]
    ):
        return "image"
    if any(
        t in ft
        for t in ["application/pdf", "msword", "vnd.ms-excel", "officedocument"]
    ):
        return "document"
    if any(
        t in ft
        for t in ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"]
    ):
        return "audio"
    if any(t in ft for t in ["video/mp4", "video/3gp"]):
        return "video"
    return current_type


@frappe.whitelist()
def send_template(
    to,
    template,
    reference_doctype=None,
    reference_name=None,
    whatsapp_account=None,
    print_format=None,
    variable_overrides=None,
):
    """Send a WhatsApp template message.

    Resolves template variables from a source document and creates a WhatsApp
    Message document with the template data.

    Args:
        to: Recipient phone number.
        template: Name of the WhatsApp Templates doctype.
        reference_doctype: Optional source document type.
        reference_name: Optional source document name.
        whatsapp_account: Optional WhatsApp account identifier.
        print_format: Optional print format for document headers.
        variable_overrides: JSON dict of variable index -> value overrides.

    Returns:
        Name of the created WhatsApp Message document.
    """
    require_whatsapp_access()
    if not template:
        frappe.throw("Template is required")

    source_doc = None
    if reference_doctype and reference_name:
        source_doc = frappe.get_doc(reference_doctype, reference_name)
    template_doc = frappe.get_doc("WhatsApp Templates", template)

    message_data, file_url = build_template_message_data(
        template_doc, source_doc, print_format, variable_overrides
    )

    doc = frappe.get_doc(
        {
            "doctype": "WhatsApp Message",
            "to": to,
            "type": "Outgoing",
            "message": message_data,
            "content_type": "text",
            "message_type": "Template",
            "use_template": 1,
            "template": template,
            "print_format": print_format,
            "file_url": file_url,
            "whatsapp_account": whatsapp_account,
        }
    )
    doc.insert(ignore_permissions=True)
    frappe.db.set_value(
        "WhatsApp Message",
        doc.name,
        {"reference_doctype": reference_doctype, "reference_name": reference_name},
    )
    frappe.db.commit()
    return doc.name


@frappe.whitelist()
def mark_multiple_as_read(whatsapp_contact, whatsapp_account=None):
    """Mark multiple incoming messages as read for a contact.

    Sends read receipts for all unread incoming messages from a contact.

    Args:
        whatsapp_contact: WhatsApp Contact name.
        whatsapp_account: Optional WhatsApp account identifier.

    Returns:
        Dict with status and message count on success, or error on failure.
    """
    require_whatsapp_access()
    try:
        unread = frappe.get_all(
            "WhatsApp Message",
            filters={
                "from": frappe.db.get_value(
                    "WhatsApp Contact", whatsapp_contact, "mobile_no"
                ),
                "type": "Incoming",
                "status": ["not in", ["read", "marked_as_read"]],
                "whatsapp_account": whatsapp_account,
            },
            fields=["name"],
        )
        if not unread:
            return {"status": "error", "message": "No unread messages found"}
        marked = 0
        for mid in [m.name for m in unread]:
            try:
                d = frappe.get_doc("WhatsApp Message", mid)
                if d.type == "Incoming" and d.status not in [
                    "read",
                    "marked_as_read",
                ]:
                    d.send_read_receipt()
                    marked += 1
            except Exception:
                continue
        frappe.db.commit()
        return {"status": "success", "message": f"Marked {marked} messages as read"}
    except Exception as e:
        frappe.log_error(
            title="WhatsApp Mark Multiple As Read Error",
            message=f"{e!s}\n{frappe.get_traceback()}",
        )
        return {"status": "error", "message": str(e)}