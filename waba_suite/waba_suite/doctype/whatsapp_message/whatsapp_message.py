"""WhatsApp Message DocType.

Core document type for WhatsApp messages, handling validation,
sending, and lifecycle management for both incoming and outgoing messages.

Key dependencies:
    - frappe: ERPNext framework
    - waba_suite.utils: Number formatting and account resolution
    - waba_suite.waba_suite.doctype.whatsapp_message.message_formatter: HTML formatting
    - waba_suite.waba_suite.doctype.whatsapp_message.message_sender: API sending
"""

import json
from urllib.parse import urlparse

import frappe
from frappe import _
from frappe.model.document import Document

from waba_suite.utils import format_number, get_whatsapp_account

from waba_suite.api.room import (
    route_incoming_message,
    send_main_menu,
)
from waba_suite.api.session import get_or_create_session

from .message_formatter import restyle_message_content
from .message_sender import send_read_receipt, send_whatsapp_message


class WhatsAppMessage(Document):
    """Represents a WhatsApp message with send/receive capabilities.

    Handles validation, file URL resolution, template message building,
    and sending via the Facebook Business API.
    """

    def validate(self):
        """Validate the document before saving: set account, resolve file URL, style message."""
        self.set_whatsapp_account()
        self.ensure_absolute_file_url()
        if self.message_type != "Template":
            self.styled_message = restyle_message_content(self.message, self.message_type)
        self.set_file_url_from_attach()

    def after_insert(self):
        """Handle post-insert processing (deduplicated send/sync)."""
        self.handle_whatsapp_insertion()

    def ensure_absolute_file_url(self):
        """Convert relative file URLs to absolute URLs."""
        if self.file_url and self.file_url.startswith("/"):
            self.file_url = frappe.utils.get_url(self.file_url)

    def set_file_url_from_attach(self):
        """Resolve file URL from the attach field."""
        if self.file_url:
            return
        if not self.attach:
            return
        file_doc = None
        if isinstance(self.attach, str):
            if self.attach.startswith("/files/") or self.attach.startswith("/private/"):
                file_doc = frappe.db.get_value(
                    "File",
                    {"file_url": self.attach},
                    ["name", "file_url", "file_name", "is_private"],
                    as_dict=True,
                )
            else:
                file_doc = frappe.db.get_value(
                    "File",
                    {"name": self.attach},
                    ["name", "file_url", "file_name", "is_private"],
                    as_dict=True,
                )
        if not file_doc and self.reference_doctype and self.reference_name:
            file_doc = frappe.db.get_value(
                "File",
                {
                    "attached_to_doctype": self.reference_doctype,
                    "attached_to_name": self.reference_name,
                },
                ["name", "file_url", "file_name", "is_private"],
                as_dict=True,
            )
        if file_doc:
            if file_doc.is_private:
                file = frappe.get_doc("File", file_doc.name)
                file.is_private = 0
                file.save(ignore_permissions=True)
            self.file_url = self._build_file_url(file_doc.file_url)
            if not self.content_type or self.content_type == "text":
                self.content_type = self._get_content_type_from_filename(file_doc.file_name)

    def _build_file_url(self, file_url):
        """Build an absolute URL from a file path.

        Args:
            file_url: Relative or absolute file URL.

        Returns:
            Absolute URL string.
        """
        if not file_url:
            return None
        if file_url.startswith("http://") or file_url.startswith("https://"):
            return file_url
        base_url = frappe.utils.get_url()
        parsed_url = urlparse(base_url)
        if parsed_url.hostname and not (
            parsed_url.hostname == "localhost"
            or parsed_url.hostname == "127.0.0.1"
            or parsed_url.hostname.replace(".", "").isdigit()
        ):
            base_url = f"{parsed_url.scheme}://{parsed_url.hostname}"
        if not file_url.startswith("/"):
            file_url = f"/{file_url}"
        return f"{base_url}{file_url}"

    def _get_content_type_from_filename(self, filename):
        """Determine content type from file extension.

        Args:
            filename: Name of the file.

        Returns:
            Content type string: image, video, audio, document, or text.
        """
        if not filename:
            return "text"
        f = filename.lower()
        if f.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg")):
            return "image"
        if f.endswith((".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm")):
            return "video"
        if f.endswith((".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a")):
            return "audio"
        if f.endswith(
            (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv")
        ):
            return "document"
        return "document"

    def set_whatsapp_account(self):
        """Resolve the WhatsApp account and contact for this message.

        Links reply references, assigns the account from settings when missing,
        and creates or links the WhatsApp Contact from the phone number.
        """
        if self.reply_to_message_id and not self.reply_to_message:
            rm = frappe.db.exists("WhatsApp Message", {"message_id": self.reply_to_message_id})
            if rm:
                self.reply_to_message = rm
                self.is_reply = 1
        elif self.reply_to_message and not self.reply_to_message_id:
            self.reply_to_message_id = frappe.db.get_value(
                "WhatsApp Message", self.reply_to_message, "message_id"
            )
            self.is_reply = 1
        if not self.whatsapp_account:
            at = "outgoing" if self.type == "Outgoing" else "incoming"
            d = get_whatsapp_account(account_type=at)
            if d:
                self.whatsapp_account = d.name
        if not self.whatsapp_contact:
            pn = format_number(self.get("from") or self.to)
            c = frappe.db.exists("WhatsApp Contact", {"mobile_no": pn})
            if not c:
                c = frappe.get_doc(
                    {
                        "doctype": "WhatsApp Contact",
                        "mobile_no": pn,
                        "contact_name": self.profile_name or pn,
                    }
                ).insert(ignore_permissions=True)
                self.whatsapp_contact = c.name
            else:
                self.whatsapp_contact = c
        if self.whatsapp_contact and self.profile_name and self.type == "Incoming":
            ct = frappe.get_doc("WhatsApp Contact", self.whatsapp_contact)
            if ct.mobile_no == ct.contact_name:
                frappe.db.set_value(
                    "WhatsApp Contact",
                    self.whatsapp_contact,
                    "contact_name",
                    self.profile_name or ct.contact_name,
                )

    @frappe.whitelist()
    def manual_send(self):
        """Manually trigger sending for outgoing messages."""
        if self.type == "Outgoing":
            self.process_outgoing_send()

    def get_public_file_url(self, file_path):
        """Convert a private file URL to a public one.

        Args:
            file_path: The file path to convert.

        Returns:
            Public URL string.
        """
        if not file_path:
            return None
        if file_path.startswith("http"):
            return file_path
        if file_path.startswith("/private"):
            fd = frappe.get_doc("File", {"file_url": file_path})
            fd.is_private = 0
            fd.save(ignore_permissions=True)
            return frappe.utils.get_url(fd.file_url)
        return frappe.utils.get_url(file_path)

    def send_template(self):
        """Build and send a template message via the WhatsApp API."""
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
        source_doc = None
        if self.flags.custom_ref_doc:
            source_doc = self.flags.custom_ref_doc
        elif self.reference_doctype and self.reference_name:
            source_doc = frappe.get_doc(self.reference_doctype, self.reference_name)

        header_values, body_values, footer_values = self._parse_template_message_data()

        header_meta = {}
        if template.header_type in ("TEXT", None, "") and header_values:
            params = [{"type": "text", "text": v} for v in header_values if v]
            if params:
                data["template"]["components"].append(
                    {"type": "header", "parameters": params}
                )
                header_meta = {"type": "TEXT", "text": header_values[0] if header_values else ""}

        if body_values:
            params = [{"type": "text", "text": v} for v in body_values if v]
            if params:
                data["template"]["components"].append(
                    {"type": "body", "parameters": params}
                )
        elif not header_values and not footer_values:
            fields = template.get("variables") or []
            params = []
            for row in fields:
                value = "-"
                if row.source_type == "DocField" and source_doc:
                    value = source_doc.get(row.field_name) or "-"
                elif row.source_type == "Static":
                    value = row.static_value or "-"
                elif row.source_type == "Computed" and source_doc:
                    value = self._resolve_expression(row.expression, source_doc)
                if value in [None, "", "None"]:
                    value = "-"
                value = str(value)
                params.append({"type": "text", "text": value})
                body_values.append(value)
            if params:
                data["template"]["components"].append(
                    {"type": "body", "parameters": params}
                )

        if not header_values:
            self._add_non_text_header(data, template, source_doc, header_meta)

        button_meta = self._add_button_components(data, template, source_doc)

        message_json = {
            "template_name": template.name,
            "body_values": body_values,
            "header": header_meta,
            "buttons": button_meta,
        }
        frappe.db.set_value(
            "WhatsApp Message",
            self.name,
            "message",
            json.dumps(message_json, indent=2),
            update_modified=False,
        )
        self._data = data
        send_whatsapp_message(self)

    def _parse_template_message_data(self):
        """Parse structured template data from the message field.

        Returns:
            Tuple of (header_values, body_values, footer_values) lists.
        """
        header_values = []
        body_values = []
        footer_values = []
        try:
            msg = json.loads(self.message) if isinstance(self.message, str) else {}
            if isinstance(msg, dict):
                header_values = msg.get("header_values", [])
                body_values = msg.get("body_values", [])
                footer_values = msg.get("footer_values", [])
        except Exception:
            pass
        return header_values, body_values, footer_values

    def _add_non_text_header(self, data, template, source_doc, header_meta):
        """Add non-text header components (IMAGE, VIDEO, DOCUMENT).

        Args:
            data: API request data dict (modified in place).
            template: WhatsApp Templates document.
            source_doc: Source document for variable resolution.
            header_meta: Header metadata dict (modified in place).
        """
        if template.header_type == "IMAGE" and self.file_url:
            url = (
                self.file_url
                if self.file_url.startswith("http")
                else frappe.utils.get_url(self.file_url)
            )
            data["template"]["components"].append(
                {
                    "type": "header",
                    "parameters": [{"type": "image", "image": {"link": url}}],
                }
            )
            header_meta.update({"type": "IMAGE", "url": url})
        elif template.header_type == "VIDEO" and self.file_url:
            url = (
                self.file_url
                if self.file_url.startswith("http")
                else frappe.utils.get_url(self.file_url)
            )
            data["template"]["components"].append(
                {
                    "type": "header",
                    "parameters": [{"type": "video", "video": {"link": url}}],
                }
            )
            header_meta.update({"type": "VIDEO", "url": url})
        elif template.header_type == "DOCUMENT":
            file_url = None
            filename = None
            if self.file_url:
                file_url = (
                    self.file_url
                    if self.file_url.startswith("http")
                    else frappe.utils.get_url(self.file_url)
                )
                filename = file_url.split("/")[-1]
            elif source_doc:
                pdf = frappe.attach_print(
                    doctype=source_doc.doctype,
                    name=source_doc.name,
                    doc=source_doc,
                    print_format=getattr(self, "print_format", None),
                )
                fn = pdf.get("fname", f"{source_doc.name}.pdf")
                fc = pdf.get("fcontent")
                if fc:
                    fd = frappe.get_doc(
                        {
                            "doctype": "File",
                            "file_name": fn,
                            "content": fc,
                            "attached_to_doctype": source_doc.doctype,
                            "attached_to_name": source_doc.name,
                            "is_private": 0,
                        }
                    ).insert(ignore_permissions=True)
                    file_url = frappe.utils.get_url(fd.file_url)
                    filename = fd.file_name
                    frappe.db.set_value(
                        "WhatsApp Message", self.name, "file_url", file_url, update_modified=False
                    )
            if file_url:
                data["template"]["components"].append(
                    {
                        "type": "header",
                        "parameters": [
                            {
                                "type": "document",
                                "document": {"link": file_url, "filename": filename},
                            }
                        ],
                    }
                )
                header_meta.update({"type": "DOCUMENT", "filename": filename, "url": file_url})

    def _add_button_components(self, data, template, source_doc):
        """Add button components to the template data.

        Args:
            data: API request data dict (modified in place).
            template: WhatsApp Templates document.
            source_doc: Source document for URL resolution.

        Returns:
            List of button metadata dicts.
        """
        button_meta = []
        if template.buttons:
            for idx, btn in enumerate(template.buttons):
                if btn.button_type == "Quick Reply":
                    data["template"]["components"].append(
                        {
                            "type": "button",
                            "sub_type": "quick_reply",
                            "index": str(idx),
                            "parameters": [{"type": "payload", "payload": btn.button_label}],
                        }
                    )
                    button_meta.append(
                        {"button_type": btn.button_type, "button_label": btn.button_label}
                    )
                elif btn.button_type == "Call Phone":
                    data["template"]["components"].append(
                        {
                            "type": "button",
                            "sub_type": "phone_number",
                            "index": str(idx),
                            "parameters": [{"type": "text", "text": btn.phone_number}],
                        }
                    )
                    button_meta.append(
                        {
                            "button_type": btn.button_type,
                            "button_label": btn.button_label,
                            "phone_number": btn.phone_number,
                        }
                    )
                elif btn.button_type == "Visit Website":
                    url = btn.website_url
                    if btn.url_type == "Dynamic" and source_doc:
                        url = source_doc.get_formatted(url) or url
                    data["template"]["components"].append(
                        {
                            "type": "button",
                            "sub_type": "url",
                            "index": str(idx),
                            "parameters": [{"type": "text", "text": url}],
                        }
                    )
                    button_meta.append(
                        {
                            "button_type": btn.button_type,
                            "button_label": btn.button_label,
                            "url_type": btn.url_type,
                            "url": url,
                        }
                    )
                elif btn.button_type == "Flow":
                    button_meta.append(
                        {"button_type": btn.button_type, "button_label": btn.button_label}
                    )
        return button_meta

    def process_outgoing_send(self):
        """Process and send an outgoing message via the WhatsApp API."""
        if self.message_type == "Template":
            self.send_template()
            return
        if self.file_url:
            self.file_url = self.get_public_file_url(self.file_url)
        data = {
            "messaging_product": "whatsapp",
            "to": format_number(self.to),
            "type": self.content_type,
        }
        if self.is_reply and self.reply_to_message_id:
            data["context"] = {"message_id": self.reply_to_message_id}
        caption = self.styled_message or self.message or ""
        if self.content_type in ["document", "image", "video"]:
            cd = {"link": self.file_url}
            if not caption and self.file_url:
                caption = self.file_url.split("/")[-1]
            if caption:
                cd["caption"] = caption
            data[self.content_type.lower()] = cd
        elif self.content_type == "reaction":
            data["reaction"] = {
                "message_id": self.reply_to_message_id,
                "emoji": caption if caption else "👍",
            }
        elif self.content_type == "text":
            data["text"] = {"preview_url": True, "body": caption if caption else " "}
        elif self.content_type == "audio":
            data["audio"] = {"link": self.file_url}
        elif self.content_type == "interactive":
            data["type"] = "interactive"
            bd = json.loads(self.buttons) if isinstance(self.buttons, str) else self.buttons
            if isinstance(bd, list) and len(bd) > 3:
                data["interactive"] = {
                    "type": "list",
                    "body": {"text": self.message or " "},
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
                                    for b in bd[:10]
                                ],
                            }
                        ],
                    },
                }
            else:
                data["interactive"] = {
                    "type": "button",
                    "body": {"text": self.styled_message or self.message or " "},
                    "action": {
                        "buttons": [
                            {
                                "type": "reply",
                                "reply": {"id": b["id"], "title": b["title"]},
                            }
                            for b in bd[:3]
                        ]
                    },
                }
        self._data = data
        send_whatsapp_message(self)
        self.status = "sent"
        self.create_whatsapp_profile()

    def _resolve_expression(self, expression, doc):
        """Evaluate a computed expression against a source document.

        Args:
            expression: Python expression string.
            doc: Source document for context.

        Returns:
            Evaluated result as string.
        """
        return eval(
            expression,
            {"__builtins__": {}},
            {
                "doc": doc,
                "get_url": frappe.utils.get_url,
                "fmt_money": frappe.utils.fmt_money,
                "format_date": frappe.utils.formatdate,
            },
        )

    @frappe.whitelist()
    def send_read_receipt(self):
        """Send a read receipt for this message.

        Returns:
            True if successful, False otherwise.
        """
        return send_read_receipt(self)

    def handle_whatsapp_insertion(self):
        """Handle post-insert processing with deduplication via cache."""
        key = f"whatsapp_message_process_{self.name}"
        if frappe.cache().get_value(key):
            return
        frappe.cache().set_value(key, True, expires_in_sec=300)
        try:
            if self.type != "Incoming":
                self.process_outgoing_send()
            else:
                self.create_lead_or_customer_for_incoming()
                process_incoming_sync(self.name)
        finally:
            frappe.cache().delete_value(key)


