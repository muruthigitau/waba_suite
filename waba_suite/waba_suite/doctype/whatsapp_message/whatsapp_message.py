# Copyright (c) 2022, Shridhar Patil and contributors
# For license information, please see license.txt
import re
import json
import html
import frappe
from frappe import _, throw
from frappe.model.document import Document
from frappe.integrations.utils import make_post_request

from waba_suite.utils import get_whatsapp_account, format_number


class WhatsAppMessage(Document):
    def validate(self):
        try:
            self.set_whatsapp_account()
            self.restyle_message_content()
        except Exception:
            frappe.log_error(
                title=f"WhatsApp Message Validation Error: {self.name}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )
            raise

    def after_insert(self):
        try:
            self.handle_whatsapp_insertion()
        except Exception:
            frappe.log_error(
                title=f"WhatsApp Message After Insert Error: {self.name}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )

    def on_update(self):
        try:
            self.update_profile_name()
        except Exception:
            frappe.log_error(
                title=f"WhatsApp Message On Update Error: {self.name}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )

    def update_profile_name(self):
        try:
            number = self.get("from")
            if not number:
                return
            from_number = format_number(number)

            if (
                self.has_value_changed("profile_name")
                and self.profile_name
                and from_number
                and frappe.db.exists("WhatsApp Profiles", {"number": from_number})
            ):
                profile_id = frappe.get_value(
                    "WhatsApp Profiles", {"number": from_number}, "name"
                )
                frappe.db.set_value(
                    "WhatsApp Profiles", profile_id, "profile_name", self.profile_name
                )
        except Exception:
            frappe.log_error(
                title="Update Profile Name Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )

    def create_whatsapp_profile(self):
        try:
            number = format_number(self.get("from") or self.to)
            if not frappe.db.exists("WhatsApp Profiles", {"number": number}):
                frappe.get_doc(
                    {
                        "doctype": "WhatsApp Profiles",
                        "profile_name": self.profile_name,
                        "number": number,
                        "whatsapp_account": self.whatsapp_account,
                    }
                ).insert(ignore_permissions=True)
        except Exception:
            frappe.log_error(
                title="Create WhatsApp Profile Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )

    def set_whatsapp_account(self):
        try:
            if not self.whatsapp_account:
                account_type = "outgoing" if self.type == "Outgoing" else "incoming"
                default_whatsapp_account = get_whatsapp_account(
                    account_type=account_type
                )
                if not default_whatsapp_account:
                    throw(
                        _(
                            "Please set a default outgoing WhatsApp Account or Select available WhatsApp Account"
                        )
                    )
                else:
                    self.whatsapp_account = default_whatsapp_account.name
        except Exception:
            frappe.log_error(
                title="Set WhatsApp Account Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )
            raise

    @frappe.whitelist()
    def manual_send(self):
        try:
            if self.type == "Outgoing" and self.status == "draft":
                self.process_outgoing_send()
                self.save()
        except Exception:
            frappe.log_error(
                title=f"Manual Send Error: {self.name}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )
            raise

    def process_outgoing_send(self):
        try:
            if self.message_type == "Template":
                self.send_template()
                return

            if self.attach and not self.attach.startswith("http"):
                link = frappe.utils.get_url() + "/" + self.attach
            else:
                link = self.attach

            data = {
                "messaging_product": "whatsapp",
                "to": format_number(self.to),
                "type": self.content_type,
            }

            if self.is_reply and self.reply_to_message_id:
                data["context"] = {"message_id": self.reply_to_message_id}

            if self.content_type in ["document", "image", "video"]:
                data[self.content_type.lower()] = {
                    "link": link,
                    "caption": self.styled_message or self.message,
                }
            elif self.content_type == "reaction":
                data["reaction"] = {
                    "message_id": self.reply_to_message_id,
                    "emoji": self.styled_message or self.message,
                }
            elif self.content_type == "text":
                data["text"] = {
                    "preview_url": True,
                    "body": self.styled_message or self.message,
                }
            elif self.content_type == "audio":
                data["audio"] = {"link": link}
            elif self.content_type == "interactive":
                data["type"] = "interactive"
                buttons_data = (
                    json.loads(self.buttons)
                    if isinstance(self.buttons, str)
                    else self.buttons
                )
                if isinstance(buttons_data, list) and len(buttons_data) > 3:
                    data["interactive"] = {
                        "type": "list",
                        "body": {"text": self.message},
                        "action": {
                            "button": "Select Option",
                            "sections": [
                                {
                                    "title": "Options",
                                    "rows": [
                                        {
                                            "id": b["id"],
                                            "title": b["title"],
                                            "description": b.get("description", ""),
                                        }
                                        for b in buttons_data[:10]
                                    ],
                                }
                            ],
                        },
                    }
                else:
                    data["interactive"] = {
                        "type": "button",
                        "body": {"text": self.styled_message or self.message},
                        "action": {
                            "buttons": [
                                {
                                    "type": "reply",
                                    "reply": {"id": b["id"], "title": b["title"]},
                                }
                                for b in buttons_data[:3]
                            ]
                        },
                    }

            self.notify(data)
            self.status = "Success"
            self.create_whatsapp_profile()
        except Exception as e:
            frappe.db.set_value("WhatsApp Message", self.name, "status", "failed")
            frappe.db.commit()
            frappe.log_error(
                title=f"Process Outgoing Send Error: {self.name}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )
            throw(f"Failed to send message: {str(e)}")

    def send_template(self):
        try:
            template = frappe.get_doc("WhatsApp Templates", self.template)
            data = {
                "messaging_product": "whatsapp",
                "to": format_number(self.to),
                "type": "template",
                "template": {
                    "name": template.actual_name or template.template_name,
                    "language": {"code": template.language_code},
                    "components": [],
                },
            }

            if template.sample_values:
                field_names = (
                    template.field_names.split(",")
                    if template.field_names
                    else template.sample_values.split(",")
                )
                parameters = []
                template_parameters = []

                if self.body_param is not None:
                    params = list(json.loads(self.body_param).values())
                    for param in params:
                        parameters.append({"type": "text", "text": param})
                        template_parameters.append(param)
                elif self.flags.custom_ref_doc:
                    custom_values = self.flags.custom_ref_doc
                    for field_name in field_names:
                        value = custom_values.get(field_name.strip())
                        parameters.append({"type": "text", "text": value})
                        template_parameters.append(value)
                else:
                    ref_doc = frappe.get_doc(
                        self.reference_doctype, self.reference_name
                    )
                    for field_name in field_names:
                        value = ref_doc.get_formatted(field_name.strip())
                        parameters.append({"type": "text", "text": value})
                        template_parameters.append(value)

                self.template_parameters = json.dumps(template_parameters)
                data["template"]["components"].append(
                    {"type": "body", "parameters": parameters}
                )

            if template.header_type and self.attach:
                url = (
                    self.attach
                    if self.attach.startswith("http")
                    else f"{frappe.utils.get_url()}{self.attach}"
                )
                data["template"]["components"].append(
                    {
                        "type": "header",
                        "parameters": [{"type": "image", "image": {"link": url}}],
                    }
                )

            if template.buttons:
                button_parameters = []
                for idx, btn in enumerate(template.buttons):
                    if btn.button_type == "Quick Reply":
                        button_parameters.append(
                            {
                                "type": "button",
                                "sub_type": "quick_reply",
                                "index": str(idx),
                                "parameters": [
                                    {"type": "payload", "payload": btn.button_label}
                                ],
                            }
                        )
                    elif btn.button_type == "Call Phone":
                        button_parameters.append(
                            {
                                "type": "button",
                                "sub_type": "phone_number",
                                "index": str(idx),
                                "parameters": [
                                    {"type": "text", "text": btn.phone_number}
                                ],
                            }
                        )
                    elif btn.button_type == "Visit Website":
                        url = btn.website_url
                        if btn.url_type == "Dynamic":
                            ref_doc = frappe.get_doc(
                                self.reference_doctype, self.reference_name
                            )
                            url = ref_doc.get_formatted(btn.website_url)
                        button_parameters.append(
                            {
                                "type": "button",
                                "sub_type": "url",
                                "index": str(idx),
                                "parameters": [{"type": "text", "text": url}],
                            }
                        )
                if button_parameters:
                    data["template"]["components"].extend(button_parameters)

            self.notify(data)
        except Exception:
            frappe.log_error(
                title=f"Send Template Error: {self.name}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )
            raise

    def notify(self, data):
        try:
            whatsapp_account = frappe.get_doc("WhatsApp Account", self.whatsapp_account)
            token = whatsapp_account.get_password("token")
            headers = {
                "authorization": f"Bearer {token}",
                "content-type": "application/json",
            }

            response = make_post_request(
                f"{whatsapp_account.url}/{whatsapp_account.version}/{whatsapp_account.phone_id}/messages",
                headers=headers,
                data=json.dumps(data),
            )
            self.message_id = response["messages"][0]["id"]
        except Exception:
            res = (
                frappe.flags.integration_request.json().get("error", {})
                if frappe.flags.integration_request
                else {}
            )
            error_message = res.get("message", "WhatsApp API Error")
            frappe.get_doc(
                {
                    "doctype": "WhatsApp Notification Log",
                    "template": "Error Log",
                    "meta_data": json.dumps(res),
                }
            ).insert(ignore_permissions=True)

            frappe.log_error(
                title="WhatsApp Notification API Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )
            throw(msg=error_message, title=res.get("error_user_title", "Error"))

    def format_number(self, number):
        if number.startswith("+"):
            number = number[1:]
        return number

    @frappe.whitelist()
    def send_read_receipt(self):
        try:
            data = {
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": self.message_id,
            }
            settings = frappe.get_doc("WhatsApp Account", self.whatsapp_account)
            token = settings.get_password("token")
            headers = {
                "authorization": f"Bearer {token}",
                "content-type": "application/json",
            }

            response = make_post_request(
                f"{settings.url}/{settings.version}/{settings.phone_id}/messages",
                headers=headers,
                data=json.dumps(data),
            )

            if response.get("success"):
                self.status = "marked as read"
                self.save()
                return response.get("success")
        except Exception:
            frappe.log_error(
                title=f"Read Receipt Error: {self.name}",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Message",
                reference_name=self.name,
            )

    def restyle_message_content(self):
        try:
            if self.message:
                self.styled_message = self.advanced_whatsapp_formatter(self.message)

            if self.content_type == "interactive" and self.buttons:
                btns = (
                    json.loads(self.buttons)
                    if isinstance(self.buttons, str)
                    else self.buttons
                )
                for btn in btns:
                    if "title" in btn:
                        btn["title"] = self.advanced_whatsapp_formatter(
                            btn["title"], strip_newlines=True
                        )
                self.buttons = json.dumps(btns)
            except Exception:
                pass

    def advanced_whatsapp_formatter(self, text, strip_newlines=False):
        if not text:
            return ""

        text = html.unescape(text)

        text = re.sub(
            r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
            lambda m: (
                f"{re.sub('<[^>]+>', '', m.group(2)).strip()} - {m.group(1)}"
                if m.group(2).strip()
                else m.group(1)
            ),
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        text = re.sub(r"<a[^>]*>(https?://[^<]+)</a>", r"\1", text, flags=re.IGNORECASE)

        text = re.sub(r"<(br|p|div|li|tr)[^>]*\/?>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<\/(h[1-6])>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<(h[1-6])[^>]*>", lambda m: "", text, flags=re.IGNORECASE)
        text = re.sub(r"<(strong|b)[^>]*>", "*", text, flags=re.IGNORECASE)
        text = re.sub(r"<\/(strong|b)>", "*", text, flags=re.IGNORECASE)
        text = re.sub(r"<(em|i)[^>]*>", "_", text, flags=re.IGNORECASE)
        text = re.sub(r"<\/(em|i)>", "_", text, flags=re.IGNORECASE)
        text = re.sub(r"<(strike|s|del)[^>]*>", "~", text, flags=re.IGNORECASE)
        text = re.sub(r"<\/(strike|s|del)>", "~", text, flags=re.IGNORECASE)
        text = re.sub(r"<code[^>]*>", "```", text, flags=re.IGNORECASE)
        text = re.sub(r"<\/code>", "```", text, flags=re.IGNORECASE)
        text = re.sub(r"<pre[^>]*>", "```\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<\/pre>", "\n```", text, flags=re.IGNORECASE)

        text = re.sub(r"<ul[^>]*>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<\/ul>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<ol[^>]*>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<\/ol>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<li[^>]*>", "• ", text, flags=re.IGNORECASE)
        text = re.sub(r"<\/li>", "\n", text, flags=re.IGNORECASE)

        text = re.sub(r"<[^>]+>", "", text)

        lines = text.split("\n")
        processed_lines = []

        for line in lines:
            original_line = line
            line = line.strip()

            if not line:
                processed_lines.append("")
                continue

            if re.match(r"^#{1,6}\s", line):
                hash_count = len(re.match(r"^#{1,6}", line).group())
                header_text = re.sub(r"^#{1,6}\s+", "", line)
                processed_lines.append(f"*{header_text}*")
            elif re.match(r"^#{1,6}[^#]", line):
                header_text = re.sub(r"^#{1,6}", "", line).strip()
                processed_lines.append(f"*{header_text}*")
            elif re.match(r"^[-*+]\s", line):
                content = re.sub(r"^[-*+]\s+", "", line)
                processed_lines.append(f"• {content}")
            elif re.match(r"^\d+\.\s", line):
                processed_lines.append(line)
            elif re.match(r"^>\s", line):
                content = re.sub(r"^>\s+", "", line)
                processed_lines.append(f"_{content}_")
            elif re.match(r"^`{3}", line):
                processed_lines.append(line)
            elif re.match(r"^_{3,}$|^-{3,}$|^\*{3,}$", line):
                processed_lines.append("---")
            else:
                if (
                    processed_lines
                    and processed_lines[-1]
                    and not processed_lines[-1].startswith(("•", "```", "---"))
                    and not re.match(r"^\d+\.", processed_lines[-1])
                ):
                    processed_lines[-1] = processed_lines[-1] + " " + line
                else:
                    processed_lines.append(line)

        text = "\n".join(processed_lines)

        text = re.sub(r"\*\*([^*]+)\*\*", r"*\1*", text)
        text = re.sub(r"\*([^*]+)\*", r"*\1*", text)
        text = re.sub(r"__([^_]+)__", r"_\1_", text)
        text = re.sub(r"_([^_]+)_", r"_\1_", text)
        text = re.sub(r"~~([^~]+)~~", r"~\1~", text)
        text = re.sub(r"`([^`]+)`", r"```\1```", text)

        text = re.sub(r"\n{3,}", "\n\n", text)

        if strip_newlines:
            text = text.replace("\n", " ").strip()

        return text.strip()

    def handle_whatsapp_insertion(self):
        """Handle WhatsApp Message insertion."""

        from ....api.message import last_message
        from ....api.room import (
            get_or_create_session,
            route_incoming_message,
            send_main_menu,
        )

        last_message(self)

        if self.type != "Incoming":
            return

        session, is_new = get_or_create_session(self)

        self.whatsapp_session = session.name
        self.save(ignore_permissions=True)

        if is_new:
            send_main_menu(self.get("from"), session)
            return

        route_incoming_message(self, session)


def on_doctype_update():
    frappe.db.add_index("WhatsApp Message", ["reference_doctype", "reference_name"])


@frappe.whitelist()
def send_template(to, reference_doctype, reference_name, template):
    try:
        doc = frappe.get_doc(
            {
                "doctype": "WhatsApp Message",
                "to": to,
                "type": "Outgoing",
                "message_type": "Template",
                "reference_doctype": reference_doctype,
                "reference_name": reference_name,
                "content_type": "text",
                "template": template,
            }
        )
        doc.save()
    except Exception:
        frappe.log_error(
            title="Whitelist Send Template Error", message=frappe.get_traceback()
        )
        raise
