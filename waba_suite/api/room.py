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
				"WhatsApp Chatbot Settings", {"whatsapp_account": whatsapp_account.name, "enabled": 1}
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


def send_interactive_buttons(to, body_text, buttons, session=None):
	try:
		frappe.get_doc(
			{
				"doctype": "WhatsApp Message",
				"to": to,
				"type": "Outgoing",
				"content_type": "interactive",
				"whatsapp_session": session.name if session else None,
				"message": body_text,
				"buttons": json.dumps(buttons[:3]),
			}
		).insert(ignore_permissions=True)
	except Exception:
		frappe.log_error(
			title=f"WhatsApp Interactive Button Error to {to}",
			message=frappe.get_traceback(),
		)


def send_main_menu(phone, session=None):
	try:
		whatsapp_account = frappe.get_doc("WhatsApp Account", session.whatsapp_account) if session else None
		buttons = []

		if whatsapp_account:
			chatbot_settings = frappe.db.exists(
				"WhatsApp Chatbot Settings", {"whatsapp_account": whatsapp_account.name, "enabled": 1}
			)
			if chatbot_settings:
				buttons.append({"id": "ai_support", "title": "AI Support"})
			if whatsapp_account.support_enabled:
				buttons.append({"id": "agent", "title": "Speak to Agent"})

		buttons.append({"id": "ticket", "title": "Raise a Ticket"})

		if len(buttons) == 1:
			send_message(phone, "Welcome. Type 'ticket' to raise a ticket.")
			return

		send_interactive_buttons(
			to=phone,
			body_text="Welcome. How can we help you today?",
			buttons=buttons,
			session=session,
		)
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


def get_whatsapp_contact(phone):
	contact_name = frappe.db.get_value("WhatsApp Contact", {"mobile_no": phone})
	if not contact_name:
		contact_doc = frappe.get_doc(
			{
				"doctype": "WhatsApp Contact",
				"mobile_no": phone,
			}
		)
		contact_doc.insert(ignore_permissions=True)
		contact_name = contact_doc.name
	return contact_name


def get_contact_doc(phone):
	contact_name = frappe.db.get_value("WhatsApp Contact", {"mobile_no": phone})
	if contact_name:
		return frappe.get_doc("WhatsApp Contact", contact_name)
	return None


def get_customer_from_contact(phone):
	contact = get_contact_doc(phone)
	if contact:
		return contact.get("customer")
	return None


def link_customer_to_contact(phone, customer_name):
	contact_name = frappe.db.get_value("WhatsApp Contact", {"mobile_no": phone})
	if contact_name:
		contact_doc = frappe.get_doc("WhatsApp Contact", contact_name)
		if not contact_doc.customer:
			contact_doc.customer = customer_name
			contact_doc.save(ignore_permissions=True)
	else:
		frappe.get_doc(
			{
				"doctype": "WhatsApp Contact",
				"mobile_no": phone,
				"customer": customer_name,
			}
		).insert(ignore_permissions=True)


def validate_user_email(email):
	return frappe.db.exists("User", {"email": email})


def get_attachments_with_content(doc, session):
	attachments_data = []
	temp_data = get_temp_data(session)
	start_time = temp_data.get("attachments_start_time")

	filters = {"whatsapp_session": session.name, "type": "Incoming"}
	if start_time:
		filters["creation"] = [">", start_time]

	messages = frappe.get_all(
		"WhatsApp Message",
		filters=filters,
		fields=["name", "message", "creation"],
		order_by="creation asc",
	)

	for msg in messages:
		files = frappe.get_all(
			"File",
			filters={
				"attached_to_doctype": "WhatsApp Message",
				"attached_to_name": msg.name,
			},
			fields=["file_url", "file_name"],
		)

		if files:
			attachments_data.append(
				{"message": msg.message or "", "files": files, "creation": str(msg.creation)}
			)

	if doc.name and doc.doctype == "WhatsApp Message" and start_time:
		current_files = frappe.get_all(
			"File",
			filters={
				"attached_to_doctype": "WhatsApp Message",
				"attached_to_name": doc.name,
			},
			fields=["file_url", "file_name"],
		)

		if current_files:
			attachments_data.append(
				{"message": doc.message or "", "files": current_files, "creation": str(doc.creation)}
			)

	return attachments_data


