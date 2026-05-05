import json
import time
from datetime import datetime, timedelta

import frappe

from ..chatbot.processor import process_incoming_message


def route_incoming_message(doc, session):
	session_lock_key = f"session_processing_{session.name}"

	if frappe.cache().get_value(session_lock_key):
		return

	frappe.cache().set_value(session_lock_key, True, expires_in_sec=30)

	try:
		message = (doc.message or "").strip().lower()
		temp_data = get_temp_data(session)

		if message == "stop":
			close_session(session)
			send_message(doc.get("from"), "Session ended. Type 'hi' to start again.")
			return

		if message in ["hi", "menu", "start"]:
			session.db_set("state", None, update_modified=False)
			session.db_set("temp_data", json.dumps({}), update_modified=False)
			send_main_menu(doc.get("from"), session)
			return

		if message == "ai_support":
			whatsapp_account = frappe.get_doc("WhatsApp Account", doc.whatsapp_account)
			chatbot_settings = frappe.db.exists(
				"Chatbot Settings", {"whatsapp_account": whatsapp_account.name}
			)
			if chatbot_settings:
				session.db_set("state", "AI_CHAT", update_modified=False)
				return process_incoming_message(doc)
			else:
				send_message(
					doc.get("from"),
					"AI Support is not available at the moment. Please choose another option.",
				)
				send_main_menu(doc.get("from"), session)
				return

		elif message == "agent":
			whatsapp_account = frappe.get_doc("WhatsApp Account", doc.whatsapp_account)
			if whatsapp_account.support_enabled:
				temp_data["agent_request_acknowledged"] = False
				session.db_set("state", "HUMAN", update_modified=False)
				session.db_set("temp_data", json.dumps(temp_data), update_modified=False)
				return handle_agent_flow(doc, session)
			else:
				send_message(
					doc.get("from"),
					"Direct agent support is not available at the moment. Please choose another option.",
				)
				send_main_menu(doc.get("from"), session)
				return

		elif message == "ticket":
			session.db_set("state", "TICKETING", update_modified=False)
			session.db_set("temp_data", json.dumps({"ticket_step": "SELECT_CUSTOMER"}), update_modified=False)
			return handle_ticket_flow(doc, session, session_lock_key)

		if session.state == "AI_CHAT":
			return process_incoming_message(doc)
		elif session.state == "HUMAN":
			return handle_agent_flow(doc, session)
		elif session.state == "TICKETING":
			return handle_ticket_flow(doc, session, session_lock_key)

		send_main_menu(doc.get("from"), session)
	finally:
		frappe.cache().delete_value(session_lock_key)


def get_or_create_session_sync(doc):
	try:
		phone = doc.get("from")
		phone_lock_key = f"session_phone_{phone}"

		max_retries = 10
		for attempt in range(max_retries):
			if not frappe.cache().get_value(phone_lock_key):
				frappe.cache().set_value(phone_lock_key, True, expires_in_sec=30)
				break
			if attempt < max_retries - 1:
				time.sleep(0.1)
			else:
				frappe.log_error(
					title="Session Phone Lock Timeout",
					message=f"Could not acquire lock for phone {phone}",
				)
				return None

		try:
			now = frappe.utils.now_datetime()

			session_list = frappe.get_all(
				"WhatsApp Session",
				filters={"phone": phone, "status": "Active"},
				fields=["name", "expires_at"],
				order_by="creation desc",
				limit=1,
			)

			if session_list:
				session = frappe.get_doc("WhatsApp Session", session_list[0].name)
				if session.expires_at and now <= session.expires_at:
					update_session(session)
					session.is_new = False
					return session
				close_session(session)

			new_session = create_session_sync(doc)
			update_session(new_session)
			new_session.is_new = True
			return new_session
		finally:
			frappe.cache().delete_value(phone_lock_key)

	except Exception:
		frappe.log_error(
			title="WhatsApp Session Get/Create Error",
			message=frappe.get_traceback(),
			reference_doctype="WhatsApp Message",
			reference_name=doc.name,
		)
		return None


def create_session_sync(doc):
	try:
		now = frappe.utils.now_datetime()
		contact = frappe.db.get_value("WhatsApp Contact", {"mobile_no": doc.get("from")})

		if not contact:
			contact_doc = frappe.get_doc(
				{
					"doctype": "WhatsApp Contact",
					"mobile_no": doc.get("from"),
					"profile_name": doc.get("profile_name"),
				}
			)
			contact_doc.insert(ignore_permissions=True)
			contact = contact_doc.name

		session = frappe.get_doc(
			{
				"doctype": "WhatsApp Session",
				"phone": doc.get("from"),
				"whatsapp_account": doc.whatsapp_account,
				"whatsapp_contact": contact,
				"status": "Active",
				"started_at": now,
				"last_interaction": now,
				"expires_at": now + timedelta(hours=24),
				"temp_data": "{}",
			}
		)
		session.insert(ignore_permissions=True)
		return session
	except Exception:
		frappe.log_error(
			title="WhatsApp Session Creation Error",
			message=frappe.get_traceback(),
			reference_doctype="WhatsApp Message",
			reference_name=doc.name,
		)
		raise


