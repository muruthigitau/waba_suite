import frappe
from frappe.model.document import Document


class WhatsAppKeywordReply(Document):
    def validate(self):
        self.validate_keywords()
        self.validate_response()
        self.validate_dates()

    def validate_keywords(self):
        if not self.keywords or not self.keywords.strip():
            frappe.throw("Please enter at least one keyword")

        # Validate regex if match_type is Regex
        if self.match_type == "Regex":
            import re
            keywords = [k.strip() for k in self.keywords.split(",")]
            for keyword in keywords:
                try:
                    re.compile(keyword)
                except re.error as e:
                    frappe.throw(f"Invalid regex pattern '{keyword}': {str(e)}")

    def validate_response(self):
        if self.response_type == "Text" and not self.response_text:
            frappe.throw("Please enter Response Text for Text response type")
        elif self.response_type == "Template" and not self.response_template:
            frappe.throw("Please select a Template for Template response type")
        elif self.response_type == "Media":
            if not self.media_type:
                frappe.throw("Please select Media Type for Media response type")
            if not self.media_url:
                frappe.throw("Please enter Media URL for Media response type")
        elif self.response_type == "Flow" and not self.trigger_flow:
            frappe.throw("Please select a Flow for Flow response type")

    def validate_dates(self):
        if self.active_from and self.active_until:
            if self.active_from > self.active_until:
                frappe.throw("Active From date must be before Active Until date")
