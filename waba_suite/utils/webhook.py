import json
import time

import frappe
import requests
from frappe.utils.file_manager import save_file
from werkzeug.wrappers import Response

from waba_suite.utils import format_number, get_whatsapp_account


@frappe.whitelist(allow_guest=True)
def webhook():
	if frappe.request.method == "GET":
		return get()
	return post()


def get():
	hub_challenge = frappe.form_dict.get("hub.challenge")
	verify_token = frappe.form_dict.get("hub.verify_token")

	webhook_verify_token = frappe.db.get_value(
		"WhatsApp Account",
		{"webhook_verify_token": verify_token},
		"webhook_verify_token",
	)

	if not webhook_verify_token:
		frappe.throw("No matching WhatsApp account")

	if verify_token != webhook_verify_token:
		frappe.throw("Verify token does not match")

	return Response(hub_challenge, status=200)


def post():
	try:
		data = frappe.local.form_dict

		frappe.get_doc(
			{
				"doctype": "WhatsApp Notification Log",
				"template": "Webhook",
				"meta_data": json.dumps(data),
			}
		).insert(ignore_permissions=True)

		messages = []
		phone_id = None

		entry = data.get("entry", [{}])[0]
		changes = entry.get("changes", [{}])[0]
		value = changes.get("value", {})
		messages = value.get("messages", [])
		phone_id = value.get("metadata", {}).get("phone_number_id")

		sender_profile_name = next(
			(
				contact.get("profile", {}).get("name")
				for entry in data.get("entry", [])
				for change in entry.get("changes", [])
				for contact in change.get("value", {}).get("contacts", [])
			),
			None,
		)

		whatsapp_account = None

		if phone_id:
			whatsapp_account = get_whatsapp_account(phone_id)

		if not whatsapp_account:
			default = frappe.db.get_value("WhatsApp Account", {"is_default": 1}, "name")
			if default:
				whatsapp_account = frappe.get_doc("WhatsApp Account", default)

		if messages and whatsapp_account:
			for message in messages:
				try:
					process_message_sync(
						message=message,
						sender_profile_name=sender_profile_name,
						whatsapp_account=whatsapp_account.name,
					)
				except Exception as e:
					frappe.log_error(
						title="WhatsApp Webhook Message Processing Error",
						message=f"Failed to process message: {e}\nMessage: {json.dumps(message)}",
					)
					continue
		else:
			update_status(changes)

	except Exception:
		frappe.log_error(
			title="WhatsApp Webhook Error",
			message=frappe.get_traceback(),
		)

	return Response("OK", status=200)


def process_message_sync(message, sender_profile_name, whatsapp_account):
	"""Synchronous processing of webhook messages"""
	try:
		account = frappe.get_doc("WhatsApp Account", whatsapp_account)

		message_type = message.get("type")
		is_reply = bool(message.get("context") and "forwarded" not in message.get("context", {}))
		reply_to_message_id = message.get("context", {}).get("id") if is_reply else None

		from_number = message.get("from")

		phone_lock_key = f"whatsapp_phone_process_{from_number}"

		max_retries = 10
		retry_delay = 0.5

		for attempt in range(max_retries):
			if not frappe.cache().get_value(phone_lock_key):
				frappe.cache().set_value(phone_lock_key, True, expires_in_sec=60)
				break
			if attempt < max_retries - 1:
				time.sleep(retry_delay)
			else:
				frappe.log_error(
					title="Phone Number Lock Timeout",
					message=f"Could not acquire lock for phone {from_number}",
				)
				return

		try:
			msg_doc = {
				"doctype": "WhatsApp Message",
				"type": "Incoming",
				"from": message.get("from"),
				"message_id": message.get("id"),
				"reply_to_message_id": reply_to_message_id,
				"is_reply": is_reply,
				"profile_name": sender_profile_name,
				"whatsapp_account": account.name,
			}

			if message_type == "text":
				msg_doc["message"] = message["text"]["body"]
				msg_doc["content_type"] = "text"

			elif message_type == "reaction":
				msg_doc["message"] = message["reaction"]["emoji"]
				msg_doc["reply_to_message_id"] = message["reaction"]["message_id"]
				msg_doc["content_type"] = "reaction"

			elif message_type == "interactive":
				interactive_data = message["interactive"]
				interactive_type = interactive_data.get("type")

				if interactive_type == "button_reply":
					msg_doc["message"] = interactive_data["button_reply"]["id"]
					msg_doc["content_type"] = "button"

				elif interactive_type == "list_reply":
					msg_doc["message"] = interactive_data["list_reply"]["id"]
					msg_doc["content_type"] = "button"

			elif message_type in ["image", "audio", "video", "document"]:
				msg_doc["message"] = message[message_type].get("caption", "")
				msg_doc["content_type"] = message_type

				doc = frappe.get_doc(msg_doc)
				doc.insert(ignore_permissions=True)

				process_media_sync(
					message_name=doc.name,
					message=message,
					whatsapp_account=account.name,
				)
				return

			else:
				msg_doc["message"] = str(message.get(message_type, {}))
				msg_doc["content_type"] = message_type

			frappe.get_doc(msg_doc).insert(ignore_permissions=True)

		finally:
			frappe.cache().delete_value(phone_lock_key)

	except Exception as e:
		frappe.log_error(
			title="WhatsApp Webhook Process Message Error",
			message=f"{e!s}\nMessage: {json.dumps(message)}",
		)


