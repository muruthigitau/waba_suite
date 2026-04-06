import frappe
import json


class AIResponder:
    def __init__(self, settings, phone_number=None):
        try:
            self.settings = settings
            self.phone_number = phone_number
            self.provider = settings.ai_provider
            self.api_key = (
                settings.get_password("ai_api_key") if settings.ai_api_key else None
            )
            self.model = settings.ai_model or "gpt-4o-mini"
            self.system_prompt = (
                settings.ai_system_prompt or "You are a helpful assistant."
            )
            self.max_tokens = settings.ai_max_tokens or 500
            self.temperature = settings.ai_temperature or 0.7
            self.include_history = settings.ai_include_history or False
            self.history_limit = settings.ai_history_limit or 4
        except Exception:
            frappe.log_error(
                title="AIResponder Init Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Settings",
                reference_name=settings.name,
            )

    def generate_response(self, message, conversation_history=None):
        if not self.api_key:
            frappe.log_error(
                title="AI Configuration Error",
                message="AI API key not configured in settings.",
                reference_doctype="WhatsApp Chatbot Settings",
                reference_name=self.settings.name,
            )
            return None

        self.current_message = message

        try:
            if self.provider == "OpenAI":
                return self.openai_response(message, conversation_history)
            elif self.provider == "Anthropic":
                return self.anthropic_response(message, conversation_history)
            elif self.provider == "Google":
                return self.google_response(message, conversation_history)
            elif self.provider == "Custom":
                return self.custom_response(message, conversation_history)
        except Exception:
            frappe.log_error(
                title=f"AI Provider Error: {self.provider}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Settings",
                reference_name=self.settings.name,
            )

        return None

    def build_context(self):
        try:
            contexts = frappe.get_all(
                "WhatsApp AI Context",
                filters={"enabled": 1},
                fields=["*"],
                order_by="priority desc",
            )

            context_parts = []
            message_lower = (getattr(self, "current_message", "") or "").lower()

            for ctx in contexts:
                try:
                    if ctx.trigger_keywords:
                        keywords = [
                            k.strip().lower()
                            for k in ctx.trigger_keywords.split(",")
                            if k.strip()
                        ]
                        if keywords and not any(kw in message_lower for kw in keywords):
                            continue

                    if ctx.context_type == "Static Text" and ctx.static_content:
                        context_parts.append(f"[{ctx.title}]\n{ctx.static_content}")
                    elif ctx.context_type == "DocType Query":
                        data = self.query_doctype(ctx)
                        if data:
                            context_parts.append(
                                f"[{ctx.title}]\n{json.dumps(data, separators=(',', ':'), default=str)}"
                            )
                except Exception:
                    frappe.log_error(
                        title=f"Context Building Error: {ctx.title}",
                        message=frappe.get_traceback(),
                        reference_doctype="WhatsApp AI Context",
                        reference_name=ctx.name,
                    )
                    continue

            return "\n\n".join(context_parts) if context_parts else ""

        except Exception:
            frappe.log_error(
                title="AI Context Builder Failure",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Settings",
            )
            return ""

    def query_doctype(self, ctx):
        try:
            target_doctype = ctx.query_doctype
            if not target_doctype:
                return None

            filters = ctx.filters or {}
            if isinstance(filters, str):
                filters = json.loads(filters) if filters else {}

            if ctx.user_specific and ctx.phone_field and self.phone_number:
                phone_variants = self.get_phone_variants(self.phone_number)
                filters[ctx.phone_field] = ["in", phone_variants]

            fields = ["name"]
            if ctx.fields_to_include:
                fields = [
                    f.strip() for f in ctx.fields_to_include.split(",") if f.strip()
                ]

            limit = ctx.max_results or 10

            return frappe.get_all(
                target_doctype, filters=filters, fields=fields, limit=limit
            )
        except Exception:
            frappe.log_error(
                title=f"DocType Query Context Error: {ctx.title}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp AI Context",
                reference_name=ctx.name,
            )
            return None

    def get_phone_variants(self, phone):
        if not phone:
            return []
        try:
            clean = (
                phone.replace(" ", "")
                .replace("-", "")
                .replace("(", "")
                .replace(")", "")
            )
            variants = [phone, clean]

            if clean.startswith("+"):
                variants.append(clean[1:])
            else:
                variants.append("+" + clean)

            if len(clean) > 10:
                variants.append(clean[-10:])

            return list(set(variants))
        except Exception:
            return [phone]

    def openai_response(self, message, conversation_history):
        try:
            import openai

            client = openai.OpenAI(api_key=self.api_key)

            messages = [{"role": "system", "content": self.system_prompt}]
            context = self.build_context()
            if context:
                messages.append(
                    {"role": "system", "content": f"Context info:\n{context}"}
                )

            if self.include_history and conversation_history:
                for msg in conversation_history[-self.history_limit :]:
                    role = "user" if msg["direction"] == "Incoming" else "assistant"
                    msg_text = (
                        msg["message"][:200]
                        if len(msg["message"]) > 200
                        else msg["message"]
                    )
                    messages.append({"role": role, "content": msg_text})

            messages.append({"role": "user", "content": message})

            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
            )
            return response.choices[0].message.content

        except ImportError:
            frappe.log_error(
                title="OpenAI Dependency Missing", message="Run: pip install openai"
            )
            return None
        except Exception:
            frappe.log_error(
                title="OpenAI API Execution Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Settings",
            )
            return None

    def anthropic_response(self, message, conversation_history):
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=self.api_key)
            messages = []

            if self.include_history and conversation_history:
                for msg in conversation_history[-self.history_limit :]:
                    role = "user" if msg["direction"] == "Incoming" else "assistant"
                    msg_text = (
                        msg["message"][:200]
                        if len(msg["message"]) > 200
                        else msg["message"]
                    )
                    messages.append({"role": role, "content": msg_text})

            messages.append({"role": "user", "content": message})

            system = self.system_prompt
            context = self.build_context()
            if context:
                system += f"\n\nContext info:\n{context}"

            response = client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=messages,
            )
            return response.content[0].text

        except ImportError:
            frappe.log_error(
                title="Anthropic Dependency Missing",
                message="Run: pip install anthropic",
            )
            return None
        except Exception:
            frappe.log_error(
                title="Anthropic API Execution Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Settings",
            )
            return None

    def google_response(self, message, conversation_history):
        try:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)

            model = genai.GenerativeModel(
                model_name=self.model or "gemini-2.0-flash",
                system_instruction=self.system_prompt,
            )

            history = []
            if self.include_history and conversation_history:
                for msg in conversation_history[-self.history_limit :]:
                    role = "user" if msg["direction"] == "Incoming" else "model"
                    msg_text = (
                        msg["message"][:200]
                        if len(msg["message"]) > 200
                        else msg["message"]
                    )
                    history.append({"role": role, "parts": [msg_text]})

            context = self.build_context()
            full_message = (
                f"Context:\n{context}\n\nQuestion: {message}" if context else message
            )

            chat = model.start_chat(history=history)
            response = chat.send_message(
                full_message,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=self.max_tokens, temperature=self.temperature
                ),
            )

            if response.candidates and response.candidates[0].content.parts:
                return response.text
            return None

        except ImportError:
            frappe.log_error(
                title="Google AI Dependency Missing",
                message="Run: pip install google-generativeai",
            )
            return None
        except Exception:
            frappe.log_error(
                title="Google AI API Execution Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Chatbot Settings",
            )
            return None

    def custom_response(self, message, conversation_history):
        frappe.log_error(
            title="AI Custom Provider Error",
            message="Custom AI provider logic is not yet implemented.",
            reference_doctype="WhatsApp Chatbot Settings",
        )
        return None
