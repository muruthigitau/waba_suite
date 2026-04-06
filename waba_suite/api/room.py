from datetime import timedelta
import frappe
import json

from ..chatbot.processor import process_incoming_message


def route_incoming_message(doc, session):

    message = (doc.message or "").strip().lower()

    if message == "stop":
        close_session(session)
        send_message(doc.get("from"), "Session ended. Type 'hi' to start again.")
        return

    if message in ["hi", "menu", "start"]:
        session.state = None
        session.save(ignore_permissions=True)
        send_main_menu(doc.get("from"), session)
        return

    if message == "ai_support":
        session.state = "AI_CHAT"
        session.save(ignore_permissions=True)
        return process_incoming_message(doc)

    elif message == "order":
        session.state = "ORDERING"
        session.save(ignore_permissions=True)
        return handle_order_flow(doc, session)

    elif message == "agent":
        session.state = "HUMAN"
        session.save(ignore_permissions=True)
        return handle_agent_flow(doc, session)

    elif message == "ticket":
        session.state = "TICKETING"
        session.save(ignore_permissions=True)
        return handle_ticket_flow(doc, session)

    if session.state == "AI_CHAT":
        return process_incoming_message(doc)

    elif session.state == "ORDERING":
        return handle_order_flow(doc, session)

    elif session.state == "HUMAN":
        return handle_agent_flow(doc, session)

    elif session.state == "TICKETING":
        return handle_ticket_flow(doc, session)

    send_main_menu(doc.get("from"), session)


def get_or_create_session(doc):
    phone = doc.get("from")
    now = frappe.utils.now_datetime()

    session = frappe.get_all(
        "WhatsApp Session",
        filters={"phone": phone, "status": "Active"},
        fields=["name", "expires_at"],
        order_by="creation desc",
        limit=1,
    )

    if session:
        session = frappe.get_doc("WhatsApp Session", session[0].name)

        if session.expires_at and now <= session.expires_at:
            update_session(session, doc)
            return session, False

        close_session(session)

    new_session = create_session(doc)
    update_session(new_session, doc)

    return new_session, True


def create_session(doc):
    now = frappe.utils.now_datetime()

    contact = frappe.db.get_value("WhatsApp Contact", {"mobile_no": doc.get("from")})

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
        }
    )

    session.insert(ignore_permissions=True)
    return session


def update_session(session, message_doc):
    session.last_interaction = frappe.utils.now_datetime()
    session.last_message = message_doc.name
    session.save(ignore_permissions=True)


def close_session(session):
    session.status = "Expired"
    session.ended_by_system = 1
    session.save(ignore_permissions=True)


def send_message(to, message):
    frappe.get_doc(
        {
            "doctype": "WhatsApp Message",
            "to": to,
            "type": "Outgoing",
            "content_type": "text",
            "message": message,
        }
    ).insert(ignore_permissions=True)


def send_main_menu(phone, session=None):
    buttons = [
        {"id": "ai_support", "title": "🤖 Ask AI Support"},
        {"id": "agent", "title": "👨‍💼 Talk to an Agent"},
        {"id": "ticket", "title": "🎫 Raise a Ticket"},
        {"id": "order", "title": "🛒 Place an Order"},
    ]

    frappe.get_doc(
        {
            "doctype": "WhatsApp Message",
            "to": phone,
            "type": "Outgoing",
            "content_type": "interactive",
            "whatsapp_session": session.name if session else None,
            "message": "Welcome 👋 What would you like to do?",
            "buttons": json.dumps(buttons),
        }
    ).insert(ignore_permissions=True)


def handle_ai_flow(doc):
    from ..chatbot.processor import process_incoming_message

    return process_incoming_message(doc)


def handle_order_flow(doc, session):
    message = (doc.message or "").strip().lower()

    if not session.get("order_step"):
        session.order_step = "ASK_ITEM"
        session.save(ignore_permissions=True)

        return send_message(doc.get("from"), "🛒 What item would you like to order?")

    elif session.order_step == "ASK_ITEM":
        session.order_item = doc.message
        session.order_step = "ASK_QTY"
        session.save(ignore_permissions=True)

        return send_message(doc.get("from"), "How many units?")

    elif session.order_step == "ASK_QTY":
        session.order_qty = doc.message
        session.order_step = "CONFIRM"
        session.save(ignore_permissions=True)

        return send_message(
            doc.get("from"),
            f"Confirm order: {session.order_qty} x {session.order_item}? (yes/no)",
        )

    elif session.order_step == "CONFIRM":
        if message == "yes":
            create_order(session, doc)
            session.order_step = None
            session.state = None
            session.save(ignore_permissions=True)

            return send_message(doc.get("from"), "✅ Order placed successfully!")

        else:
            session.order_step = None
            session.save(ignore_permissions=True)

            return send_message(doc.get("from"), "❌ Order cancelled.")


def create_order(session, doc):
    customer = get_or_create_customer(doc.get("from"))

    order = frappe.get_doc(
        {
            "doctype": "Sales Order",
            "customer": customer,
            "items": [
                {
                    "item_code": session.order_item,
                    "qty": session.order_qty,
                }
            ],
        }
    )

    order.insert(ignore_permissions=True)
    order.submit()


def handle_agent_flow(doc, session):
    send_message(doc.get("from"), "👨‍💼 Connecting you to an agent...")


def handle_ticket_flow(doc, session):
    if not session.get("ticket_step"):
        session.ticket_step = "ASK_ISSUE"
        session.save(ignore_permissions=True)

        return send_message(doc.get("from"), "🎫 Please describe your issue.")

    elif session.ticket_step == "ASK_ISSUE":
        issue = frappe.get_doc(
            {
                "doctype": "Issue",
                "subject": doc.message,
            }
        ).insert(ignore_permissions=True)

        session.ticket_step = None
        session.state = None
        session.save(ignore_permissions=True)

        return send_message(doc.get("from"), f"✅ Ticket created: {issue.name}")


def get_or_create_customer(phone):
    if frappe.db.exists("Customer", phone):
        return phone

    doc = frappe.get_doc(
        {
            "doctype": "Customer",
            "customer_name": phone,
        }
    )
    doc.insert(ignore_permissions=True)

    return doc.name