def select_ticket_type(phone, session):
	try:
		ticket_types = frappe.get_all("HD Ticket Type", fields=["name"], limit=10)
		if ticket_types:
			buttons = []
			for tt in ticket_types[:3]:
				buttons.append({"id": f"ttype_{tt.name}", "title": tt.name[:20]})

			temp_data = get_temp_data(session)
			temp_data["ticket_step"] = "SELECT_TICKET_TYPE"
			set_temp_data(session, temp_data)

			send_interactive_buttons(
				to=phone,
				body_text="Select ticket type:",
				buttons=buttons,
				session=session,
			)
		else:
			temp_data = get_temp_data(session)
			temp_data["ticket_step"] = "ASK_SUBJECT"
			set_temp_data(session, temp_data)
			send_message(phone, "Please provide a subject for your ticket:")
	except Exception:
		frappe.log_error(
			title=f"Select Ticket Type Error: {session.name}",
			message=frappe.get_traceback(),
		)


def ensure_contact_email(phone, session):
	contact = get_contact_doc(phone)
	temp_data = get_temp_data(session)
	if contact and contact.get("user"):
		temp_data["email"] = contact.get("user")
		set_temp_data(session, temp_data)
		return True
	temp_data["ticket_step"] = "ASK_EMAIL"
	set_temp_data(session, temp_data)
	send_message(phone, "Please provide your email address:")
	return False


