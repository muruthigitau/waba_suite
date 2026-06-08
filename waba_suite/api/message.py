import json
import mimetypes
import time

import frappe


@frappe.whitelist()
def get_all(room: str, user_no: str, whatsapp_account: str = None):
	try:
		filters = {
			"to": ["in", [user_no, ""]],
			"from": ["in", [user_no, ""]],
			"message_type": ["!=", "Template"],
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
								"sender": msg.get("to") or msg.get("from", "Administrator"),
								"message_id": msg.get("name"),
							}
						)
				except:
					pass
				continue

			if msg.get("content_type") == "text":
				msg["content"] = msg.get("message", "")
			else:
				msg["content"] = msg.get("attach", msg.get("message", ""))

			msg["caption"] = msg.get("message") if msg.get("content_type") != "text" else None

			if msg.get("to"):
				msg["sender_user_no"] = msg.get("to")
			else:
				msg["sender_user_no"] = "Administrator"

			message_dict[msg.get("name")] = msg

		for msg_id, reactions in reactions_dict.items():
			if msg_id in message_dict:
				reaction_counts = {}
				for reaction in reactions:
					emoji = reaction.get("emoji")
					if emoji:
						reaction_counts[emoji] = reaction_counts.get(emoji, 0) + 1

				aggregated_reactions = []
				for emoji, count in reaction_counts.items():
					aggregated_reactions.append({"emoji": emoji, "count": count})

				if aggregated_reactions:
					message_dict[msg_id]["reactions"] = aggregated_reactions

		result = list(message_dict.values())
		result.sort(key=lambda x: x.get("creation", ""))

		return result
	except Exception:
		frappe.log_error(title="WhatsApp get_all Error", message=frappe.get_traceback())
		return []


@frappe.whitelist()
def mark_as_read(room: str, whatsapp_account: str = None):
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
		frappe.log_error(title=f"WhatsApp mark_as_read Error for {room}", message=frappe.get_traceback())
		return "error"


def send_whatsapp_read_receipts_sync(room: str, whatsapp_account: str = None):
	try:
		contact = frappe.get_doc("WhatsApp Contact", room)
		if not contact.mobile_no:
			return

		filters = {
			"from": contact.mobile_no,
			"type": "Incoming",
			"status": ["not in", ["marked as read", "read"]],
		}

		unread_messages = frappe.get_all(
			"WhatsApp Message",
			filters=filters,
			fields=["name", "whatsapp_account", "message_id"],
			order_by="creation desc",
			limit=10,
		)

		if not unread_messages:
			return

		for msg in unread_messages:
			account = msg.whatsapp_account or whatsapp_account
			if not account:
				continue

			allow_auto_read = frappe.db.get_value("WhatsApp Account", account, "allow_auto_read_receipt")

			if allow_auto_read and msg.message_id:
				try:
					msg_doc = frappe.get_doc("WhatsApp Message", msg.name)
					msg_doc.send_read_receipt()
					time.sleep(0.1)
				except Exception:
					pass
	except Exception:
		pass


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
	try:
		if not content_type:
			content_type = "text"

		contact = frappe.get_doc("WhatsApp Contact", room)

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
				t in file_type for t in ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"]
			):
				content_type = "audio"
			elif any(t in file_type for t in ["video/mp4", "video/3gp"]):
				content_type = "video"

		msg_doc = frappe.get_doc(
			{
				"doctype": "WhatsApp Message",
				"to": user_no,
				"type": "Outgoing",
				"attach": attachment if attachment else None,
				"message": content if not attachment else None,
				"content_type": content_type,
				"status": "sent",
				"whatsapp_account": whatsapp_account or contact.whatsapp_account,
				"reply_to_message": reply_to_message_id if reply_to_message_id else None,
			}
		)
		msg_doc.insert(ignore_permissions=True)

		frappe.db.commit()

		return {"status": "ok", "message_id": msg_doc.name}
	except Exception:
		frappe.log_error(title=f"WhatsApp send Error for {user_no}", message=frappe.get_traceback())
		return {"status": "error", "message": str(frappe.get_traceback())}


def update_contact_with_retry(contact_name, msg_preview, unread_count, max_retries=5, delay=0.2):
	for attempt in range(max_retries):
		try:
			contact = frappe.get_doc("WhatsApp Contact", contact_name)
			contact.last_message = (
				json.dumps(msg_preview)[:200] if isinstance(msg_preview, dict) else str(msg_preview)[:200]
			)
			contact.is_read = 0
			contact.unread_incoming = (contact.unread_incoming or 0) + unread_count
			contact.save(ignore_permissions=True)
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


