"""Notification.

Builds a standard WhatsApp Message document (Template) from the notification's
`variables` table (mirroring WhatsApp Templates), inserts it, and lets the
normal WhatsApp Message lifecycle send it through the API. No direct API call
is made here.
"""

import json
import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils.safe_exec import get_safe_globals, safe_exec

from waba_suite.utils import get_whatsapp_account


class WhatsAppNotification(Document):
    """WhatsApp Notification document.

    Determines when/how to send a WhatsApp template based on a source document
    event or a scheduled frequency. Key methods:
        - validate: Validates configured fields and conditions.
        - send_template_message: Builds and inserts a template WhatsApp Message.
        - send_scheduled_message: Scheduler-event entry point.
    """

    def validate(self):
        """Validate config fields: reference field, attachment, and property."""
        if self.notification_type == "DocType Event":
            fields = frappe.get_doc("DocType", self.reference_doctype).fields
            fields += frappe.get_all(
                "Custom Field",
                filters={"dt": self.reference_doctype},
                fields=["fieldname"],
            )
            if not any(field.fieldname == self.field_name for field in fields):  # noqa
                frappe.throw(
                    _("Field name {0} does not exists").format(self.field_name)
                )
        if self.custom_attachment:
            if not self.attach and not self.attach_from_field:
                frappe.throw(
                    _("Either {0} a file or add a {1} to send attachemt").format(
                        frappe.bold(_("Attach")),
                        frappe.bold(_("Attach from field")),
                    )
                )

        if self.set_property_after_alert:
            meta = frappe.get_meta(self.reference_doctype)
            if not meta.get_field(self.set_property_after_alert):
                frappe.throw(
                    _("Field {0} not found on DocType {1}").format(
                        self.set_property_after_alert,
                        self.reference_doctype,
                    )
                )

    # ─── Scheduler Event entry point ──────────────────────────────────────
    def send_scheduled_message(self) -> dict:
        """Send scheduled messages for Scheduler Event notifications.

        Runs the configured condition script, then either sends a simple
        template to each contact in `_contact_list` or a dynamic template to
        each source document in `_data_list`.

        Returns:
            The dict produced by the condition script execution.
        """
        safe_exec(self.condition, get_safe_globals(), dict(doc=self))

        template = frappe.db.get_value(
            "WhatsApp Templates", self.template, fieldname="*"
        )

        if template and template.language_code:
            if self.get("_contact_list"):
                # send simple template without a doc to get field data.
                self.send_simple_template(template)
            elif self.get("_data_list"):
                # allow send a dynamic template using schedule event config
                # _doc_list shoud be [{"name": "xxx", "phone_no": "123"}]
                for data in self._data_list:
                    doc = frappe.get_doc(self.reference_doctype, data.get("name"))

                    self.send_template_message(
                        doc, data.get("phone_no"), template, True
                    )

    def send_simple_template(self, template):
        """Send a simple template message (no source doc) by inserting a
        WhatsApp Message which sends through the normal lifecycle."""
        for contact in self._contact_list:
            phone = self.format_number(contact)
            self._insert_whatsapp_message(
                to=phone,
                template_name=template.name,
                template=template,
                variables=None,
                doc=None,
            )

    # ─── Document Event entry point ───────────────────────────────────────
    def send_template_message(
        self,
        doc: Document,
        phone_no=None,
        default_template=None,
        ignore_condition=False,
    ):
        """Build and insert a WhatsApp Message (Template) using the notification's
        `variables` table, exactly like WhatsApp Templates do. The inserted
        message is sent by the normal WhatsApp Message `after_insert` flow.

        Args:
            doc: Source document.
            phone_no: Optional phone number override.
            default_template: Pre-fetched template doc.
            ignore_condition: Skip condition evaluation.
        """
        if self.disabled:
            return

        doc_data = doc.as_dict()
        if self.condition and not ignore_condition:
            if not frappe.safe_eval(
                self.condition, get_safe_globals(), dict(doc=doc_data)
            ):
                return

        template = default_template or frappe.get_doc(
            "WhatsApp Templates", self.template
        )

        if not template:
            return

        if self.field_name:
            phone_number = phone_no or doc_data.get(self.field_name)
        else:
            phone_number = phone_no

        if not phone_number:
            return

        self._insert_whatsapp_message(
            to=self.format_number(phone_number),
            template_name=template.name,
            template=template,
            variables=self.variables,
            doc=doc,
            doc_data=doc_data,
        )

    def _insert_whatsapp_message(
        self,
        to,
        template_name,
        template,
        variables=None,
        doc=None,
        doc_data=None,
    ):
        """Resolve variables (Header/Body/Footer via the variables table),
        generate a document file if header type is DOCUMENT (like normal
        templates), and insert a WhatsApp Message that sends through
        `after_insert` → `process_outgoing_send` → `send_whatsapp_message`."""
        source_doc = doc
        overrides = {}

        header_map, body_map, footer_map = self._build_variable_maps(
            variables or [],
            source_doc,
            overrides,
        )

        _re = re
        hp = self._build_params(
            header_map,
            len(_re.findall(r"\{\{(\d+)\}\}", template.get("header") or "")),
        )
        bp = self._build_params(
            body_map,
            len(_re.findall(r"\{\{(\d+)\}\}", template.get("template") or "")),
        )
        fp = self._build_params(
            footer_map,
            len(_re.findall(r"\{\{(\d+)\}\}", template.get("footer") or "")),
        )

        bv = [p["text"] for p in bp]
        hv = hp[0]["text"] if hp else ""

        # DOCUMENT header: generate a print/PDF file like normal templates.
        file_url = None
        if template.get("header_type") == "DOCUMENT":
            if doc:
                file_url = self._generate_document_file(doc)

        header = {}
        if hp:
            header = {"type": "TEXT", "text": hv}
        elif file_url and template.get("header_type") == "DOCUMENT":
            header = {
                "type": "DOCUMENT",
                "filename": file_url.split("/")[-1],
                "url": file_url,
            }

        message_data = json.dumps(
            {
                "template_name": template_name,
                # These must be plain string lists: send_template() wraps each
                # into {"type":"text","text": v}. Storing dicts nests them and
                # breaks the WhatsApp JSON schema.
                "body_values": bv,
                "header_values": [p["text"] for p in hp],
                "footer_values": [p["text"] for p in fp],
                "header": header,
                "buttons": [],
            },
            indent=2,
        )

        # Use the account set on the notification (new required field); fall
        # back to the template's account or the default outgoing account.
        whatsapp_account = (
            self.get("whatsapp_account")
            or template.get("whatsapp_account")
            or (get_whatsapp_account(account_type="outgoing").name if get_whatsapp_account(account_type="outgoing") else None)
        )

        new_doc = frappe.get_doc(
            {
                "doctype": "WhatsApp Message",
                "to": to,
                "type": "Outgoing",
                "message": message_data,
                "content_type": "text",
                "message_type": "Template",
                "use_template": 1,
                "template": template_name,
                "file_url": file_url,
                "whatsapp_account": whatsapp_account,
            }
        )

        if doc and getattr(doc, "doctype", None):
            try:
                new_doc.reference_doctype = doc.doctype
                new_doc.reference_name = doc.name
            except Exception:
                pass

        # Inserting an Outgoing Template message triggers after_insert →
        # process_outgoing_send → send_template → send_whatsapp_message.
        new_doc.insert(ignore_permissions=True)

        # Persist the message immediately so it ALWAYS gets saved, even if a
        # downstream send step raises and would otherwise roll back the insert.
        frappe.db.commit()

        if (
            doc
            and doc_data
            and self.set_property_after_alert
            and self.property_value
        ):
            fieldname = self.set_property_after_alert
            value = self.property_value
            df = frappe.get_meta(doc.doctype).get_field(fieldname)
            if df:
                if df.fieldtype in frappe.model.numeric_fieldtypes:
                    value = frappe.utils.cint(value)
                frappe.db.set_value(
                    doc.doctype, doc.name, fieldname, value
                )
                frappe.db.commit()

    def _build_variable_maps(self, variables, source_doc, overrides):
        """Build header/body/footer variable maps from the variables table,
        mirroring WhatsApp Templates logic."""
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

    def _build_params(self, pm, expected):
        """Sort variable maps by index and return text params list."""
        si = sorted(pm.items(), key=lambda x: x[1][0])
        r = [{"type": "text", "text": v} for _, (_, v) in si]
        if expected > 0:
            r = r[:expected]
        return r

    def _generate_document_file(self, source_doc, print_format=None):
        """Generate a PDF print file (like normal templates' DOCUMENT header)."""
        from frappe.utils import get_url

        print_format = print_format or (source_doc.meta.default_print_format if hasattr(source_doc.meta, "default_print_format") else None)
        try:
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
                return get_url(fd.file_url)
        except Exception:
            frappe.log_error(
                title="WhatsApp Notification Print Error",
                message=frappe.get_traceback(),
            )
        return None

    def on_trash(self):
        """On delete remove from schedule."""
        frappe.cache().delete_value("whatsapp_notification_map")

    def format_number(self, number):
        """Format number."""
        if not number:
            return number
        if number.startswith("+"):
            number = number[1 : len(number)]
        return number

    def get_documents_for_today(self):
        """get list of documents that will be triggered today"""
        diff_days = self.days_in_advance
        if self.doctype_event == "Days After":
            diff_days = -diff_days

        from frappe.utils import add_to_date, nowdate

        reference_date = add_to_date(nowdate(), days=diff_days)
        reference_date_start = reference_date + " 00:00:00.000000"
        reference_date_end = reference_date + " 23:59:59.000000"

        doc_list = frappe.get_all(
            self.reference_doctype,
            fields="name",
            filters=[
                {self.date_changed: (">=", reference_date_start)},
                {self.date_changed: ("<=", reference_date_end)},
            ],
        )

        for d in doc_list:
            doc = frappe.get_doc(self.reference_doctype, d.name)
            self.send_template_message(doc)


# ─── Module-level scheduled trigger ──────────────────────────────────────
@frappe.whitelist()
def call_trigger_notifications():
    """Trigger notifications."""
    try:
        trigger_notifications()
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error in call_trigger_notifications")
        raise e


def trigger_notifications(method="daily"):
    """Scheduled event: collect documents and insert WhatsApp Messages
    (not direct API sends)."""
    if frappe.flags.in_import or frappe.flags.in_patch:
        return

    if method == "daily":
        doc_list = frappe.get_all(
            "WhatsApp Notification",
            filters={
                "doctype_event": ("in", ("Days Before", "Days After")),
                "disabled": 0,
            },
        )
        for d in doc_list:
            alert = frappe.get_doc("WhatsApp Notification", d.name)
            alert.get_documents_for_today()