def handle_ticket_flow(doc, session, session_lock_key=None):
	try:
		phone = doc.get("from")
		message = (doc.message or "").strip()
		temp_data = get_temp_data(session)
		step = temp_data.get("ticket_step")

		current_attachments = get_attachments_with_content(doc, session)

		if current_attachments:
			temp_data["pending_attachments"] = current_attachments
			set_temp_data(session, temp_data)

		if step == "SELECT_CUSTOMER":
			customer = get_customer_from_contact(phone)
			if customer:
				temp_data["customer"] = customer
				temp_data["ticket_step"] = "VALIDATE_EMAIL"
				set_temp_data(session, temp_data)
				return handle_ticket_flow(doc, session, session_lock_key)

			customers = frappe.get_all("HD Customer", fields=["name", "customer_name"], limit=10)
			if customers:
				buttons = [{"id": "new_customer", "title": "New Customer"}]
				for cust in customers[:2]:
					buttons.append(
						{"id": f"cust_{cust.name}", "title": cust.get("customer_name", cust.name)[:20]}
					)

				temp_data["ticket_step"] = "SELECT_CUSTOMER_CHOICE"
				set_temp_data(session, temp_data)

				send_interactive_buttons(
					to=phone,
					body_text="Select your customer profile:",
					buttons=buttons,
					session=session,
				)
			else:
				temp_data["ticket_step"] = "CREATE_CUSTOMER_NAME"
				set_temp_data(session, temp_data)
				send_message(phone, "Let's create your profile.\n\nWhat is your full name?")

		elif step == "SELECT_CUSTOMER_CHOICE":
			if message == "new_customer":
				temp_data["ticket_step"] = "CREATE_CUSTOMER_NAME"
				set_temp_data(session, temp_data)
				send_message(phone, "What is your full name?")
			elif message.startswith("cust_"):
				customer_name = message[5:]
				if frappe.db.exists("HD Customer", customer_name):
					temp_data["customer"] = customer_name
					link_customer_to_contact(phone, customer_name)
					temp_data["ticket_step"] = "VALIDATE_EMAIL"
					set_temp_data(session, temp_data)
					return handle_ticket_flow(doc, session, session_lock_key)
			else:
				send_message(phone, "Please select an option from the menu.")
				return handle_ticket_flow(doc, session, session_lock_key)

		elif step == "CREATE_CUSTOMER_NAME":
			if not message:
				send_message(phone, "Please provide your full name:")
				return
			temp_data["customer_name"] = message
			temp_data["ticket_step"] = "ASK_SITE_DOMAIN"
			set_temp_data(session, temp_data)
			send_message(phone, "What is your site domain? (example: company.com)")

		elif step == "ASK_SITE_DOMAIN":
			if not message:
				send_message(phone, "Please provide your site domain:")
				return

			temp_data["site_domain"] = message
			temp_data["ticket_step"] = "VALIDATE_EMAIL"
			set_temp_data(session, temp_data)
			return handle_ticket_flow(doc, session, session_lock_key)

		elif step == "VALIDATE_EMAIL":
			if not ensure_contact_email(phone, session):
				return
			temp_data = get_temp_data(session)
			email = temp_data.get("email")
			if not validate_user_email(email):
				temp_data["ticket_step"] = "ASK_EMAIL"
				set_temp_data(session, temp_data)
				send_message(phone, "Email not found. Please provide a valid registered email:")
				return
			temp_data["ticket_step"] = "SELECT_TICKET_TYPE"
			set_temp_data(session, temp_data)
			return select_ticket_type(phone, session)

		elif step == "ASK_EMAIL":
			if not message:
				send_message(phone, "Please provide your email:")
				return
			if not validate_user_email(message):
				send_message(phone, "Email not found. Please enter a valid registered email:")
				return
			contact = get_contact_doc(phone)
			if contact:
				contact.user = message
				contact.save(ignore_permissions=True)
			temp_data["email"] = message
			temp_data["ticket_step"] = "SELECT_TICKET_TYPE"
			set_temp_data(session, temp_data)
			return select_ticket_type(phone, session)

		elif step == "SELECT_TICKET_TYPE":
			if message.startswith("ttype_"):
				ticket_type = message[6:]
				if frappe.db.exists("HD Ticket Type", ticket_type):
					temp_data["ticket_type"] = ticket_type
					temp_data["ticket_step"] = "ASK_SUBJECT"
					set_temp_data(session, temp_data)
					send_message(
						phone, f"Selected: {ticket_type}\n\nPlease provide a subject for your ticket:"
					)
			else:
				send_message(phone, "Please select a ticket type from the menu.")

		elif step == "ASK_SUBJECT":
			if message:
				temp_data["subject"] = message
				temp_data["ticket_step"] = "ASK_DESCRIPTION"
				set_temp_data(session, temp_data)
				send_message(phone, "Please describe your issue in detail:")
			else:
				send_message(phone, "Please provide a subject:")

		elif step == "ASK_DESCRIPTION":
			if message:
				temp_data["description"] = message
				temp_data["ticket_step"] = "ASK_ATTACHMENT"
				set_temp_data(session, temp_data)

				send_interactive_buttons(
					to=phone,
					body_text="Would you like to add attachments?",
					buttons=[
						{"id": "attach_yes", "title": "Yes, add files"},
						{"id": "attach_no", "title": "No, submit ticket"},
					],
					session=session,
				)
			else:
				send_message(phone, "Please provide a description:")

		elif step == "ASK_ATTACHMENT":
			if message == "attach_yes":
				temp_data["ticket_step"] = "WAITING_FOR_ATTACHMENT"
				temp_data["attachments_start_time"] = frappe.utils.now()
				set_temp_data(session, temp_data)
				send_message(phone, "Please send your files. Type 'done' when finished.")
			elif message == "attach_no":
				finalize_ticket(phone, session)
			else:
				send_message(phone, "Please select Yes or No.")

		elif step == "WAITING_FOR_ATTACHMENT":
			if message.lower() in ["done", "submit", "save", "close"]:
				finalize_ticket(phone, session)
			elif message:
				if temp_data.get("description"):
					temp_data["description"] += f"\n\n{message}"
				else:
					temp_data["description"] = message
				set_temp_data(session, temp_data)

	except Exception:
		frappe.log_error(
			title=f"WhatsApp Ticket Flow Error: {session.name}",
			message=frappe.get_traceback(),
			reference_doctype="WhatsApp Session",
			reference_name=session.name,
		)


