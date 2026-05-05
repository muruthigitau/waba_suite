import mimetypes
import time
from datetime import timedelta

import frappe


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
		frappe.db.set_value("WhatsApp Contact", room, "is_read", 1, update_modified=False)
		send_whatsapp_read_receipts_sync(room)
		return "ok"
	except Exception:
		frappe.log_error(
			title=f"WhatsApp mark_as_read Error for {room}",
			message=frappe.get_traceback(),
		)
		return "error"


def send_whatsapp_read_receipts_sync(room):
	"""Synchronous read receipt processing"""
	try:
		contact = frappe.get_doc("WhatsApp Contact", room)
		if not contact.mobile_no:
			return

		unread_messages = frappe.get_all(
			"WhatsApp Message",
			filters={
				"from": contact.mobile_no,
				"type": "Incoming",
				"status": ["not in", ["marked as read", "read"]],
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
					time.sleep(0.1)
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
			elif any(t in file_type for t in ["application/pdf", "msword", "vnd.ms-excel", "officedocument"]):
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
			).insert(ignore_permissions=True)
		else:
			frappe.get_doc(
				{
					"doctype": "WhatsApp Message",
					"to": user_no,
					"type": "Outgoing",
					"message": content,
					"content_type": content_type,
				}
			).insert(ignore_permissions=True)
		return "ok"
	except Exception:
		frappe.log_error(title=f"WhatsApp send Error for {user_no}", message=frappe.get_traceback())
		return "error"


def update_contact_with_retry(contact_name, msg_preview, max_retries=5, delay=0.2):
	for attempt in range(max_retries):
		try:
			# Use direct SQL update to avoid version conflicts
			frappe.db.sql(
				"""
				UPDATE `tabWhatsApp Contact`
				SET last_message = %(msg_preview)s,
				    is_read = 0,
				    modified = NOW()
				WHERE name = %(contact_name)s
			""",
				{"msg_preview": msg_preview[:200], "contact_name": contact_name},
			)
			frappe.db.commit()
			return True
		except Exception as e:
			error_str = str(e)
			if "Deadlock" in error_str or "Lock wait timeout" in error_str:
				if attempt < max_retries - 1:
					time.sleep(delay * (attempt + 1))
					frappe.db.rollback()
					continue
			frappe.log_error(
				title=f"WhatsApp Contact Update Error for {contact_name}",
				message=f"{e!s}\nAttempt {attempt + 1} of {max_retries}",
			)
			return False
	return False


def last_message(doc):
	try:
		mobile_no = doc.to if doc.type == "Outgoing" else doc.get("from")
		if not mobile_no:
			return

		# Use lock for contact updates
		contact_lock_key = f"contact_update_{mobile_no}"

		max_retries = 5
		for attempt in range(max_retries):
			if not frappe.cache().get_value(contact_lock_key):
				frappe.cache().set_value(contact_lock_key, True, expires_in_sec=10)
				break
			if attempt < max_retries - 1:
				time.sleep(0.1)
			else:
				return "locked"

		try:
			contact_name = frappe.db.get_value("WhatsApp Contact", {"mobile_no": mobile_no})
			msg_preview = doc.message or doc.attach or ""

			if len(msg_preview) > 200:
				msg_preview = msg_preview[:200] + "..."

			if contact_name:
				update_contact_with_retry(contact_name, msg_preview)
			else:
				chat_doc = frappe.get_doc(
					{
						"doctype": "WhatsApp Contact",
						"mobile_no": mobile_no,
						"last_message": msg_preview[:200],
						"contact_name": mobile_no,
						"is_read": 0,
					}
				)
				chat_doc.insert(ignore_permissions=True)
				contact_name = chat_doc.name

			if doc.type != "Outgoing":
				email = frappe.db.get_value("WhatsApp Contact", contact_name, "email")
				if email:
					message_data = {
						"content": msg_preview,
						"creation": frappe.utils.now(),
						"room": contact_name,
						"contact_name": mobile_no,
						"sender_user_no": mobile_no,
						"user": "Guest",
					}
					frappe.publish_realtime("latest_chat_updates", message_data, user=email)
					frappe.publish_realtime(contact_name, message_data, user=email)
			return "ok"
		finally:
			frappe.cache().delete_value(contact_lock_key)
	except Exception as e:
		frappe.log_error(
			title=f"WhatsApp last_message Sync Error for {doc.doctype} {doc.name}",
			message=f"{e!s}\n{frappe.get_traceback()}",
		)
		return "error"
