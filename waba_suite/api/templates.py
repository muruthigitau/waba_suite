"""Templates API for WhatsApp.

Provides endpoints to retrieve and send WhatsApp message templates,
including variable extraction and resolution.

Key dependencies:
    - frappe: ERPNext framework
    - re: Regular expression for template variable parsing
"""

import json
import re

import frappe
from frappe import _


@frappe.whitelist()
def get_standalone_templates(whatsapp_account=None):
	"""Get templates with no for_doctype set (standalone templates usable from chat).

	Args:
	    whatsapp_account: Optional filter for a specific WhatsApp account.

	Returns:
	    List of template dicts with name, template_name, header, header_type,
	    footer, template content, and variable indices for each section.
	"""
	filters = {
		"for_doctype": ["is", "not set"],
		"status": "Approved",
	}
	if whatsapp_account:
		filters["whatsapp_account"] = whatsapp_account

	templates = frappe.get_all(
		"WhatsApp Templates",
		filters=filters,
		fields=[
			"name",
			"template_name",
			"header",
			"header_type",
			"footer",
			"template",
		],
		order_by="template_name asc",
	)

	result = []
	for t in templates:
		header_vars = sorted(set(re.findall(r"\{\{(\d+)\}\}", t.get("header") or "")), key=int)
		body_vars = sorted(set(re.findall(r"\{\{(\d+)\}\}", t.get("template") or "")), key=int)
		footer_vars = sorted(set(re.findall(r"\{\{(\d+)\}\}", t.get("footer") or "")), key=int)
		total_vars = len(header_vars) + len(body_vars) + len(footer_vars)

		result.append(
			{
				"name": t["name"],
				"template_name": t["template_name"],
				"header": t.get("header") or "",
				"header_type": t.get("header_type") or "TEXT",
				"footer": t.get("footer") or "",
				"template": t.get("template") or "",
				"variables": list(range(1, total_vars + 1)),
				"header_vars": header_vars,
				"body_vars": body_vars,
				"footer_vars": footer_vars,
			}
		)

	return result


def extract_variable_values(filled_text, template_raw):
	"""Extract variable values from a filled template string.

	Parses the filled text against the raw template pattern to extract
	the values that were substituted into placeholders.

	Args:
	    filled_text: The template text with values filled in.
	    template_raw: The raw template with {{N}} placeholders.

	Returns:
	    List of extracted variable values in order.
	"""
	values = []
	if not template_raw or "{{" not in template_raw:
		return values
	placeholder_pattern = re.compile(r"\{\{\d+\}\}")
	delimiter = "|||VAR_SPLIT|||"
	raw_with_delimiters = placeholder_pattern.sub(delimiter, template_raw)
	raw_parts = raw_with_delimiters.split(delimiter)
	remaining = filled_text
	for i, part in enumerate(raw_parts):
		if i >= len(raw_parts) - 1:
			break
		if part and part in remaining:
			idx = remaining.find(part) + len(part)
			next_part = raw_parts[i + 1]
			if next_part and next_part in remaining[idx:]:
				val_end = remaining[idx:].find(next_part)
				val = remaining[idx : idx + val_end].strip()
				values.append(val)
				remaining = remaining[idx + val_end :]
			else:
				val = remaining[idx:].strip()
				values.append(val)
				remaining = ""
		elif not part:
			next_part = raw_parts[i + 1]
			if next_part and next_part in remaining:
				val_end = remaining.find(next_part)
				val = remaining[:val_end].strip()
				values.append(val)
				remaining = remaining[val_end:]
			else:
				values.append(remaining.strip())
				remaining = ""
	return values


@frappe.whitelist()
def send_template(
	header="",
	body="",
	footer="",
	template_name="",
	template_raw="",
	template_header_raw="",
	template_footer_raw="",
	whatsapp_account=None,
	user=None,
	room=None,
	user_no=None,
):
	"""Send a template message.

	Creates a WhatsApp Message document with template data and extracted
	variable values for the Facebook API.

	Args:
	    header: Filled header text.
	    body: Filled body text.
	    footer: Filled footer text.
	    template_name: Name of the WhatsApp Templates doctype.
	    template_raw: Raw body template with placeholders.
	    template_header_raw: Raw header template with placeholders.
	    template_footer_raw: Raw footer template with placeholders.
	    whatsapp_account: WhatsApp account identifier.
	    user: User identifier.
	    room: WhatsApp Contact name.
	    user_no: Recipient phone number.

	Returns:
	    Dict with status and message_id on success, or status and error on failure.
	"""
	try:
		contact = frappe.get_doc("WhatsApp Contact", room)
		tpl = frappe.get_doc("WhatsApp Templates", template_name) if template_name else None

		header_values = (
			extract_variable_values(header, template_header_raw or tpl.header if tpl else "")
			if header
			else []
		)
		body_values = (
			extract_variable_values(body, template_raw or tpl.template if tpl else "") if body else []
		)
		footer_values = (
			extract_variable_values(footer, template_footer_raw or tpl.footer if tpl else "")
			if footer
			else []
		)

		message_data = json.dumps(
			{
				"template_name": template_name,
				"body_values": body_values,
				"header_values": header_values,
				"footer_values": footer_values,
				"filled_header": header,
				"filled_body": body,
				"filled_footer": footer,
				"header": {},
				"buttons": [],
			},
			indent=2,
		)

		msg_doc = frappe.get_doc(
			{
				"doctype": "WhatsApp Message",
				"to": user_no,
				"type": "Outgoing",
				"message": message_data,
				"content_type": "text",
				"message_type": "Template",
				"use_template": 1,
				"template": template_name,
				"status": "draft",
				"whatsapp_account": whatsapp_account or contact.whatsapp_account,
				"whatsapp_contact": contact.name,
			}
		)
		msg_doc.insert(ignore_permissions=True)
		frappe.db.commit()

		return {"status": "ok", "message_id": msg_doc.name}
	except Exception:
		frappe.log_error(title="WhatsApp send_template Error", message=frappe.get_traceback())
		return {"status": "error", "message": str(frappe.get_traceback())}
