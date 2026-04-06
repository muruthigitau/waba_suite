import frappe
import mimetypes


@frappe.whitelist()
def get_all(room: str, user_no: str):
    try:
        return frappe.db.sql(
            """
            SELECT creation,
            case
                when `to` <> '' then `to`
                else 'Administrator'
            end as sender_user_no,
            case
                when COALESCE(content_type, 'text') = 'text' then COALESCE(message, '')
                else COALESCE(attach, message, '')
            end as content,
            case
                when COALESCE(content_type, 'text') <> 'text' then message
                else NULL
            end as caption,
            COALESCE(content_type, 'text') as content_type
            from `tabWhatsApp Message` where (`to` = %(user_no)s or `from` = %(user_no)s)
            AND COALESCE(message_type, '') <> 'Template'
            order by creation asc
        """,
            {"user_no": user_no},
            as_dict=True,
        )
    except Exception:
        frappe.log_error(title="WhatsApp get_all Error", message=frappe.get_traceback())
        return []


@frappe.whitelist()
def mark_as_read(room):
    try:
        frappe.db.set_value(
            "WhatsApp Contact", room, "is_read", 1, update_modified=False
        )
        send_whatsapp_read_receipts(room)
        return "ok"
    except Exception:
        frappe.log_error(
            title=f"WhatsApp mark_as_read Error for {room}",
            message=frappe.get_traceback(),
        )
        return "error"


def send_whatsapp_read_receipts(room):
    try:
        contact = frappe.get_doc("WhatsApp Contact", room)
        if not contact.mobile_no:
            return

        unread_messages = frappe.get_all(
            "WhatsApp Message",
            filters={
                "from": contact.mobile_no,
                "type": "Incoming",
                "status": ["not in", ["marked as read"]],
            },
            fields=["name", "whatsapp_account"],
            order_by="creation desc",
            limit=10,
        )

        if not unread_messages:
            return

        for msg in unread_messages:
            if not msg.whatsapp_account:
                continue

            allow_auto_read = frappe.db.get_value(
                "WhatsApp Account", msg.whatsapp_account, "allow_auto_read_receipt"
            )

            if allow_auto_read:
                try:
                    msg_doc = frappe.get_doc("WhatsApp Message", msg.name)
                    msg_doc.send_read_receipt()
                except Exception:
                    frappe.log_error(
                        title=f"WhatsApp Receipt Send Error for {msg.name}",
                        message=frappe.get_traceback(),
                    )
    except Exception:
        frappe.log_error(
            title=f"WhatsApp send_whatsapp_read_receipts Logic Error for {room}",
            message=frappe.get_traceback(),
        )


@frappe.whitelist()
def send(content, user, room, user_no, attachment=None):
    try:
        content_type = "text"
        if attachment:
            file_type = mimetypes.guess_type(content)[0] or ""
            if any(
                t in file_type
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
                content_type = "image"
            elif any(
                t in file_type
                for t in ["application/pdf", "msword", "vnd.ms-excel", "officedocument"]
            ):
                content_type = "document"
            elif any(
                t in file_type
                for t in [
                    "audio/aac",
                    "audio/mp4",
                    "audio/mpeg",
                    "audio/amr",
                    "audio/ogg",
                ]
            ):
                content_type = "audio"
            elif any(t in file_type for t in ["video/mp4", "video/3gp"]):
                content_type = "video"

            frappe.get_doc(
                {
                    "doctype": "WhatsApp Message",
                    "to": user_no,
                    "type": "Outgoing",
                    "attach": content,
                    "content_type": content_type,
                }
            ).save()
        else:
            frappe.get_doc(
                {
                    "doctype": "WhatsApp Message",
                    "to": user_no,
                    "type": "Outgoing",
                    "message": content,
                    "content_type": content_type,
                }
            ).save()
        return "ok"
    except Exception:
        frappe.log_error(
            title=f"WhatsApp send Error for {user_no}", message=frappe.get_traceback()
        )
        return "error"


def last_message(doc):
    try:
        mobile_no = doc.to if doc.type == "Outgoing" else doc.get("from")
        if not mobile_no:
            return

        contact_name = frappe.db.get_value("WhatsApp Contact", {"mobile_no": mobile_no})
        msg_preview = doc.message or doc.attach or ""

        if contact_name:
            chat_doc = frappe.get_doc("WhatsApp Contact", contact_name)
            chat_doc.last_message = msg_preview
            chat_doc.is_read = 0
            chat_doc.save(ignore_permissions=True)
        else:
            chat_doc = frappe.get_doc(
                {
                    "doctype": "WhatsApp Contact",
                    "mobile_no": mobile_no,
                    "last_message": msg_preview,
                    "contact_name": mobile_no,
                    "is_read": 0,
                }
            )
            chat_doc.save(ignore_permissions=True)

        if chat_doc.email and doc.type != "Outgoing":
            message_data = {
                "content": msg_preview,
                "creation": frappe.utils.now(),
                "room": chat_doc.name,
                "contact_name": chat_doc.contact_name,
                "sender_user_no": mobile_no,
                "user": "Guest",
            }
            frappe.publish_realtime(
                "latest_chat_updates", message_data, user=chat_doc.email
            )
            frappe.publish_realtime(chat_doc.name, message_data, user=chat_doc.email)
        return "ok"
    except Exception:
        frappe.log_error(
            title=f"WhatsApp last_message Sync Error for {doc.doctype} {doc.name}",
            message=frappe.get_traceback(),
        )
        return "error"