def finalize_ticket(phone, session):
	try:
		temp_data = get_temp_data(session)
		email = temp_data.get("email")

		frappe.set_user(email)

		customer = temp_data.get("customer")

		if not customer:
			customer = frappe.get_doc(
				{
					"doctype": "HD Customer",
					"customer_name": temp_data.get("customer_name"),
					"site_domain": temp_data.get("site_domain"),
				}
			)
			customer.insert(ignore_permissions=True)
			link_customer_to_contact(phone, customer.name)
			customer = customer.name

		ticket = frappe.get_doc(
			{
				"doctype": "HD Ticket",
				"customer": customer,
				"ticket_type": temp_data.get("ticket_type"),
				"subject": temp_data.get("subject"),
				"description": temp_data.get("description"),
			}
		)
		ticket.insert()

		attachments_data = temp_data.get("pending_attachments", [])

		if not attachments_data:
			all_messages = frappe.get_all(
				"WhatsApp Message",
				filters={
					"whatsapp_session": session.name,
					"type": "Incoming",
					"creation": [">", temp_data.get("attachments_start_time")],
				},
				fields=["name", "message"],
				order_by="creation asc",
			)

			for msg in all_messages:
				files = frappe.get_all(
					"File",
					filters={
						"attached_to_doctype": "WhatsApp Message",
						"attached_to_name": msg.name,
					},
					fields=["file_url", "file_name"],
				)
				if files:
					attachments_data.append({"message": msg.message or "", "files": files})

		if attachments_data:
			html_content = "<h3>Attachments</h3>\n"

			for item in attachments_data:
				msg_text = item.get("message", "")
				files = item.get("files", [])

				if msg_text:
					html_content += f"<p>{msg_text}</p>\n"

				for file in files:
					file_url = file.get("file_url") if isinstance(file, dict) else file
					file_name = (
						file.get("file_name", "Attachment") if isinstance(file, dict) else "Attachment"
					)

					if any(
						ext in file_name.lower() for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]
					):
						html_content += f'<p><img src="{file_url}" alt="{file_name}" style="max-width: 100%; height: auto;"></p>\n'
					else:
						html_content += f'<p><a href="{file_url}">{file_name}</a></p>\n'
		else:
			html_content = "<h3>Attachments</h3>\n"

		frappe.get_doc(
			{
				"doctype": "HD Ticket Comment",
				"reference_ticket": ticket.name,
				"content": html_content,
				"commented_by": email,
			}
		).insert(ignore_permissions=True)

		session.db_set("state", None, update_modified=False)
		session.db_set("temp_data", json.dumps({}), update_modified=False)

		ticket_url = frappe.utils.get_url(f"/helpdesk/tickets/{ticket.name}")

		msg = "Ticket Raised Successfully!\n\n"
		msg += f"Ticket ID: {ticket.name}\n"
		msg += f"Ticket Link: {ticket_url}\n"
		msg += f"Subject: {ticket.subject}\n"
		if ticket.ticket_type:
			msg += f"Type: {ticket.ticket_type}\n"
		msg += "Support team will contact you soon.\n\n"
		msg += "Type 'menu' to return to main menu."

		send_message(phone, msg)

	except Exception:
		frappe.log_error(
			title=f"Ticket Finalize Error: {session.name}",
			message=frappe.get_traceback(),
		)
		send_message(phone, "Error creating ticket. Please contact support.")
