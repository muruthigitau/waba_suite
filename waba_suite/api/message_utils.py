"""Message Utilities for WhatsApp API.

Internal helper functions for message processing, template resolution,
and read receipt handling.

Key dependencies:
    - frappe: ERPNext framework
    - json: JSON serialization for message data
"""

import json
import time

import frappe


def resolve_template_message(msg):
    """Resolve template message variables and fill placeholders.

    Parses the template message data, fetches the template document,
    and fills in header, body, and footer placeholders with actual values.

    Args:
        msg: Message dict to resolve (modified in place).
    """
    try:
        template_doc = frappe.get_doc("WhatsApp Templates", msg.get("template"))
        msg["template_header_raw"] = template_doc.get("header") or ""
        msg["template_body_raw"] = template_doc.get("template") or ""
        msg["template_footer_raw"] = template_doc.get("footer") or ""
        if msg.get("message"):
            try:
                msg_data = json.loads(msg["message"])
                if isinstance(msg_data, dict) and not msg_data.get("filled_body"):
                    bv = msg_data.get("body_values", [])
                    _re = __import__("re")
                    header_param = ""
                    hdr = msg_data.get("header")
                    if isinstance(hdr, dict):
                        header_param = hdr.get("text", "")
                    header_raw = template_doc.get("header") or ""
                    if header_raw:
                        filled_h = header_raw
                        for idx_str in sorted(
                            set(_re.findall(r"\{\{(\d+)\}\}", filled_h)), key=int
                        ):
                            filled_h = filled_h.replace(
                                "{{" + idx_str + "}}", header_param
                            )
                        msg_data["filled_header"] = filled_h
                    if template_doc.get("template") and bv:
                        filled = template_doc.get("template")
                        for idx_str in sorted(
                            set(_re.findall(r"\{\{(\d+)\}\}", filled)), key=int
                        ):
                            i = int(idx_str) - 1
                            if i < len(bv):
                                filled = filled.replace(
                                    "{{" + idx_str + "}}", bv[i]
                                )
                        msg_data["filled_body"] = filled
                    if template_doc.get("footer") and bv:
                        filled_f = template_doc.get("footer")
                        for idx_str in sorted(
                            set(_re.findall(r"\{\{(\d+)\}\}", filled_f)), key=int
                        ):
                            i = int(idx_str) - 1
                            if i < len(bv):
                                filled_f = filled_f.replace(
                                    "{{" + idx_str + "}}", bv[i]
                                )
                        msg_data["filled_footer"] = filled_f
                    msg["message"] = json.dumps(msg_data, indent=2)
            except Exception:
                pass
    except Exception:
        msg["template_header_raw"] = ""
        msg["template_body_raw"] = ""
        msg["template_footer_raw"] = ""


def send_whatsapp_read_receipts_sync(room, whatsapp_account=None):
    """Send read receipts for unread messages in a room.

    Args:
        room: WhatsApp Contact name.
        whatsapp_account: Optional WhatsApp account identifier.
    """
    try:
        contact = frappe.get_doc("WhatsApp Contact", room)
        if not contact.mobile_no:
            return
        unread = frappe.get_all(
            "WhatsApp Message",
            filters={
                "from": contact.mobile_no,
                "type": "Incoming",
                "status": ["not in", ["marked as read", "read"]],
            },
            fields=["name", "whatsapp_account", "message_id"],
            order_by="creation desc",
            limit=10,
        )
        if not unread:
            return
        for msg in unread:
            account = msg.whatsapp_account or whatsapp_account
            if not account:
                continue
            allow = frappe.db.get_value(
                "WhatsApp Account", account, "allow_auto_read_receipt"
            )
            if allow and msg.message_id:
                try:
                    doc = frappe.get_doc("WhatsApp Message", msg.name)
                    doc.send_read_receipt()
                    time.sleep(0.1)
                except Exception:
                    pass
    except Exception:
        pass