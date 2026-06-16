# Copyright (c) 2022, Shridhar Patil and contributors
# For license information, please see license.txt
import html
import json
import re
from urllib.parse import urlparse

import frappe
from frappe import _, throw
from frappe.integrations.utils import make_post_request
from frappe.model.document import Document

from waba_suite.utils import format_number, get_whatsapp_account


class WhatsAppMessage(Document):
	def validate(self):
		self.set_whatsapp_account()
		self.ensure_absolute_file_url()
		self.restyle_message_content()
		self.set_file_url_from_attach()

	def after_insert(self):
		self.handle_whatsapp_insertion()

	def ensure_absolute_file_url(self):
		if self.file_url and self.file_url.startswith("/"):
			self.file_url = frappe.utils.get_url(self.file_url)

	def set_file_url_from_attach(self):
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

		elif isinstance(self.attach, str) and frappe.db.exists("File", self.attach):
			file_doc = frappe.db.get_value(
				"File", self.attach, ["name", "file_url", "file_name", "is_private"], as_dict=True
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

			self.file_url = self.build_file_url(file_doc.file_url)

			if not self.content_type or self.content_type == "text":
				self.content_type = self.get_content_type_from_filename(file_doc.file_name)

	def build_file_url(self, file_url):
		if not file_url:
			return None

		if file_url.startswith("http://") or file_url.startswith("https://"):
			return file_url

		base_url = frappe.utils.get_url()

		parsed_url = urlparse(base_url)

		if parsed_url.hostname:
			if not (
				parsed_url.hostname == "localhost"
				or parsed_url.hostname == "127.0.0.1"
				or parsed_url.hostname.replace(".", "").isdigit()
			):
				base_url = f"{parsed_url.scheme}://{parsed_url.hostname}"

		if not file_url.startswith("/"):
			file_url = f"/{file_url}"

		# base_url = "https://ac4a-105-161-155-97.ngrok-free.app"

		return f"{base_url}{file_url}"

	def get_content_type_from_filename(self, filename):
		if not filename:
			return "text"

		filename_lower = filename.lower()

		if filename_lower.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg")):
			return "image"
		elif filename_lower.endswith((".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm")):
			return "video"
		elif filename_lower.endswith((".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a")):
			return "audio"
		elif filename_lower.endswith(
			(".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv")
		):
			return "document"
		else:
			return "document"

	def update_profile_name(self):
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
			profile_id = frappe.get_value("WhatsApp Profiles", {"number": from_number}, "name")
			frappe.db.set_value("WhatsApp Profiles", profile_id, "profile_name", self.profile_name)

	def create_whatsapp_profile(self):
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

	def set_whatsapp_account(self):
		if self.reply_to_message_id and not self.reply_to_message:
			reply_to_message = frappe.db.exists(
				"WhatsApp Message",
				{
					"message_id": self.reply_to_message_id,
				},
			)
			if reply_to_message:
				self.reply_to_message = reply_to_message
				self.is_reply = 1
		elif self.reply_to_message and not self.reply_to_message_id:
			self.reply_to_message_id = frappe.db.get_value(
				"WhatsApp Message", self.reply_to_message, "message_id"
			)
			self.is_reply = 1

		if not self.whatsapp_account:
			account_type = "outgoing" if self.type == "Outgoing" else "incoming"
			default_whatsapp_account = get_whatsapp_account(account_type=account_type)
			if default_whatsapp_account:
				self.whatsapp_account = default_whatsapp_account.name

		if not self.whatsapp_contact:
			phone_number = format_number(self.get("from") or self.to)
			contact = frappe.db.exists("WhatsApp Contact", {"mobile_no": phone_number})
			if not contact:
				contact = frappe.get_doc(
					{
						"doctype": "WhatsApp Contact",
						"mobile_no": phone_number,
						"contact_name": self.profile_name or phone_number,
					}
				)
				contact.insert(ignore_permissions=True)
				self.whatsapp_contact = contact.name
			else:
				self.whatsapp_contact = contact
		if self.whatsapp_contact and self.profile_name and self.type == "Incoming":
			contact = frappe.get_doc("WhatsApp Contact", self.whatsapp_contact)
			if contact.mobile_no == contact.contact_name:
				frappe.db.set_value(
					"WhatsApp Contact",
					self.whatsapp_contact,
					"contact_name",
					self.profile_name or contact.contact_name,
				)

	@frappe.whitelist()
	def manual_send(self):
		if self.type == "Outgoing":
			self.process_outgoing_send()

	def get_public_file_url(self, file_path):
		if not file_path:
			return None

		if file_path.startswith("http"):
			return file_path

		if file_path.startswith("/private"):
			file_doc = frappe.get_doc("File", {"file_url": file_path})
			file_doc.is_private = 0
			file_doc.save(ignore_permissions=True)
			return frappe.utils.get_url(file_doc.file_url)

		return frappe.utils.get_url(file_path)

	def send_template(self):
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

		fields = frappe.get_all(
			"WhatsApp Template Variable",
			filters={"parent": template.name},
			fields=["idx", "source_type", "field_name", "static_value", "expression"],
			order_by="idx asc",
		)

		parameters = []
		body_values = []

		for row in fields:
			value = "-"

			if row.source_type == "DocField" and source_doc:
				value = source_doc.get(row.field_name) or "-"
			elif row.source_type == "Static":
				value = row.static_value or "-"
			elif row.source_type == "Computed" and source_doc:
				value = self.resolve_expression(row.expression, source_doc)

			if value in [None, "", "None"]:
				value = "-"

			value = str(value)

			parameters.append({"type": "text", "text": value})
			body_values.append(value)

		if parameters:
			data["template"]["components"].append({"type": "body", "parameters": parameters})

		header_meta = {}
		button_meta = []

		if template.header_type == "IMAGE" and self.file_url:
			url = self.file_url if self.file_url.startswith("http") else frappe.utils.get_url(self.file_url)

			data["template"]["components"].append(
				{
					"type": "header",
					"parameters": [{"type": "image", "image": {"link": url}}],
				}
			)

			header_meta = {"type": "IMAGE", "url": url}

		elif template.header_type == "DOCUMENT":
			file_url = None
			filename = None

			if self.file_url:
				file_url = (
					self.file_url if self.file_url.startswith("http") else frappe.utils.get_url(self.file_url)
				)
				filename = file_url.split("/")[-1]

			elif source_doc:
				pdf = frappe.attach_print(
					doctype=source_doc.doctype,
					name=source_doc.name,
					doc=source_doc,
					print_format=getattr(self, "print_format", None),
				)

				file_name = pdf.get("fname", f"{source_doc.name}.pdf")
				file_content = pdf.get("fcontent")

				if file_content:
					file_doc = frappe.get_doc(
						{
							"doctype": "File",
							"file_name": file_name,
							"content": file_content,
							"attached_to_doctype": source_doc.doctype,
							"attached_to_name": source_doc.name,
							"is_private": 0,
						}
					).insert(ignore_permissions=True)

					file_url = frappe.utils.get_url(file_doc.file_url)
					filename = file_doc.file_name

					frappe.db.set_value(
						"WhatsApp Message",
						self.name,
						"file_url",
						file_url,
						update_modified=False,
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

				header_meta = {"type": "DOCUMENT", "filename": filename, "url": file_url}

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

					button_meta.append({"button_type": btn.button_type, "button_label": btn.button_label})

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
					button_meta.append({"button_type": btn.button_type, "button_label": btn.button_label})

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

		self.notify(data)

	def process_outgoing_send(self):
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
			content_data = {"link": self.file_url}

			if not caption and self.file_url:
				caption = self.file_url.split("/")[-1]

			if caption:
				content_data["caption"] = caption

			data[self.content_type.lower()] = content_data

		elif self.content_type == "reaction":
			data["reaction"] = {
				"message_id": self.reply_to_message_id,
				"emoji": caption if caption else "👍",
			}
		elif self.content_type == "text":
			data["text"] = {
				"preview_url": True,
				"body": caption if caption else " ",
			}
		elif self.content_type == "audio":
			data["audio"] = {"link": self.file_url}
		elif self.content_type == "interactive":
			data["type"] = "interactive"
			buttons_data = json.loads(self.buttons) if isinstance(self.buttons, str) else self.buttons
			if isinstance(buttons_data, list) and len(buttons_data) > 3:
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
									for b in buttons_data[:10]
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
							for b in buttons_data[:3]
						]
					},
				}

		self.notify(data)
		self.status = "sent"
		self.create_whatsapp_profile()

	def resolve_expression(self, expression, doc):
		context = {
			"doc": doc,
			"get_url": frappe.utils.get_url,
			"fmt_money": frappe.utils.fmt_money,
			"format_date": frappe.utils.formatdate,
		}
		return eval(expression, {"__builtins__": {}}, context)

	def create_integration_request(self, url, headers, data, request_description):
		return frappe.get_doc(
			{
				"doctype": "Integration Request",
				"integration_request_service": "WhatsApp",
				"is_remote_request": 1,
				"request_description": request_description,
				"status": "Queued",
				"url": url,
				"request_headers": json.dumps(headers, indent=2),
				"data": json.dumps(data, indent=2),
				"reference_doctype": self.doctype,
				"reference_docname": self.name,
			}
		).insert(ignore_permissions=True)

	def notify(self, data):
		try:
			if not self.whatsapp_account:
				return

			whatsapp_account = frappe.get_doc("WhatsApp Account", self.whatsapp_account)
			token = whatsapp_account.get_password("token")

			headers = {
				"authorization": f"Bearer {token}",
				"content-type": "application/json",
			}

			url = f"{whatsapp_account.url}/{whatsapp_account.version}/{whatsapp_account.phone_id}/messages"

			request_description = f"Send WhatsApp {data.get('type', 'message')} to {data.get('to')}"
			integration_request = self.create_integration_request(url, headers, data, request_description)

			try:
				response = make_post_request(
					url,
					headers=headers,
					data=json.dumps(data),
				)

				integration_request.status = "Completed"
				integration_request.output = (
					json.dumps(response, indent=2) if isinstance(response, dict) else str(response)
				)
				integration_request.save(ignore_permissions=True)

				frappe.get_doc(
					{
						"doctype": "WhatsApp Notification Log",
						"template": self.template,
						"whatsapp_message": self.name,
						"whatsapp_account": self.whatsapp_account,
						"meta_data": {"request": data, "response": response},
					}
				).insert(ignore_permissions=True)

				if isinstance(response, dict) and response.get("error"):
					frappe.throw(response["error"].get("message", "WhatsApp API Error"))

				message_id = None
				if isinstance(response, dict):
					messages = response.get("messages", [])
					if messages and len(messages) > 0:
						message_id = messages[0].get("id")

				if message_id:
					frappe.db.set_value("WhatsApp Message", self.name, "message_id", message_id)

			except Exception as api_error:
				error_response = {"error": str(api_error)}

				if hasattr(api_error, "response") and api_error.response:
					if hasattr(api_error.response, "text"):
						error_response["response_text"] = api_error.response.text
					if hasattr(api_error.response, "status_code"):
						error_response["status_code"] = api_error.response.status_code

				integration_request.status = "Failed"
				integration_request.error = json.dumps(error_response, indent=2)
				integration_request.save(ignore_permissions=True)

				frappe.get_doc(
					{
						"doctype": "WhatsApp Notification Log",
						"template": self.template,
						"whatsapp_message": self.name,
						"whatsapp_account": self.whatsapp_account,
						"meta_data": {"request": data, "response": error_response},
					}
				).insert(ignore_permissions=True)

		except Exception as e:
			frappe.log_error(
				"WhatsApp Message Notification",
				f"Failed to send WhatsApp message: {e!s}",
			)

	@frappe.whitelist()
	def send_read_receipt(self):
		if not self.message_id:
			return False

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

		url = f"{settings.url}/{settings.version}/{settings.phone_id}/messages"

		integration_request = self.create_integration_request(
			url, headers, data, f"Send read receipt for {self.message_id}"
		)

		try:
			response = make_post_request(
				url,
				headers=headers,
				data=json.dumps(data),
			)

			integration_request.status = "Completed"
			integration_request.output = (
				json.dumps(response, indent=2) if isinstance(response, dict) else str(response)
			)
			integration_request.save(ignore_permissions=True)

			if isinstance(response, dict) and response.get("success"):
				frappe.db.set_value("WhatsApp Message", self.name, "status", "marked_as_read")
				frappe.db.commit()
				return True

			return False

		except Exception as api_error:
			error_response = {"error": str(api_error)}

			if hasattr(api_error, "response") and api_error.response:
				if hasattr(api_error.response, "text"):
					error_response["response_text"] = api_error.response.text

			integration_request.status = "Failed"
			integration_request.error = json.dumps(error_response, indent=2)
			integration_request.save(ignore_permissions=True)

			return False

	def restyle_message_content(self):
		if self.message:
			self.styled_message = self.advanced_whatsapp_formatter(self.message)

		if self.content_type == "interactive" and self.buttons:
			btns = json.loads(self.buttons) if isinstance(self.buttons, str) else self.buttons
			for btn in btns:
				if "title" in btn:
					btn["title"] = self.advanced_whatsapp_formatter(btn["title"], strip_newlines=True)
			self.buttons = json.dumps(btns)

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
			flags=re.I | re.S,
		)
		text = re.sub(r"<a[^>]*>(https?://[^<]+)</a>", r"\1", text, flags=re.I)
		text = re.sub(r"<(br|p|div|li|tr)[^>]*\/?>", "\n", text, flags=re.I)
		text = re.sub(r"<\/(h[1-6])>", "\n", text, flags=re.I)
		text = re.sub(r"<(h[1-6])[^>]*>", "", text, flags=re.I)
		text = re.sub(r"<(strong|b)[^>]*>", "*", text, flags=re.I)
		text = re.sub(r"<\/(strong|b)>", "*", text, flags=re.I)
		text = re.sub(r"<(em|i)[^>]*>", "_", text, flags=re.I)
		text = re.sub(r"<\/(em|i)>", "_", text, flags=re.I)
		text = re.sub(r"<(strike|s|del)[^>]*>", "~", text, flags=re.I)
		text = re.sub(r"<\/(strike|s|del)>", "~", text, flags=re.I)
		text = re.sub(r"<code[^>]*>", "```", text, flags=re.I)
		text = re.sub(r"<\/code>", "```", text, flags=re.I)
		text = re.sub(r"<pre[^>]*>", "```\n", text, flags=re.I)
		text = re.sub(r"<\/pre>", "\n```", text, flags=re.I)
		text = re.sub(r"<ul[^>]*>", "\n", text, flags=re.I)
		text = re.sub(r"<\/ul>", "\n", text, flags=re.I)
		text = re.sub(r"<li[^>]*>", "• ", text, flags=re.I)
		text = re.sub(r"<\/li>", "\n", text, flags=re.I)
		text = re.sub(r"<[^>]+>", "", text)

		lines = text.split("\n")
		processed_lines = []
		for line in lines:
			line = line.strip()
			if not line:
				processed_lines.append("")
				continue
			if re.match(r"^#{1,6}\s", line):
				cleaned = re.sub(r"^#{1,6}\s+", "", line)
				processed_lines.append(f"*{cleaned}*")
			elif re.match(r"^[-*+]\s", line):
				cleaned = re.sub(r"^[-*+]\s+", "", line)
				processed_lines.append(f"• {cleaned}")
			elif re.match(r"^>\s", line):
				cleaned = re.sub(r"^>\s+", "", line)
				processed_lines.append(f"_{cleaned}_")
			else:
				processed_lines.append(line)

		text = "\n".join(processed_lines)
		text = re.sub(r"\*\*([^*]+)\*\*", r"*\1*", text)
		text = re.sub(r"__([^_]+)__", r"_\1_", text)
		text = re.sub(r"~~([^~]+)~~", r"~\1~", text)
		text = re.sub(r"\n{3,}", "\n\n", text)

		if strip_newlines:
			text = text.replace("\n", " ").strip()

		return text.strip()

	def handle_whatsapp_insertion(self):
		lock_key = f"whatsapp_message_process_{self.name}"

		if frappe.cache().get_value(lock_key):
			return

		frappe.cache().set_value(lock_key, True, expires_in_sec=300)

		try:
			if self.type != "Incoming":
				self.process_outgoing_send()
			else:
				self.create_lead_or_customer_for_incoming()
				process_incoming_sync(self.name)
		finally:
			frappe.cache().delete_value(lock_key)

	def create_lead_or_customer_for_incoming(self):
		if not self.whatsapp_contact:
			return

		whatsapp_account = frappe.get_doc("WhatsApp Account", self.whatsapp_account)

		if not whatsapp_account.auto_create_lead_on_new_contact:
			return

		whatsapp_contact = frappe.get_doc("WhatsApp Contact", self.whatsapp_contact)

		if whatsapp_contact.customer:
			return

		lead_doctype = whatsapp_account.lead_doctype

		if not lead_doctype:
			return

		existing_lead = None

		if lead_doctype == "CRM Lead":
			existing_lead = frappe.db.get_value("CRM Lead", {"mobile_no": whatsapp_contact.mobile_no}, "name")

			if not existing_lead and whatsapp_contact.email:
				existing_lead = frappe.db.get_value("CRM Lead", {"email_id": whatsapp_contact.email}, "name")

		elif lead_doctype == "Lead":
			existing_lead = frappe.db.get_value("Lead", {"mobile_no": whatsapp_contact.mobile_no}, "name")

			if not existing_lead and whatsapp_contact.email:
				existing_lead = frappe.db.get_value("Lead", {"email_id": whatsapp_contact.email}, "name")

		if existing_lead:
			return

		lead_data = {
			"doctype": lead_doctype,
			"lead_name": whatsapp_contact.contact_name or whatsapp_contact.mobile_no,
			"company_name": whatsapp_contact.contact_name or whatsapp_contact.mobile_no,
			"first_name": whatsapp_contact.contact_name or whatsapp_contact.mobile_no,
			"mobile_no": whatsapp_contact.mobile_no,
		}

		if whatsapp_contact.email:
			lead_data["email_id"] = whatsapp_contact.email

		lead_doc = frappe.get_doc(lead_data)

		try:
			lead_doc.flags.ignore_mandatory = True
			lead_doc.flags.ignore_validate = True
			lead_doc.insert(ignore_permissions=True)
			frappe.db.commit()

		except Exception as e:
			frappe.log_error(
				title=f"Auto Lead Creation Failed - {lead_doctype}",
				message=f"Failed to create lead for WhatsApp message: {self.name}\nMobile: {whatsapp_contact.mobile_no}\nError: {e!s}\nTraceback: {frappe.get_traceback()}",
			)


