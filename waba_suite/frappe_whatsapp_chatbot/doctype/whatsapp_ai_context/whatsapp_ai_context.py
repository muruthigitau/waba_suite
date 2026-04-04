import frappe
from frappe.model.document import Document


class WhatsAppAIContext(Document):
    def validate(self):
        if self.context_type == "Static Text" and not self.static_content:
            frappe.throw("Please enter Static Content for Static Text context type")

        if self.context_type == "DocType Query":
            if not self.doctype:
                frappe.throw("Please select a DocType for DocType Query context type")

            if self.filters:
                import json
                try:
                    json.loads(self.filters)
                except json.JSONDecodeError:
                    frappe.throw("Filters must be valid JSON")