def update_contact_last_message(doc, method=None):
	try:
		mobile_no = doc.to if doc.type == "Outgoing" else doc.get("from")
		if not mobile_no:
			return

		unread_increment = 1 if doc.type == "Incoming" and doc.status != "read" else 0

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

			msg_preview = {
				"name": doc.name,
				"message": doc.message or doc.attach or "",
				"type": doc.type,
				"status": doc.status,
				"creation": str(doc.creation),
				"whatsapp_account": doc.whatsapp_account,
				"to": doc.to,
				"from": doc.from_,
			}

			if contact_name:
				update_contact_with_retry(contact_name, msg_preview, unread_increment)
			else:
				contact_doc = frappe.get_doc(
					{
						"doctype": "WhatsApp Contact",
						"mobile_no": mobile_no,
						"last_message": json.dumps(msg_preview)[:200],
						"contact_name": mobile_no,
						"is_read": 0,
						"unread_incoming": unread_increment,
						"whatsapp_account": doc.whatsapp_account,
					}
				)
				contact_doc.insert(ignore_permissions=True)
				contact_name = contact_doc.name

			if doc.type != "Outgoing":
				email = frappe.db.get_value("WhatsApp Contact", contact_name, "email")
				if email:
					message_data = {
						"content": doc.message or doc.attach or "",
						"creation": str(doc.creation),
						"room": contact_name,
						"contact_name": mobile_no,
						"sender_user_no": mobile_no,
						"user": "Guest",
						"whatsapp_account": doc.whatsapp_account,
					}
					frappe.publish_realtime("latest_chat_updates", message_data, user=email)
					frappe.publish_realtime(contact_name, message_data, user=email)

			return "ok"
		finally:
			frappe.cache().delete_value(contact_lock_key)
	except Exception as e:
		frappe.log_error(
			title=f"WhatsApp update_contact_last_message Error for {doc.doctype} {doc.name}",
			message=f"{e!s}\n{frappe.get_traceback()}",
		)
		return "error"


@frappe.whitelist()
def get_contacts(email: str, whatsapp_account: str = None):
	try:
		filters = {}

		if email and email != "Administrator":
			filters["email"] = email

		if whatsapp_account:
			filters["whatsapp_account"] = whatsapp_account

		contacts = frappe.get_all(
			"WhatsApp Contact",
			filters=filters,
			fields=[
				"name",
				"contact_name",
				"mobile_no",
				"last_message",
				"modified as last_date",
				"is_read",
				"type as room_type",
				"unread_incoming",
				"whatsapp_account",
			],
			order_by="modified desc",
		)

		for contact in contacts:
			if contact.get("last_message"):
				try:
					if isinstance(contact.last_message, str):
						contact.last_message = json.loads(contact.last_message)
				except:
					pass

		return contacts
	except Exception:
		frappe.log_error(title="WhatsApp get_contacts Error", message=frappe.get_traceback())
		return []


@frappe.whitelist()
def create_contact(contact_name: str, mobile_no: str, email: str, whatsapp_account: str):
	try:
		existing = frappe.db.get_value("WhatsApp Contact", {"mobile_no": mobile_no})
		if existing:
			return {"status": "exists", "name": existing}

		contact = frappe.get_doc(
			{
				"doctype": "WhatsApp Contact",
				"contact_name": contact_name,
				"mobile_no": mobile_no,
				"email": email,
				"whatsapp_account": whatsapp_account,
				"is_read": 1,
			}
		)
		contact.insert(ignore_permissions=True)

		room_data = {
			"name": contact.name,
			"contact_name": contact.contact_name,
			"mobile_no": contact.mobile_no,
			"room_type": "Direct",
			"whatsapp_account": contact.whatsapp_account,
			"members": [email],
			"member_names": [{"email": email, "name": contact.contact_name}],
		}

		frappe.publish_realtime("private_room_creation", room_data, user=email)

		return {"status": "success", "name": contact.name}
	except Exception:
		frappe.log_error(title="WhatsApp create_contact Error", message=frappe.get_traceback())
		return {"status": "error"}


@frappe.whitelist()
def mark_multiple_as_read(whatsapp_contact, whatsapp_account=None):
	try:
		unread_messages = frappe.get_all(
			"WhatsApp Message",
			filters={
				"from": frappe.db.get_value("WhatsApp Contact", whatsapp_contact, "mobile_no"),
				"type": "Incoming",
				"status": ["not in", ["read", "marked_as_read"]],
				"whatsapp_account": whatsapp_account,
			},
			fields=["name"],
		)
		if not unread_messages or not isinstance(unread_messages, list):
			return {"status": "error", "message": "No unread messages found"}

		marked_count = 0

		for message_id in [msg.name for msg in unread_messages]:
			try:
				msg_doc = frappe.get_doc("WhatsApp Message", message_id)
				if msg_doc.type == "Incoming" and msg_doc.status not in ["read", "marked_as_read"]:
					msg_doc.send_read_receipt()
					marked_count += 1
			except Exception:
				continue

		frappe.db.commit()

		return {"status": "success", "message": f"Marked {marked_count} messages as read"}
	except Exception as e:
		frappe.log_error(
			title="WhatsApp Mark Multiple As Read Error", message=f"{e!s}\n{frappe.get_traceback()}"
		)
		return {"status": "error", "message": str(e)}