def process_media_sync(message_name, message, whatsapp_account):
	"""Synchronous media processing"""
	try:
		account = frappe.get_doc("WhatsApp Account", whatsapp_account)
		message_type = message.get("type")

		token = account.get_password("token")
		url = f"{account.url}/{account.version}/"
		media_id = message[message_type]["id"]

		headers = {"Authorization": f"Bearer {token}"}

		response = requests.get(f"{url}{media_id}/", headers=headers)

		if response.status_code != 200:
			frappe.log_error(
				title="WhatsApp Media Download Error",
				message=f"Failed to get media info: {response.status_code}",
			)
			return

		media_data = response.json()
		media_url = media_data.get("url")
		mime_type = media_data.get("mime_type", "application/octet-stream")

		media_response = requests.get(media_url, headers=headers)

		if media_response.status_code != 200:
			frappe.log_error(
				title="WhatsApp Media Download Error",
				message=f"Failed to download media: {media_response.status_code}",
			)
			return

		ext = mime_type.split("/")[-1] if "/" in mime_type else "bin"
		file_name = f"{frappe.generate_hash(length=10)}.{ext}"

		file_doc = save_file(
			file_name,
			media_response.content,
			"WhatsApp Message",
			message_name,
			is_private=False,
		)

		frappe.db.set_value(
			"WhatsApp Message",
			message_name,
			"attach",
			file_doc.file_url,
			update_modified=False,
		)
		frappe.db.commit()

	except Exception:
		frappe.log_error(
			title="WhatsApp Media Processing Error",
			message=frappe.get_traceback(),
		)


def update_status(data):
	try:
		if data.get("field") == "messages":
			statuses = data.get("value", {}).get("statuses", [])
			for s in statuses:
				update_status_sync(status_data=s)
	except Exception:
		frappe.log_error(
			title="Update Status Error",
			message=frappe.get_traceback(),
		)


def update_status_sync(status_data):
	try:
		message_id = status_data.get("id")
		status = status_data.get("status")
		conversation = status_data.get("conversation", {}).get("id")

		name = frappe.db.get_value("WhatsApp Message", {"message_id": message_id})

		if not name:
			return

		frappe.db.sql(
			"""
			UPDATE `tabWhatsApp Message`
			SET status = %(status)s,
			    conversation_id = %(conversation)s,
			    modified = NOW()
			WHERE name = %(name)s
			AND (status != %(status)s OR conversation_id != %(conversation)s)
		""",
			{"status": status, "conversation": conversation, "name": name},
		)

		frappe.db.commit()

	except Exception:
		frappe.log_error(
			title="Update Status Sync Error",
			message=frappe.get_traceback(),
		)
