"""Template message helpers.

Builds and sends WhatsApp template messages by resolving variables from a
source document and constructing the template JSON payload stored on the
WhatsApp Message doctype.

Key dependencies:
    - frappe
"""

import json

import frappe


def _build_variable_maps(variables, source_doc, overrides):
    """Build variable maps for header, body, and footer sections.

    Args:
        variables: List of template variable child table rows.
        source_doc: Source document for field resolution.
        overrides: Dict of variable index -> value overrides.

    Returns:
        Tuple of (header_map, body_map, footer_map) dicts.
    """
    header_map = {}
    body_map = {}
    footer_map = {}

    for var in variables:
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

        key = None
        if var.source_type == "DocField" and var.field_name:
            key = (var_type, "DocField", var.field_name)
        elif var.source_type == "Static" and var.static_value:
            key = (var_type, "Static", var.static_value)
        elif var.source_type == "Computed" and var.expression:
            key = (var_type, "Computed", var.expression)
        if key:
            tm = body_map
            if var_type == "header":
                tm = header_map
            elif var_type == "footer":
                tm = footer_map
            if key not in tm:
                tm[key] = (var_index, value)

    return header_map, body_map, footer_map


def _build_params(pm, expected):
    """Sort variable maps by index and return text params list.

    Args:
        pm: Variable map (type key -> (index, value)).
        expected: Cap the output length; 0 means no limit.

    Returns:
        List of text param dicts.
    """
    si = sorted(pm.items(), key=lambda x: x[1][0])
    r = [{"type": "text", "text": v} for _, (_, v) in si]
    if expected > 0:
        r = r[:expected]
    return r


def _generate_document_file(source_doc, print_format):
    """Generate a PDF document file from a source document.

    Args:
        source_doc: Source document to print.
        print_format: Print format name.

    Returns:
        Public URL of the generated file, or None.
    """
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
        return frappe.utils.get_url(fd.file_url)
    return None


def build_template_message_data(template_doc, source_doc, print_format=None, variable_overrides=None):
    """Build the JSON template payload for a WhatsApp Message.

    Args:
        template_doc: WhatsApp Templates document.
        source_doc: Optional source document for variable resolution.
        print_format: Optional print format for DOCUMENT headers.
        variable_overrides: JSON string or dict of index -> value overrides.

    Returns:
        Tuple of (message_data JSON string, file_url or None).
    """
    file_url = None
    if template_doc.header_type == "DOCUMENT" and source_doc:
        file_url = _generate_document_file(source_doc, print_format)

    overrides = {}
    if variable_overrides:
        try:
            overrides = json.loads(variable_overrides)
        except Exception:
            pass

    import re as _re

    variables = template_doc.get("variables") or []
    header_map, body_map, footer_map = _build_variable_maps(
        variables, source_doc, overrides
    )

    hp = _build_params(
        header_map,
        len(_re.findall(r"\{\{(\d+)\}\}", template_doc.get("header") or "")),
    )
    bp = _build_params(
        body_map,
        len(_re.findall(r"\{\{(\d+)\}\}", template_doc.get("template") or "")),
    )
    fp = _build_params(
        footer_map,
        len(_re.findall(r"\{\{(\d+)\}\}", template_doc.get("footer") or "")),
    )

    bv = [p["text"] for p in bp]
    hv = hp[0]["text"] if hp else ""
    message_data = json.dumps(
        {
            "template_name": template_doc.name,
            "body_values": bv,
            "header": (
                {"type": "TEXT", "text": hv}
                if hp
                else (
                    {
                        "type": "DOCUMENT",
                        "filename": file_url.split("/")[-1],
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
    return message_data, file_url