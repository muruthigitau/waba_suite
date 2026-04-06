import frappe
from datetime import datetime, timedelta


class SessionManager:
    def __init__(self, phone_number, whatsapp_account):
        try:
            self.phone_number = phone_number
            self.account = whatsapp_account
            self.timeout_minutes = self.get_timeout()
        except Exception:
            frappe.log_error(
                title="SessionManager Init Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Session",
            )

    def get_timeout(self):
        try:
            if frappe.db.exists("WhatsApp Chatbot Settings"):
                settings = frappe.get_single("WhatsApp Chatbot Settings")
                return settings.session_timeout_minutes or 30
        except Exception:
            frappe.log_error(
                title="Get Timeout Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Settings",
            )
        return 30

    def get_active_session(self):
        try:
            self.expire_old_sessions()

            session = frappe.db.get_value(
                "WhatsApp Chatbot Session",
                {
                    "phone_number": self.phone_number,
                    "whatsapp_account": self.account,
                    "status": "Active",
                },
                "name",
            )

            if session:
                return frappe.get_doc("WhatsApp Chatbot Session", session)

            return None

        except Exception:
            frappe.log_error(
                title="Get Active Session Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Session",
            )
            return None

    def expire_old_sessions(self):
        try:
            timeout_threshold = datetime.now() - timedelta(minutes=self.timeout_minutes)

            expired = frappe.get_all(
                "WhatsApp Chatbot Session",
                filters={"status": "Active", "last_activity": ["<", timeout_threshold]},
                pluck="name",
            )

            for session_name in expired:
                session = frappe.get_doc("WhatsApp Chatbot Session", session_name)
                session.status = "Timeout"
                session.completed_at = datetime.now()
                session.save(ignore_permissions=True)

                if session.current_flow:
                    flow = frappe.get_doc("WhatsApp Chatbot Flow", session.current_flow)
                    if flow.timeout_message:
                        self.send_timeout_message(session, flow.timeout_message)

        except Exception:
            frappe.log_error(
                title="Expire Old Sessions Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Session",
            )

    def send_timeout_message(self, session, message):
        try:
            frappe.get_doc(
                {
                    "doctype": "WhatsApp Message",
                    "type": "Outgoing",
                    "to": session.phone_number,
                    "message": message,
                    "content_type": "text",
                    "whatsapp_account": session.whatsapp_account,
                }
            ).insert(ignore_permissions=True)
        except Exception:
            frappe.log_error(
                title="Send Timeout Message Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Session",
                reference_name=session.name,
            )

    def get_conversation_history(self, limit=20):
        try:
            messages = frappe.get_all(
                "WhatsApp Message",
                filters={"whatsapp_account": self.account, "content_type": "text"},
                or_filters=[
                    ["from", "=", self.phone_number],
                    ["to", "=", self.phone_number],
                ],
                fields=["type", "message", "creation"],
                order_by="creation desc",
                limit=limit,
            )

            history = []
            for msg in reversed(messages):
                history.append(
                    {
                        "direction": (
                            "Incoming" if msg.type == "Incoming" else "Outgoing"
                        ),
                        "message": msg.message,
                        "timestamp": msg.creation,
                    }
                )

            return history

        except Exception:
            frappe.log_error(
                title="Get Conversation History Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
            )
            return []


def cleanup_expired_sessions():
    try:
        if not frappe.db.exists("WhatsApp Chatbot Settings"):
            return

        settings = frappe.get_single("WhatsApp Chatbot Settings")
        if not settings.enabled:
            return

        timeout_minutes = settings.session_timeout_minutes or 30
        timeout_threshold = datetime.now() - timedelta(minutes=timeout_minutes)

        expired_sessions = frappe.get_all(
            "WhatsApp Chatbot Session",
            filters={"status": "Active", "last_activity": ["<", timeout_threshold]},
            fields=["name", "phone_number", "whatsapp_account", "current_flow"],
        )

        for session_data in expired_sessions:
            try:
                session = frappe.get_doc("WhatsApp Chatbot Session", session_data.name)
                session.status = "Timeout"
                session.completed_at = datetime.now()
                session.save(ignore_permissions=True)

                if session_data.current_flow:
                    flow = frappe.get_doc(
                        "WhatsApp Chatbot Flow", session_data.current_flow
                    )
                    if flow.timeout_message:
                        frappe.get_doc(
                            {
                                "doctype": "WhatsApp Message",
                                "type": "Outgoing",
                                "to": session_data.phone_number,
                                "message": flow.timeout_message,
                                "content_type": "text",
                                "whatsapp_account": session_data.whatsapp_account,
                            }
                        ).insert(ignore_permissions=True)

            except Exception:
                frappe.log_error(
                    title=f"Cleanup Expired Sessions Loop Error: {session_data.name}",
                    message=frappe.get_traceback(),
                    reference_doctype="WhatsApp Chatbot Session",
                    reference_name=session_data.name,
                )

    except Exception:
        frappe.log_error(
            title="Cleanup Expired Sessions Scheduled Job Error",
            message=frappe.get_traceback(),
            reference_doctype="WhatsApp Chatbot Settings",
        )
