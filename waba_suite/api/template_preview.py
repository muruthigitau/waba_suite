"""Template Preview API for WhatsApp.

Provides endpoints to preview and send WhatsApp message templates
with variable resolution from source documents.

Key dependencies:
    - frappe: ERPNext framework
    - re: Regular expression for template variable parsing
"""

import json
import re

import frappe
from frappe import _


@frappe.whitelist()
def preview_template(
    template,
    reference_doctype=None,
    reference_name=None,
    whatsapp_account=None,
    print_format=None,
    send=False,
    variable_overrides=None,
    to=None,
):
    """Preview and send template messages.

    If send=True and to is provided, creates and sends the WhatsApp Message.
    Otherwise returns preview data only.

    Args:
        template: Name of the WhatsApp Templates doctype.
        reference_doctype: Optional source document type for variable resolution.
        reference_name: Optional source document name for variable resolution.
        whatsapp_account: WhatsApp account identifier.
        print_format: Optional print format for document header type.
        send: If True, sends the message instead of returning preview.
        variable_overrides: JSON dict of variable index -> value overrides.
        to: Recipient phone number (required when send=True).

    Returns:
        Preview dict with filled template content, or send result dict.
    """
    if not template:
        frappe.throw("Template is required")

    source_doc = None
    if reference_doctype and reference_name:
        source_doc = frappe.get_doc(reference_doctype, reference_name)

    template_doc = frappe.get_doc("WhatsApp Templates", template)

    overrides = {}
    if variable_overrides:
        try:
            overrides = json.loads(variable_overrides)
        except Exception:
            pass

    variables = template_doc.get("variables") or []

    resolved_vars = []
    seen_keys = set()

    for var in variables:
        key = None
        if var.source_type == "DocField" and var.field_name:
            key = (var.type or "Body", "DocField", var.field_name)
        elif var.source_type == "Static" and var.static_value:
            key = (var.type or "Body", "Static", var.static_value)
        elif var.source_type == "Computed" and var.expression:
            key = (var.type or "Body", "Computed", var.expression)
        else:
            continue

        if key in seen_keys:
            continue
        seen_keys.add(key)

        value = "-"
        if var.source_type == "DocField" and source_doc:
            value = source_doc.get(var.field_name) or "-"
        elif var.source_type == "Static":
            value = var.static_value or "-"
        elif var.source_type == "Computed" and source_doc:
            ctx = {
                "doc": source_doc,
                "get_url": frappe.utils.get_url,
                "fmt_money": frappe.utils.fmt_money,
                "format_date": frappe.utils.formatdate,
            }
            try:
                value = str(eval(var.expression, {"__builtins__": {}}, ctx))
            except Exception:
                value = "-"

        if value in [None, "", "None"]:
            value = "-"
        value = str(value)

        var_type = (var.type or "Body").strip().lower()
        var_index = var.get("index") or 0
        if str(var_index) in overrides:
            value = overrides[str(var_index)]

        resolved_vars.append(
            {
                "index": var_index,
                "type": var_type,
                "label": var.field_name or var.static_value or var.expression or "",
                "value": value,
                "source_type": var.source_type,
                "field_name": var.field_name or var.static_value or var.expression or "",
            }
        )

    template_name = template_doc.template_name
    header_raw = template_doc.get("header") or ""
    body_raw = template_doc.get("template") or ""
    footer_raw = template_doc.get("footer") or ""

    filled_header = _fill_template(header_raw, resolved_vars)
    filled_body = _fill_template(body_raw, resolved_vars)
    filled_footer = _fill_template(footer_raw, resolved_vars)

    file_url = None
    filename = None
    if template_doc.header_type == "DOCUMENT" and source_doc:
        pdf = frappe.attach_print(
            doctype=source_doc.doctype,
            name=source_doc.name,
            doc=source_doc,
            print_format=print_format,
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

    if send and to:
        return _send_preview(
            template=template,
            to=to,
            reference_doctype=reference_doctype,
            reference_name=reference_name,
            whatsapp_account=whatsapp_account,
            print_format=print_format,
            file_url=file_url,
            template_doc=template_doc,
            header_raw=header_raw,
            body_raw=body_raw,
            footer_raw=footer_raw,
            resolved_vars=resolved_vars,
        )

    return {
        "template_name": template_name,
        "filled_header": filled_header,
        "filled_body": filled_body,
        "filled_footer": filled_footer,
        "variables": resolved_vars,
        "header_type": template_doc.header_type,
        "file_url": file_url,
        "filename": filename,
    }


def _fill_template(template_text, resolved_vars):
    """Fill template placeholders with resolved variable values.

    Args:
        template_text: Raw template text with {{N}} placeholders.
        resolved_vars: List of resolved variable dicts with index and value.

    Returns:
        Filled template string.
    """
    if not template_text or "{{" not in template_text:
        return template_text

    var_by_index = {}
    for v in resolved_vars:
        var_by_index[v["index"]] = v["value"]

    def _replace(match):
        idx = int(match.group(1))
        return var_by_index.get(idx, match.group(0))

    return re.sub(r"\{\{(\d+)\}\}", _replace, template_text)


def _send_preview(
    template,
    to,
    reference_doctype,
    reference_name,
    whatsapp_account,
    print_format,
    file_url,
    template_doc,
    header_raw,
    body_raw,
    footer_raw,
    resolved_vars,
):
    """Send a template message after preview.

    Creates a WhatsApp Message document with the resolved template data
    and sends it via the WhatsApp API.

    Args:
        template: Template name.
        to: Recipient phone number.
        reference_doctype: Source document type.
        reference_name: Source document name.
        whatsapp_account: WhatsApp account identifier.
        print_format: Print format for document header.
        file_url: URL of attached file (for document headers).
        template_doc: WhatsApp Templates document.
        header_raw: Raw header template text.
        body_raw: Raw body template text.
        footer_raw: Raw footer template text.
        resolved_vars: List of resolved variable dicts.

    Returns:
        Dict with status, message_id, and recipient.
    """
    _re = __import__("re")

    header_map = {}
    body_map = {}
    footer_map = {}
    for v in resolved_vars:
        key = (v["type"], v["source_type"], v["field_name"])
        if v["type"] == "header":
            if key not in header_map:
                header_map[key] = (v["index"], v["value"])
        elif v["type"] == "footer":
            if key not in footer_map:
                footer_map[key] = (v["index"], v["value"])
        else:
            if key not in body_map:
                body_map[key] = (v["index"], v["value"])

    def build_params(pm, expected):
        si = sorted(pm.items(), key=lambda x: x[1][0])
        r = [{"type": "text", "text": v} for _, (_, v) in si]
        if expected > 0:
            r = r[:expected]
        return r

    hp = build_params(
        header_map, len(_re.findall(r"\{\{(\d+)\}\}", header_raw))
    )
    bp = build_params(
        body_map, len(_re.findall(r"\{\{(\d+)\}\}", body_raw))
    )
    fp = build_params(
        footer_map, len(_re.findall(r"\{\{(\d+)\}\}", footer_raw))
    )

    components = []
    if hp:
        components.append({"type": "header", "parameters": hp})
    if bp:
        components.append({"type": "body", "parameters": bp})
    if fp:
        components.append({"type": "footer", "parameters": fp})

    bv = [p["text"] for p in bp]
    hv = hp[0]["text"] if hp else ""
    message_data = json.dumps(
        {
            "template_name": template,
            "body_values": bv,
            "header": (
                {"type": "TEXT", "text": hv}
                if hp
                else (
                    {
                        "type": "DOCUMENT",
                        "filename": (file_url or "").split("/")[-1],
                        "url": file_url,
                    }
                    if file_url
                    else {}
                )
            ),
            "buttons": [],
        },
        indent=2,
    )

    doc = frappe.get_doc(
        {
            "doctype": "WhatsApp Message",
            "to": to,
            "type": "Outgoing",
            "message": message_data,
            "content_type": "text",
            "message_type": "Template",
            "use_template": 1,
            "template": template,
            "print_format": print_format,
            "file_url": file_url,
            "whatsapp_account": whatsapp_account,
        }
    )
    doc.insert(ignore_permissions=True)
    frappe.db.set_value(
        "WhatsApp Message",
        doc.name,
        {
            "reference_doctype": reference_doctype,
            "reference_name": reference_name,
        },
    )
    frappe.db.commit()

    return {"status": "sent", "message_id": doc.name, "to": to}