def process_incoming_sync(docname):
	from ....api.room import (
		get_or_create_session_sync,
		route_incoming_message,
		send_main_menu,
	)

	doc = frappe.get_doc("WhatsApp Message", docname)

	session = get_or_create_session_sync(doc)

	if not session:
		return

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

	is_new = session.get("is_new", False)

	if is_new:
		send_main_menu(doc.get("from"), session)
	else:
		route_incoming_message(doc, session)


def on_doctype_update():
	frappe.db.add_index("WhatsApp Message", ["reference_doctype", "reference_name"])


@frappe.whitelist()
def send_template(to, reference_doctype, reference_name, template, whatsapp_account=None, print_format=None):
	if not template:
		frappe.throw("Template is required")

	source_doc = None
	if reference_doctype and reference_name:
		source_doc = frappe.get_doc(reference_doctype, reference_name)

	template_doc = frappe.get_doc("WhatsApp Templates", template)
	file_url = None

	if template_doc.header_type == "DOCUMENT" and source_doc:
		pdf = frappe.attach_print(
			doctype=source_doc.doctype,
			name=source_doc.name,
			doc=source_doc,
			print_format=print_format,
		)

		file_name = pdf.get("fname", f"{source_doc.name}.pdf")
		file_content = pdf.get("fcontent")

		if file_content:
			file_doc = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": file_name,
					"content": file_content,
					"attached_to_doctype": source_doc.doctype,
					"attached_to_name": source_doc.name,
					"is_private": 0,
				}
			).insert(ignore_permissions=True)

			file_url = frappe.utils.get_url(file_doc.file_url)

	doc = frappe.get_doc(
		{
			"doctype": "WhatsApp Message",
			"to": to,
			"type": "Outgoing",
			"message_type": "Template",
			"content_type": "text",
			"template": template,
			"use_template": 1,
			"print_format": print_format,
			"file_url": file_url,
			"whatsapp_account": whatsapp_account,
		}
	)

	doc.insert(ignore_permissions=True)

	frappe.db.set_value(
		"WhatsApp Message",
		doc.name,
		{"reference_doctype": reference_doctype, "reference_name": reference_name},
	)
	frappe.db.commit()

	return doc.name


