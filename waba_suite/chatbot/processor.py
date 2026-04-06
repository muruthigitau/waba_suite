import re
import json
import html
import frappe
from frappe import _
from datetime import datetime

_processing_messages = set()


class ChatbotProcessor:
    def __init__(self, message_data):
        try:
            self.message_data = message_data
            self.message_name = message_data.get("name")
            self.phone_number = message_data.get("from") or message_data.get("from_")
            self.message_text = message_data.get("message") or ""
            self.content_type = message_data.get("content_type") or "text"
            self.account = message_data.get("whatsapp_account")
            self.button_payload = None
            self.flow_response = None

            if self.content_type == "button":
                self.button_payload = self.message_text

            if self.content_type == "flow":
                flow_response_data = message_data.get("flow_response")
                if flow_response_data:
                    import json

                    if isinstance(flow_response_data, str):
                        try:
                            self.flow_response = json.loads(flow_response_data)
                        except json.JSONDecodeError:
                            self.flow_response = {}
                    else:
                        self.flow_response = flow_response_data

            self.settings = None
        except Exception:
            frappe.log_error(
                title="ChatbotProcessor Init Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=message_data.get("name"),
            )

    def get_chatbot_settings(self):
        if self.settings is not None:
            return self.settings

        try:
            settings_name = frappe.db.get_value(
                "WhatsApp Chatbot Settings",
                {"enabled": 1, "process_all_accounts": 1},
                "name",
            )

            if not settings_name and self.account:
                settings_name = frappe.db.get_value(
                    "WhatsApp Chatbot Settings",
                    {"enabled": 1, "whatsapp_account": self.account},
                    "name",
                )

            if settings_name:
                self.settings = frappe.get_doc(
                    "WhatsApp Chatbot Settings", settings_name
                )
                return self.settings

        except Exception:
            frappe.log_error(
                title="Get Chatbot Settings Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.message_name,
            )

        self.settings = False
        return None

    def should_process(self):
        try:
            settings = self.get_chatbot_settings()

            if not settings:
                return False

            if self.content_type not in ["text", "button", "flow"]:
                return False

            if not settings.process_all_accounts:
                if self.account != settings.whatsapp_account:
                    return False

            excluded = [row.phone_number for row in settings.excluded_numbers]
            if self.phone_number in excluded:
                return False

            if self.is_transferred_to_agent():
                return False

            return True
        except Exception:
            frappe.log_error(
                title="Chatbot Should Process Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.message_name,
            )
            return False

    def is_transferred_to_agent(self):
        try:
            return frappe.db.exists(
                "WhatsApp Agent Transfer",
                {"phone_number": self.phone_number, "status": "Active"},
            )
        except Exception:
            return False

    def process(self):
        try:
            settings = self.get_chatbot_settings()

            if not settings or not self.should_process():
                return

            if settings.business_hours_only:
                if not self.is_business_hours():
                    if settings.out_of_hours_message:
                        self.send_response(settings.out_of_hours_message)
                    return

            from waba_suite.chatbot.session_manager import SessionManager
            from waba_suite.chatbot.keyword_matcher import KeywordMatcher
            from waba_suite.chatbot.flow_engine import FlowEngine

            session_mgr = SessionManager(self.phone_number, self.account)
            keyword_matcher = KeywordMatcher(self.account)
            flow_engine = FlowEngine(self.phone_number, self.account)

            response = None

            active_session = session_mgr.get_active_session()
            if active_session:
                if self.content_type == "flow" and self.flow_response:
                    response = self.process_flow_response_in_session(
                        active_session, flow_engine
                    )
                else:
                    response = flow_engine.process_input(
                        active_session, self.message_text, self.button_payload
                    )
                if response:
                    self.send_response(response)
                    return

            keyword_match = keyword_matcher.match(self.message_text)
            if keyword_match:
                if keyword_match.response_type == "Flow":
                    response = flow_engine.start_flow(keyword_match.trigger_flow)
                else:
                    response = self.build_keyword_response(keyword_match)

                if response:
                    self.send_response(response)
                    return

            flow_trigger = flow_engine.check_flow_trigger(
                self.message_text, self.button_payload
            )
            if flow_trigger:
                response = flow_engine.start_flow(flow_trigger)
                if response:
                    self.send_response(response)
                    return

            if settings.enable_ai:
                try:
                    from waba_suite.chatbot.ai_responder import AIResponder

                    ai_responder = AIResponder(settings, phone_number=self.phone_number)
                    response = ai_responder.generate_response(
                        self.message_text, session_mgr.get_conversation_history()
                    )
                    if response:
                        self.send_response(response)
                        return
                except Exception:
                    frappe.log_error(
                        title="AI Responder Error",
                        message=frappe.get_traceback(),
                        reference_doctype="WhatsApp Message",
                        reference_name=self.message_name,
                    )
                    frappe.db.rollback()

            if settings.default_response:
                self.send_response(settings.default_response)
        except Exception:
            frappe.log_error(
                title="Chatbot Main Process Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.message_name,
            )

    def send_response(self, response):
        try:
            if isinstance(response, str):
                msg = frappe.get_doc(
                    {
                        "doctype": "WhatsApp Message",
                        "type": "Outgoing",
                        "to": self.phone_number,
                        "message": response,
                        "content_type": "text",
                        "whatsapp_account": self.account,
                    }
                )
                msg.flags.ignore_chatbot = True
                msg.insert(ignore_permissions=True)

            elif isinstance(response, dict):
                msg_data = {
                    "doctype": "WhatsApp Message",
                    "type": "Outgoing",
                    "to": self.phone_number,
                    "whatsapp_account": self.account,
                }
                msg_data.update(response)
                msg = frappe.get_doc(msg_data)
                msg.flags.ignore_chatbot = True
                msg.insert(ignore_permissions=True)

        except Exception:
            frappe.log_error(
                title="Chatbot send_response error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.message_name,
            )

    def process_flow_response_in_session(self, session, flow_engine):
        try:
            import json

            flow = frappe.get_doc("WhatsApp Chatbot Flow", session.current_flow)

            current_step = None
            for step in flow.steps:
                if step.step_name == session.current_step:
                    current_step = step
                    break

            if not current_step:
                return flow_engine.complete_flow(session, flow)

            if current_step.input_type != "WhatsApp Flow":
                return flow_engine.process_input(
                    session, self.message_text, self.button_payload
                )

            session_data = flow_engine.process_flow_response(
                current_step, session, self.flow_response
            )
            session.session_data = json.dumps(session_data)

            session.add_message(
                "Incoming",
                f"Flow completed: {self.message_text}",
                current_step.step_name,
            )

            return flow_engine.process_input(session, self.message_text, None)

        except Exception:
            frappe.log_error(
                title="Process Flow Response In Session Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Session",
                reference_name=session.name,
            )
            return "An error occurred processing your form. Please try again."

    def build_keyword_response(self, keyword_doc):
        try:
            if keyword_doc.response_type == "Text":
                return keyword_doc.response_text

            elif keyword_doc.response_type == "Template":
                response = {
                    "use_template": 1,
                    "template": keyword_doc.response_template,
                    "message_type": "Template",
                }
                if keyword_doc.template_parameters:
                    response["body_param"] = keyword_doc.template_parameters
                return response

            elif keyword_doc.response_type == "Media":
                return {
                    "content_type": (
                        keyword_doc.media_type.lower()
                        if keyword_doc.media_type
                        else "image"
                    ),
                    "media_image": (
                        keyword_doc.media_url
                        if keyword_doc.media_type == "Image"
                        else None
                    ),
                    "media_video": (
                        keyword_doc.media_url
                        if keyword_doc.media_type == "Video"
                        else None
                    ),
                    "media_audio": (
                        keyword_doc.media_url
                        if keyword_doc.media_type == "Audio"
                        else None
                    ),
                    "media_document": (
                        keyword_doc.media_url
                        if keyword_doc.media_type == "Document"
                        else None
                    ),
                    "message": keyword_doc.media_caption or "",
                }

            elif keyword_doc.response_type == "Script":
                return self.execute_script(keyword_doc.script)

            return None
        except Exception:
            frappe.log_error(
                title="Build Keyword Response Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Keyword",
                reference_name=keyword_doc.name,
            )
            return None

    def execute_script(self, script):
        if not script:
            return None

        try:
            message_doc = frappe.get_doc("WhatsApp Message", self.message_name)

            if frappe.db.exists(
                "Server Script", {"name": script, "script_type": "API"}
            ):
                server_script = frappe.get_doc("Server Script", script)
                from frappe.utils.safe_exec import safe_exec

                _locals = {
                    "doc": message_doc,
                    "phone_number": self.phone_number,
                    "message": self.message_text,
                    "account": self.account,
                    "response": None,
                }
                safe_exec(
                    server_script.script,
                    _locals=_locals,
                    script_filename=server_script.name,
                )
                if _locals.get("response"):
                    return _locals.get("response")
                elif frappe.response.get("message"):
                    return frappe.response.get("message")
                return None
            else:
                return frappe.call(script, doc=message_doc)

        except Exception:
            frappe.log_error(
                title="Chatbot Script Execution Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.message_name,
            )
            return None

    def is_business_hours(self):
        try:
            settings = self.get_chatbot_settings()
            if not settings or not settings.business_hours:
                return True

            now = datetime.now()
            current_time = now.time()
            day_name = now.strftime("%A")

            for row in settings.business_hours:
                if row.day == day_name:
                    if not row.enabled:
                        return False

                    start = self._parse_time(row.start_time)
                    end = self._parse_time(row.end_time)

                    if start and end:
                        return start <= current_time <= end
                    return True

            return False

        except Exception:
            frappe.log_error(
                title="Is Business Hours Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.message_name,
            )
            return True

    def _parse_time(self, time_value):
        if not time_value:
            return None

        try:
            if isinstance(time_value, str):
                from datetime import time

                parts = time_value.split(":")
                return time(
                    int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0
                )
            return time_value
        except Exception:
            frappe.log_error(
                title="Parse Time Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.message_name,
            )
            return None


