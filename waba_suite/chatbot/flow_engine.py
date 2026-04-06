import frappe
import json
import re
from datetime import datetime


def parse_json(value, default=None):
    """Safely parse JSON - handles both string and already-parsed dict/list."""
    if value is None:
        return default if default is not None else {}
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return default if default is not None else {}
    return default if default is not None else {}


class FlowEngine:
    def __init__(self, phone_number, whatsapp_account):
        self.phone_number = phone_number
        self.account = whatsapp_account

    def check_flow_trigger(self, message_text, button_payload=None):
        try:
            flows = frappe.get_all(
                "WhatsApp Chatbot Flow",
                filters={"enabled": 1},
                fields=[
                    "name",
                    "trigger_keywords",
                    "trigger_on_button",
                    "whatsapp_account",
                ],
            )

            for flow in flows:
                if flow.whatsapp_account and flow.whatsapp_account != self.account:
                    continue

                if button_payload and flow.trigger_on_button:
                    if button_payload == flow.trigger_on_button:
                        return flow.name

                if flow.trigger_keywords and message_text:
                    keywords = [
                        k.strip().lower()
                        for k in flow.trigger_keywords.split(",")
                        if k.strip()
                    ]
                    if message_text.lower() in keywords:
                        return flow.name

            return None
        except Exception:
            frappe.log_error(
                title="FlowEngine Trigger Check Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
            )
            return None

    def start_flow(self, flow_name):
        try:
            flow = frappe.get_doc("WhatsApp Chatbot Flow", flow_name)

            if not flow.steps:
                frappe.log_error(
                    title="Flow Start Error: No Steps",
                    message=f"Flow '{flow_name}' has no defined steps.",
                    reference_doctype="WhatsApp Chatbot Flow",
                    reference_name=flow_name,
                )
                return None

            first_step = sorted(flow.steps, key=lambda x: x.idx)[0]

            session = frappe.get_doc(
                {
                    "doctype": "WhatsApp Chatbot Session",
                    "phone_number": self.phone_number,
                    "whatsapp_account": self.account,
                    "status": "Active",
                    "current_flow": flow_name,
                    "current_step": first_step.step_name,
                    "session_data": json.dumps({}),
                    "started_at": datetime.now(),
                    "last_activity": datetime.now(),
                }
            )
            session.insert(ignore_permissions=True)

            if flow.initial_message_type == "Template" and flow.initial_template:
                return {
                    "use_template": 1,
                    "template": flow.initial_template,
                    "message_type": "Template",
                }

            messages = []
            if flow.initial_message:
                messages.append(flow.initial_message)

            step_msg = self.build_step_message(first_step, session)
            if isinstance(step_msg, str):
                messages.append(step_msg)
                return "\n\n".join(messages) if messages else step_msg
            else:
                return step_msg

        except Exception:
            frappe.log_error(
                title="FlowEngine Start Flow Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
                reference_name=flow_name,
            )
            return None

    def process_input(self, session, user_input, button_payload=None):
        try:
            flow = frappe.get_doc("WhatsApp Chatbot Flow", session.current_flow)

            if flow.cancel_keywords:
                cancel_words = [
                    w.strip().lower()
                    for w in flow.cancel_keywords.split(",")
                    if w.strip()
                ]
                if user_input.lower() in cancel_words:
                    session.status = "Cancelled"
                    session.completed_at = datetime.now()
                    session.save(ignore_permissions=True)
                    return "Your request has been cancelled."

            current_step = None
            for step in flow.steps:
                if step.step_name == session.current_step:
                    current_step = step
                    break

            if not current_step:
                return self.complete_flow(session, flow)

            # Validate input
            input_value = button_payload or user_input

            if current_step.input_type and current_step.input_type != "None":
                is_valid, error = self.validate_input(current_step, user_input, button_payload)

                if not is_valid:
                    # Handle retry
                    session.step_retries = (session.step_retries or 0) + 1
                    max_retries = current_step.max_retries or 3

                    if current_step.retry_on_invalid and session.step_retries < max_retries:
                        session.save(ignore_permissions=True)
            
                        return error or current_step.validation_error or "Invalid input. Please try again."
                    else:
                        # Max retries reached, cancel flow
                        session.status = "Cancelled"
                        session.completed_at = datetime.now()
                        session.save(ignore_permissions=True)
            
                        return "Too many invalid attempts. Please start again."

                # Store input
                if current_step.store_as:
                    session_data = parse_json(session.session_data, {})
                    session_data[current_step.store_as] = input_value
                    session.session_data = json.dumps(session_data)

            # Log message in session
            session.add_message("Incoming", user_input, current_step.step_name)

            # Determine next step
            next_step_name = self.get_next_step(current_step, flow.steps, user_input, button_payload)

            if not next_step_name:
                # No next step, complete flow
                session.save(ignore_permissions=True)
    
                return self.complete_flow(session, flow)

            # Find next step
            next_step = None
            for step in flow.steps:
                if step.step_name == next_step_name:
                    next_step = step
                    break

            if not next_step:
                return self.complete_flow(session, flow)

            session_data = parse_json(session.session_data, {})
            if next_step.skip_condition:
                if self.evaluate_skip_condition(
                    next_step.skip_condition, session_data, next_step.step_name
                ):
                    next_step_name = self.get_next_step(
                        next_step, flow.steps, None, None
                    )
                    if not next_step_name:
                        return self.complete_flow(session, flow)
                    for step in flow.steps:
                        if step.step_name == next_step_name:
                            next_step = step
                            break

            session.current_step = next_step.step_name
            session.step_retries = 0
            session.last_activity = datetime.now()
            session.save(ignore_permissions=True)

            response = self.build_step_message(next_step, session)

            if isinstance(response, str):
                session.add_message("Outgoing", response, next_step.step_name)
            session.save(ignore_permissions=True)

            return response

        except Exception:
            frappe.log_error(
                title="FlowEngine Process Input Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Session",
                reference_name=session.name,
            )
            return "An error occurred. Please try again later."

    def validate_input(self, step, user_input, button_payload):
        try:
            input_type = step.input_type
            if input_type == "Button":
                if button_payload or user_input:
                    return True, None
                return False, "Please tap a button to continue."

            if input_type == "WhatsApp Flow":
                if user_input:
                    return True, None
                return False, "Please complete the form."

            if input_type == "None":
                return True, None

            if not user_input:
                return False, "Please provide a response."

            if input_type == "Select":
                if step.options:
                    options = [
                        o.strip().lower() for o in step.options.split("|") if o.strip()
                    ]
                    if user_input.lower() not in options:
                        return (
                            False,
                            f"Please choose one of: {step.options.replace('|', ', ')}",
                        )

            elif input_type == "Number":
                cleaned = user_input.replace(",", "").replace(" ", "")
                if not re.match(r"^-?\d+\.?\d*$", cleaned):
                    return False, "Please enter a valid number."

            elif input_type == "Email":
                if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", user_input.strip()):
                    return False, "Please enter a valid email address."

            elif input_type == "Phone":
                cleaned = re.sub(r"[\s\-\(\)]", "", user_input)
                if not re.match(r"^\+?\d{10,15}$", cleaned):
                    return False, "Please enter a valid phone number."

            elif input_type == "Date":
                date_formats = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"]
                valid_date = False
                for fmt in date_formats:
                    try:
                        datetime.strptime(user_input.strip(), fmt)
                        valid_date = True
                        break
                    except ValueError:
                        continue
                if not valid_date:
                    return False, "Please enter a valid date (e.g., DD-MM-YYYY)."

            if step.validation_regex:
                try:
                    if not re.match(step.validation_regex, user_input):
                        return False, step.validation_error or "Invalid format."
                except re.error:
                    pass

            return True, None
        except Exception:
            frappe.log_error(
                title="Input Validation Logic Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
                reference_name=step.parent,
            )
            return False, "Validation system error."

    def get_next_step(self, current_step, all_steps, user_input, button_payload):
        try:
            if current_step.conditional_next:
                conditions = parse_json(current_step.conditional_next, {})
                if conditions:
                    response_key = button_payload or (
                        user_input.lower() if user_input else ""
                    )
                    if response_key in conditions:
                        return conditions[response_key]
                    if "default" in conditions:
                        return conditions["default"]

            if current_step.next_step:
                return current_step.next_step

            sorted_steps = sorted(all_steps, key=lambda x: x.idx)
            current_idx = None
            for i, step in enumerate(sorted_steps):
                if step.step_name == current_step.step_name:
                    current_idx = i
                    break

            if current_idx is not None and current_idx < len(sorted_steps) - 1:
                return sorted_steps[current_idx + 1].step_name

            return None
        except Exception:
            frappe.log_error(
                title="Get Next Step Calculation Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
                reference_name=current_step.parent,
            )
            return None

    def build_step_message(self, step, session):
        try:
            message = step.message or ""
            session_data = parse_json(session.session_data, {})
            for key, value in session_data.items():
                message = message.replace(f"{{{key}}}", str(value))

            if step.message_type == "Template" and step.template:
                return {
                    "use_template": 1,
                    "template": step.template,
                    "message_type": "Template",
                }

            if step.message_type == "Script" and step.response_script:
                script_response = self.run_response_script(
                    step.response_script, session_data, session
                )
                if script_response:
                    return script_response
                return message

            if step.input_type == "Button" and step.buttons:
                buttons = parse_json(step.buttons, [])
                if buttons:
                    return {
                        "message": message,
                        "content_type": "interactive",
                        "buttons": (
                            json.dumps(buttons)
                            if isinstance(buttons, list)
                            else buttons
                        ),
                    }

            if step.input_type == "WhatsApp Flow" and step.whatsapp_flow:
                return {
                    "message": message,
                    "content_type": "flow",
                    "flow": step.whatsapp_flow,
                    "flow_cta": step.flow_cta or "Open Form",
                    "flow_screen": step.flow_screen or None,
                }

            if step.input_type == "Select" and step.options:
                options_list = step.options.replace("|", ", ")
                message += f"\n\nOptions: {options_list}"

            return message
        except Exception:
            frappe.log_error(
                title="Build Step Message Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
                reference_name=step.parent,
            )
            return "Error loading message."

    def evaluate_skip_condition(self, condition, data, step_name):
        try:
            eval_globals = {
                "data": data,
                "len": len,
                "str": str,
                "int": int,
                "float": float,
                "bool": bool,
            }
            return frappe.safe_eval(
                condition, eval_globals=eval_globals, eval_locals={}
            )
        except Exception:
            frappe.log_error(
                title=f"Skip Condition Evaluation Error: {step_name}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
            )
            return False

    def complete_flow(self, session, flow):
        try:
            session.status = "Completed"
            session.completed_at = datetime.now()
            session.save(ignore_permissions=True)

            session_data = parse_json(session.session_data, {})

            if flow.on_complete_action == "Create Document":
                self.create_document(flow, session_data)
            elif flow.on_complete_action == "Call API":
                self.call_api(flow.api_endpoint, session_data, flow.name)
            elif flow.on_complete_action == "Run Script":
                self.run_script(flow.custom_script, session_data, flow.name)

            completion_msg = (
                flow.completion_message or "Thank you! Your request has been submitted."
            )
            for key, value in session_data.items():
                completion_msg = completion_msg.replace(f"{{{key}}}", str(value))

            return completion_msg

        except Exception:
            frappe.log_error(
                title="Flow Completion Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Session",
                reference_name=session.name,
            )
            return "Thank you! Your request has been received."

    def create_document(self, flow, data):
        try:
            if not flow.create_doctype or not flow.field_mapping:
                return

            mapping = parse_json(flow.field_mapping, {})
            if not mapping:
                return

            doc_data = {"doctype": flow.create_doctype}
            for field, variable in mapping.items():
                if variable in data:
                    doc_data[field] = data[variable]

            if len(doc_data) > 1:
                doc = frappe.get_doc(doc_data)
                doc.insert(ignore_permissions=True)

        except Exception:
            frappe.log_error(
                title="Flow Create Document Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
                reference_name=flow.name,
            )

    def call_api(self, endpoint, data, flow_name):
        try:
            import requests

            response = requests.post(
                endpoint,
                json=data,
                timeout=30,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
        except Exception:
            frappe.log_error(
                title="Flow Call API Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
                reference_name=flow_name,
            )

    def run_script(self, script, data, flow_name):
        try:
            eval_globals = {"data": data, "frappe": frappe, "json": json}
            exec(script, eval_globals)
        except Exception:
            frappe.log_error(
                title="Flow Run Script Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
                reference_name=flow_name,
            )

    def process_flow_response(self, step, session, flow_response):
        try:
            session_data = parse_json(session.session_data, {})
            if not flow_response:
                return session_data

            field_mapping = parse_json(step.flow_field_mapping, {})
            if field_mapping:
                for session_var, flow_field in field_mapping.items():
                    if flow_field in flow_response:
                        session_data[session_var] = flow_response[flow_field]
            else:
                for key, value in flow_response.items():
                    session_data[key] = value

            if step.store_as:
                session_data[step.store_as] = flow_response

            return session_data
        except Exception:
            frappe.log_error(
                title="Process Flow Response Data Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Flow",
                reference_name=step.parent,
            )
            return parse_json(session.session_data, {})

    def run_response_script(self, script, data, session):
        try:
            eval_globals = {
                "data": data,
                "frappe": frappe,
                "json": json,
                "session": session,
                "phone_number": self.phone_number,
                "response": None,
            }
            exec(script, eval_globals)
            return eval_globals.get("response")
        except Exception:
            frappe.log_error(
                title="Step Response Script Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Session",
                reference_name=session.name,
            )
            return None