def process_incoming_sync(docname):
    """Process an incoming WhatsApp message synchronously.

    Creates or retrieves the single session for the contact+account (per the
    24-hour window logic) and routes the message through the chatbot flow if
    auto-replies are enabled.

    Args:
        docname: Name of the WhatsApp Message document to process.
    """
    doc = frappe.get_doc("WhatsApp Message", docname)

    session = get_or_create_session(
        mobile_no=doc.get("from"),
        whatsapp_account=doc.whatsapp_account,
        whatsapp_contact=doc.whatsapp_contact,
    )

    # A session that just opened (or was ended) is treated as new so the
    # customer gets the onboarding menu.
    is_new = session.status in ("Expired", "Ended")

    frappe.db.set_value(
        "WhatsApp Message",
        doc.name,
        "whatsapp_session",
        session.name,
        update_modified=False,
    )

    auto_replies_enabled = frappe.db.get_value(
        "WhatsApp Account", doc.whatsapp_account, "auto_replies_enabled"
    )

    if not auto_replies_enabled:
        return

    if is_new:
        send_main_menu(doc.get("from"), session)
    else:
        route_incoming_message(doc, session)


def on_doctype_update():
    """Add database index for reference fields."""
    frappe.db.add_index("WhatsApp Message", ["reference_doctype", "reference_name"])
