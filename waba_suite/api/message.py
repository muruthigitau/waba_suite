"""Messages API for WhatsApp.

Provides endpoints to retrieve, send, and manage WhatsApp messages
including template messages, read receipts, and reactions.

Key dependencies:
    - frappe: ERPNext framework
    - waba_suite.api.message_utils: Internal message processing utilities
"""

import json
import mimetypes

import frappe

from waba_suite.api.message_utils import (
    resolve_template_message,
    send_whatsapp_read_receipts_sync,
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
        Each message includes content, content_type, sender info, and
        optionally template data and reactions.
    """
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
                try:
                    parent_id = msg.get("reply_to_message")
                    if parent_id:
                        if parent_id not in reactions_dict:
                            reactions_dict[parent_id] = []
                        reactions_dict[parent_id].append(
                            {
                                "emoji": msg.get("message", "👍"),
                                "sender": msg.get("to")
                                or msg.get("from", "Administrator"),
                                "message_id": msg.get("name"),
                            }
                        )
                except Exception:
                    pass
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

            if msg.get("to"):
                msg["sender_user_no"] = msg.get("to")
            else:
                msg["sender_user_no"] = "Administrator"

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
        frappe.log_error(
            title="WhatsApp get_all Error", message=frappe.get_traceback()
        )
        return []


@frappe.whitelist()
def mark_as_read(room, whatsapp_account=None):
    """Mark all incoming messages in a room as read.

    Updates the contact's is_read flag and sends read receipts
    for unread incoming messages.

    Args:
        room: WhatsApp Contact name.
        whatsapp_account: Optional WhatsApp account identifier.

    Returns:
        "ok" on success, "error" on failure.
    """
    try:
        frappe.db.set_value(
            "WhatsApp Contact", room, "is_read", 1, update_modified=False
        )
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

    Creates a WhatsApp Message document with the specified content
    and attachment, determining the content type from the file if needed.

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
        Dict with status and message_id on success, or status and error on failure.
    """
    try:
        if not content_type:
            content_type = "text"
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
    """Detect content type from file MIME type.

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
        for t in [
            "application/pdf",
            "msword",
            "vnd.ms-excel",
            "officedocument",
        ]
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

    Resolves template variables from a source document and creates
    a WhatsApp Message document with the template data.

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
    if not template:
        frappe.throw("Template is required")
    source_doc = None
    if reference_doctype and reference_name:
        source_doc = frappe.get_doc(reference_doctype, reference_name)
    template_doc = frappe.get_doc("WhatsApp Templates", template)
    file_url = None
    if template_doc.header_type == "DOCUMENT" and source_doc:
        file_url = _generate_document_file(source_doc, print_format)

    overrides = {}
    if variable_overrides:
        try:
            overrides = json.loads(variable_overrides)
        except Exception:
            pass

    _re = __import__("re")
    variables = template_doc.get("variables") or []
    header_map, body_map, footer_map = _build_variable_maps(
        variables, source_doc, overrides
    )

    def build_params(pm, expected):
        si = sorted(pm.items(), key=lambda x: x[1][0])
        r = [{"type": "text", "text": v} for _, (_, v) in si]
        if expected > 0:
            r = r[:expected]
        return r

    hp = build_params(
        header_map,
        len(_re.findall(r"\{\{(\d+)\}\}", template_doc.get("header") or "")),
    )
    bp = build_params(
        body_map,
        len(_re.findall(r"\{\{(\d+)\}\}", template_doc.get("template") or "")),
    )
    fp = build_params(
        footer_map,
        len(_re.findall(r"\{\{(\d+)\}\}", template_doc.get("footer") or "")),
    )

    bv = [p["text"] for p in bp]
    hv = hp[0]["text"] if hp else ""
    message_data = json.dumps(
        {
            "template_name": template,
            "body_values": bv,
            "header": (
                {"type": "TEXT", "text": hv}
                if hp
                else (
                    {
                        "type": "DOCUMENT",
                        "filename": file_url.split("/")[-1],
                        "url": file_url,
                    }
                    if file_url
                    else {}
                )
            ),
            "buttons": [],
        },
        indent=2,
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
        {
            "reference_doctype": reference_doctype,
            "reference_name": reference_name,
        },
    )
    frappe.db.commit()
    return doc.name


def _build_variable_maps(variables, source_doc, overrides):
    """Build variable maps for header, body, and footer sections.

    Args:
        variables: List of template variable child table rows.
        source_doc: Source document for field resolution.
        overrides: Dict of variable index -> value overrides.

    Returns:
        Tuple of (header_map, body_map, footer_map) dicts.
    """
    header_map = {}
    body_map = {}
    footer_map = {}

    for var in variables:
        value = "-"
        if var.source_type == "DocField" and source_doc:
            value = source_doc.get(var.field_name) or "-"
        elif var.source_type == "Static":
            value = var.static_value or "-"
        elif var.source_type == "Computed" and source_doc:
            ctx = {
                "doc": source_doc,
                "get_url": frappe.utils.get_url,
                "fmt_money": frappe.utils.fmt_money,
                "format_date": frappe.utils.formatdate,
            }
            try:
                value = str(eval(var.expression, {"__builtins__": {}}, ctx))
            except Exception:
                value = "-"
        if value in [None, "", "None"]:
            value = "-"
        value = str(value)
        var_type = (var.type or "Body").strip().lower()
        var_index = var.get("index") or 0
        if str(var_index) in overrides:
            value = overrides[str(var_index)]

        key = None
        if var.source_type == "DocField" and var.field_name:
            key = (var_type, "DocField", var.field_name)
        elif var.source_type == "Static" and var.static_value:
            key = (var_type, "Static", var.static_value)
        elif var.source_type == "Computed" and var.expression:
            key = (var_type, "Computed", var.expression)
        if key:
            tm = body_map
            if var_type == "header":
                tm = header_map
            elif var_type == "footer":
                tm = footer_map
            if key not in tm:
                tm[key] = (var_index, value)

    return header_map, body_map, footer_map


def _generate_document_file(source_doc, print_format):
    """Generate a PDF document file from a source document.

    Args:
        source_doc: Source document to print.
        print_format: Print format name.

    Returns:
        Public URL of the generated file, or None.
    """
    pdf = frappe.attach_print(
        doctype=source_doc.doctype,
        name=source_doc.name,
        doc=source_doc,
        print_format=print_format,
    )
    fn = pdf.get("fname", f"{source_doc.name}.pdf")
    fc = pdf.get("fcontent")
    if fc:
        fd = frappe.get_doc(
            {
                "doctype": "File",
                "file_name": fn,
                "content": fc,
                "attached_to_doctype": source_doc.doctype,
                "attached_to_name": source_doc.name,
                "is_private": 0,
            }
        ).insert(ignore_permissions=True)
        return frappe.utils.get_url(fd.file_url)
    return None


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