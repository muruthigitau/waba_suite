import frappe
from frappe.model.document import Document
from frappe import _


class WhatsAppChatbotSettings(Document):
    def validate(self):
        if self.enabled:
            self.validate_duplicate()

        if self.enable_ai:
            if not self.ai_provider:
                frappe.throw(_("Please select an AI Provider when AI is enabled"))
            if not self.ai_api_key:
                frappe.throw(_("Please enter an API Key when AI is enabled"))

        if self.business_hours_only:
            if not self.business_hours or len(self.business_hours) == 0:
                frappe.throw(_("Please configure business hours for at least one day"))

        if self.ai_temperature and (self.ai_temperature < 0 or self.ai_temperature > 1):
            frappe.throw(_("AI Temperature must be between 0 and 1"))

    def validate_duplicate(self):
        if self.process_all_accounts:
            existing_active = frappe.db.exists(
                "WhatsApp Chatbot Settings", {"enabled": 1, "name": ["!=", self.name]}
            )
            if existing_active:
                frappe.throw(
                    _(
                        "Cannot enable 'Process All Accounts' while other active settings exist."
                    )
                )
        else:
            global_active = frappe.db.exists(
                "WhatsApp Chatbot Settings",
                {"enabled": 1, "process_all_accounts": 1, "name": ["!=", self.name]},
            )
            if global_active:
                frappe.throw(_("A 'Process All Accounts' setting is already active."))

            if self.whatsapp_account:
                duplicate = frappe.db.exists(
                    "WhatsApp Chatbot Settings",
                    {
                        "enabled": 1,
                        "whatsapp_account": self.whatsapp_account,
                        "name": ["!=", self.name],
                    },
                )
                if duplicate:
                    frappe.throw(
                        _("An active setting already exists for account {0}").format(
                            self.whatsapp_account
                        )
                    )

    @frappe.whitelist()
    def populate_default_business_hours(self):
        days = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]
        self.business_hours = []

        for day in days:
            is_weekday = day not in ["Saturday", "Sunday"]
            self.append(
                "business_hours",
                {
                    "day": day,
                    "enabled": 1 if is_weekday else 0,
                    "start_time": "09:00:00" if is_weekday else None,
                    "end_time": "18:00:00" if is_weekday else None,
                },
            )

        self.save()
        return {"message": "Default business hours populated successfully"}