def update_session(session):
	try:
		session.db_set("last_interaction", frappe.utils.now_datetime(), update_modified=False)
	except Exception:
		frappe.log_error(
			title=f"WhatsApp Session Update Error: {session.name}",
			message=frappe.get_traceback(),
			reference_doctype="WhatsApp Session",
			reference_name=session.name,
		)


def close_session(session):
	try:
		session.db_set("status", "Expired", update_modified=False)
		session.db_set("ended_by_system", 1, update_modified=False)
	except Exception:
		frappe.log_error(
			title=f"WhatsApp Session Close Error: {session.name}",
			message=frappe.get_traceback(),
			reference_doctype="WhatsApp Session",
			reference_name=session.name,
		)


def get_temp_data(session):
	try:
		return json.loads(session.temp_data or "{}")
	except Exception:
		return {}


def set_temp_data(session, data):
	session.db_set("temp_data", json.dumps(data, default=str), update_modified=False)


def send_message(to, message):
	try:
		frappe.get_doc(
			{
				"doctype": "WhatsApp Message",
				"to": to,
				"type": "Outgoing",
				"content_type": "text",
				"message": message,
			}
		).insert(ignore_permissions=True)
	except Exception:
		frappe.log_error(title=f"WhatsApp Send Message Error to {to}", message=frappe.get_traceback())


def send_main_menu(phone, session=None):
	try:
		whatsapp_account = frappe.get_doc("WhatsApp Account", session.whatsapp_account) if session else None

		buttons = []

		if whatsapp_account and whatsapp_account.chatbot_settings:
			buttons.append({"id": "ai_support", "title": "🤖 AI Support"})

		if whatsapp_account and whatsapp_account.support_enabled:
			buttons.append({"id": "agent", "title": "👨‍💼 Speak to Agent"})

		buttons.append({"id": "ticket", "title": "🎫 Raise a Ticket"})

		if len(buttons) == 1:
			send_message(phone, "Welcome 👋\n\nType 'ticket' to raise a ticket.")
			return

		frappe.get_doc(
			{
				"doctype": "WhatsApp Message",
				"to": phone,
				"type": "Outgoing",
				"content_type": "interactive",
				"whatsapp_session": session.name if session else None,
				"message": "Welcome 👋 How can we help you?",
				"buttons": json.dumps(buttons),
			}
		).insert(ignore_permissions=True)
	except Exception:
		frappe.log_error(
			title=f"WhatsApp Menu Send Error for {phone}",
			message=frappe.get_traceback(),
			reference_doctype="WhatsApp Session" if session else None,
			reference_name=session.name if session else None,
		)


def handle_agent_flow(doc, session):
	try:
		temp_data = get_temp_data(session)
		if not temp_data.get("agent_request_acknowledged"):
			send_message(doc.get("from"), "Connecting you to a support agent. Please wait...")
			temp_data["agent_request_acknowledged"] = True
			set_temp_data(session, temp_data)
	except Exception:
		frappe.log_error(
			title=f"WhatsApp Agent Flow Error: {session.name}",
			message=frappe.get_traceback(),
			reference_doctype="WhatsApp Session",
			reference_name=session.name,
		)


def handle_ticket_flow(doc, session):
	try:
		phone = doc.get("from")
		if not session.get("ticket_step"):
			session.ticket_step = "ASK_ISSUE"
			session.save(ignore_permissions=True)
			return send_message(phone, "🎫 Please describe your issue in detail:")

		elif session.ticket_step == "ASK_ISSUE":
			issue = frappe.get_doc(
				{
					"doctype": "Issue",
					"subject": doc.message[:140],
					"description": doc.message,
					"raised_by": phone,
				}
			).insert(ignore_permissions=True)
			session.ticket_step = None
			session.state = None
			session.save(ignore_permissions=True)
			return send_message(
				phone,
				f"✅ Ticket created successfully!\n\nTicket ID: {issue.name}\nWe'll get back to you shortly.",
			)
	except Exception:
		frappe.log_error(
			title=f"WhatsApp Ticket Flow Error: {session.name}",
			message=frappe.get_traceback(),
			reference_doctype="WhatsApp Session",
			reference_name=session.name,
		)
