import frappe
from frappe.model.document import Document


class WhatsAppChatbot(Document):
    def validate(self):
        if self.enable_ai:
            if not self.ai_provider:
                frappe.throw("Please select an AI Provider when AI is enabled")
            if not self.ai_api_key:
                frappe.throw("Please enter an API Key when AI is enabled")

        if self.business_hours_only:
            if not self.business_hours or len(self.business_hours) == 0:
                frappe.throw("Please configure business hours for at least one day")

        if self.ai_temperature and (self.ai_temperature < 0 or self.ai_temperature > 1):
            frappe.throw("AI Temperature must be between 0 and 1")

    @frappe.whitelist()
    def populate_default_business_hours(self):
        """Populate business hours table with default weekday schedule."""
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        # Clear existing rows
        self.business_hours = []

        for day in days:
            # Weekdays are open 9-6, weekends closed
            is_weekday = day not in ["Saturday", "Sunday"]
            self.append("business_hours", {
                "day": day,
                "enabled": 1 if is_weekday else 0,
                "start_time": "09:00:00" if is_weekday else None,
                "end_time": "18:00:00" if is_weekday else None
            })

        self.save()
        return {"message": "Default business hours populated successfully"}