def process_incoming_message(doc):
    global _processing_messages

    try:
        if getattr(doc, "type", None) != "Incoming":
            return

        if getattr(doc.flags, "ignore_chatbot", False):
            return

        doc_name = getattr(doc, "name", None)
        if not doc_name or doc_name in _processing_messages:
            return

        content_type = getattr(doc, "content_type", None)
        if content_type not in ["text", "button", "flow"]:
            return

        try:
            whatsapp_account = getattr(doc, "whatsapp_account", None)
            filters = [["enabled", "=", 1], ["process_all_accounts", "=", 1]]
            if whatsapp_account:
                filters = [
                    "or",
                    filters,
                    [["enabled", "=", 1], ["whatsapp_account", "=", whatsapp_account]],
                ]
            if not frappe.db.exists("WhatsApp Chatbot Settings", filters):
                return
        except Exception:
            return

        message_data = {
            "name": doc_name,
            "from": getattr(doc, "from", None) or getattr(doc, "from_", None),
            "message": getattr(doc, "message", "") or "",
            "content_type": content_type or "text",
            "whatsapp_account": whatsapp_account,
            "type": "Incoming",
            "flow_response": getattr(doc, "flow_response", None),
        }

        _processing_messages.add(doc_name)

        try:
            processor = ChatbotProcessor(message_data)
            processor.process()
        finally:
            _processing_messages.discard(doc_name)

    except Exception:
        frappe.log_error(
            title="Hook process_incoming_message error",
            message=frappe.get_traceback(),
            reference_doctype="WhatsApp Message",
            reference_name=getattr(doc, "name", "unknown"),
        )


def run_processor(message_data):
    global _processing_messages
    message_name = message_data.get("name", "unknown")

    try:
        processor = ChatbotProcessor(message_data)
        processor.process()
    except Exception:
        frappe.log_error(
            title="run_processor error",
            message=frappe.get_traceback(),
            reference_doctype="WhatsApp Message",
            reference_name=message_name,
        )
    finally:
        _processing_messages.discard(message_name)