@frappe.whitelist()
def send_message(to, message, reference_doctype=None, reference_name=None, whatsapp_account=None):
	doc = frappe.get_doc(
		{
			"doctype": "WhatsApp Message",
			"to": to,
			"type": "Outgoing",
			"message_type": "Manual",
			"content_type": "text",
			"message": message,
			"styled_message": message,
			"reference_doctype": reference_doctype,
			"reference_name": reference_name,
			"whatsapp_account": whatsapp_account,
		}
	)

	doc.insert(ignore_permissions=True)
	return doc.name


@frappe.whitelist()
def send_document(
	to,
	document_url,
	filename=None,
	caption=None,
	reference_doctype=None,
	reference_name=None,
	whatsapp_account=None,
):
	if not document_url:
		frappe.throw("Document URL is required")

	if document_url.startswith("/"):
		document_url = frappe.utils.get_url(document_url)

	doc = frappe.get_doc(
		{
			"doctype": "WhatsApp Message",
			"to": to,
			"type": "Outgoing",
			"message_type": "Manual",
			"content_type": "document",
			"message": caption or "",
			"styled_message": caption or "",
			"file_url": document_url,
			"reference_doctype": reference_doctype,
			"reference_name": reference_name,
			"attach": document_url,
			"whatsapp_account": whatsapp_account,
		}
	)

	doc.insert(ignore_permissions=True)
	return doc.name


@frappe.whitelist()
def send_image(
	to, image_url, caption=None, reference_doctype=None, reference_name=None, whatsapp_account=None
):
	if not image_url:
		frappe.throw("Image URL is required")

	if image_url.startswith("/"):
		image_url = frappe.utils.get_url(image_url)

	doc = frappe.get_doc(
		{
			"doctype": "WhatsApp Message",
			"to": to,
			"type": "Outgoing",
			"message_type": "Manual",
			"content_type": "image",
			"message": caption or "",
			"styled_message": caption or "",
			"file_url": image_url,
			"reference_doctype": reference_doctype,
			"reference_name": reference_name,
			"attach": image_url,
			"whatsapp_account": whatsapp_account,
		}
	)

	doc.insert(ignore_permissions=True)
	return doc.name
