import frappe
import json


class AIResponder:
    """Generate AI-powered responses (optional feature)."""

    def __init__(self, settings, phone_number=None):
        self.settings = settings
        self.phone_number = phone_number
        self.provider = settings.ai_provider
        self.api_key = settings.get_password("ai_api_key") if settings.ai_api_key else None
        self.model = settings.ai_model or "gpt-4o-mini"
        self.system_prompt = settings.ai_system_prompt or "You are a helpful assistant."
        self.max_tokens = settings.ai_max_tokens or 500
        self.temperature = settings.ai_temperature or 0.7
        self.include_history = settings.ai_include_history or False
        self.history_limit = settings.ai_history_limit or 4

    def generate_response(self, message, conversation_history=None):
        """Generate AI response for message."""
        if not self.api_key:
            frappe.log_error("AI API key not configured")
            return None

        self.current_message = message  # Store for context filtering

        try:
            if self.provider == "OpenAI":
                return self.openai_response(message, conversation_history)
            elif self.provider == "Anthropic":
                return self.anthropic_response(message, conversation_history)
            elif self.provider == "Google":
                return self.google_response(message, conversation_history)
            elif self.provider == "Custom":
                return self.custom_response(message, conversation_history)
        except Exception as e:
            frappe.log_error(f"AIResponder generate_response error: {str(e)}")

        return None

    def build_context(self):
        """Build context from AI Context documents."""
        try:
            contexts = frappe.get_all(
                "WhatsApp AI Context",
                filters={"enabled": 1},
                fields=["*"],
                order_by="priority desc"
            )

            context_parts = []
            message_lower = (getattr(self, 'current_message', '') or '').lower()

            for ctx in contexts:
                try:
                    # Check trigger keywords - skip if message doesn't match
                    if ctx.trigger_keywords:
                        keywords = [k.strip().lower() for k in ctx.trigger_keywords.split(",") if k.strip()]
                        if keywords and not any(kw in message_lower for kw in keywords):
                            continue  # Skip this context - no matching keywords

                    if ctx.context_type == "Static Text" and ctx.static_content:
                        context_parts.append(f"[{ctx.title}]\n{ctx.static_content}")
                    elif ctx.context_type == "DocType Query":
                        data = self.query_doctype(ctx)
                        if data:
                            # Compact JSON to save tokens
                            context_parts.append(f"[{ctx.title}]\n{json.dumps(data, separators=(',', ':'), default=str)}")
                except Exception as e:
                    frappe.log_error(f"AIResponder context '{ctx.title}' error: {str(e)}")
                    continue

            return "\n\n".join(context_parts) if context_parts else ""

        except Exception as e:
            frappe.log_error(f"AIResponder build_context error: {str(e)}")
            return ""

    def query_doctype(self, ctx):
        """Query DocType for context."""
        try:
            # Get the target DocType to query (field renamed to avoid conflict with Frappe's doctype attribute)
            target_doctype = ctx.query_doctype
            if not target_doctype:
                return None

            # Handle filters that might already be parsed
            filters = ctx.filters or {}
            if isinstance(filters, str):
                filters = json.loads(filters) if filters else {}

            # Add user-specific filter if enabled
            if ctx.user_specific and ctx.phone_field and self.phone_number:
                # Normalize phone number for matching (remove + and spaces)
                phone_variants = self.get_phone_variants(self.phone_number)
                filters[ctx.phone_field] = ["in", phone_variants]

            fields = ["name"]

            if ctx.fields_to_include:
                fields = [f.strip() for f in ctx.fields_to_include.split(",") if f.strip()]

            limit = ctx.max_results or 10

            return frappe.get_all(
                target_doctype,
                filters=filters,
                fields=fields,
                limit=limit
            )
        except Exception as e:
            frappe.log_error(f"AIResponder query_doctype error: {str(e)}")
            return None

    def get_phone_variants(self, phone):
        """Get different variants of phone number for matching."""
        if not phone:
            return []

        # Clean the phone number
        clean = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

        variants = [phone, clean]

        # With/without + prefix
        if clean.startswith("+"):
            variants.append(clean[1:])
        else:
            variants.append("+" + clean)

        # With/without country code (assuming 10 digit local numbers)
        if len(clean) > 10:
            variants.append(clean[-10:])

        return list(set(variants))

    def openai_response(self, message, conversation_history):
        """Generate response using OpenAI."""
        try:
            import openai
            client = openai.OpenAI(api_key=self.api_key)

            messages = [{"role": "system", "content": self.system_prompt}]

            # Add context
            context = self.build_context()
            if context:
                messages.append({
                    "role": "system",
                    "content": f"Here is relevant information you can use to answer questions:\n{context}"
                })

            # Add conversation history if enabled
            if self.include_history and conversation_history:
                for msg in conversation_history[-self.history_limit:]:
                    role = "user" if msg["direction"] == "Incoming" else "assistant"
                    # Truncate long messages
                    msg_text = msg["message"][:200] if len(msg["message"]) > 200 else msg["message"]
                    messages.append({"role": role, "content": msg_text})

            # Add current message
            messages.append({"role": "user", "content": message})

            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )

            return response.choices[0].message.content

        except ImportError:
            frappe.log_error("OpenAI library not installed. Run: pip install openai")
            return None
        except Exception as e:
            frappe.log_error(f"OpenAI API error: {str(e)}")
            return None

    def anthropic_response(self, message, conversation_history):
        """Generate response using Anthropic Claude."""
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)

            # Build messages
            messages = []

            # Add conversation history if enabled
            if self.include_history and conversation_history:
                for msg in conversation_history[-self.history_limit:]:
                    role = "user" if msg["direction"] == "Incoming" else "assistant"
                    # Truncate long messages
                    msg_text = msg["message"][:200] if len(msg["message"]) > 200 else msg["message"]
                    messages.append({"role": role, "content": msg_text})

            messages.append({"role": "user", "content": message})

            # Build system prompt with context
            system = self.system_prompt
            context = self.build_context()
            if context:
                system += f"\n\nHere is relevant information you can use to answer questions:\n{context}"

            response = client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=messages
            )

            return response.content[0].text

        except ImportError:
            frappe.log_error("Anthropic library not installed. Run: pip install anthropic")
            return None
        except Exception as e:
            frappe.log_error(f"Anthropic API error: {str(e)}")
            return None

    def google_response(self, message, conversation_history):
        """Generate response using Google AI (Gemini)."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)

            model = genai.GenerativeModel(
                model_name=self.model or "gemini-2.0-flash",
                system_instruction=self.system_prompt
            )

            # Build conversation history if enabled
            history = []
            if self.include_history and conversation_history:
                for msg in conversation_history[-self.history_limit:]:
                    role = "user" if msg["direction"] == "Incoming" else "model"
                    # Truncate long messages to save tokens
                    msg_text = msg["message"][:200] if len(msg["message"]) > 200 else msg["message"]
                    history.append({"role": role, "parts": [msg_text]})

            # Add context to the message
            context = self.build_context()
            full_message = message
            if context:
                full_message = f"Context:\n{context}\n\nQuestion: {message}"

            chat = model.start_chat(history=history)
            response = chat.send_message(
                full_message,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=self.max_tokens,
                    temperature=self.temperature
                )
            )

            # Handle empty response
            if response.candidates and response.candidates[0].content.parts:
                return response.text
            else:
                # Retry without history if MAX_TOKENS
                chat = model.start_chat(history=[])
                response = chat.send_message(
                    full_message,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=self.max_tokens,
                        temperature=self.temperature
                    )
                )
                return response.text

        except ImportError:
            frappe.log_error("Google AI library not installed. Run: pip install google-generativeai")
            return None
        except Exception as e:
            frappe.log_error(f"Google AI API error: {str(e)}")
            return None

    def custom_response(self, message, conversation_history):
        """Generate response using custom endpoint."""
        # Placeholder for custom AI provider integration
        frappe.log_error("Custom AI provider not implemented")
        return None
