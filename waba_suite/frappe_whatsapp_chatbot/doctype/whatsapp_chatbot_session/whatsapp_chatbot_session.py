import frappe
from frappe.model.document import Document


class WhatsAppChatbotSession(Document):
    def before_save(self):
        # Update last_activity on every save
        if self.status == "Active":
            self.last_activity = frappe.utils.now_datetime()

    def add_message(self, direction, message, step_name=None):
        """Add a message to the session history."""
        self.append("messages", {
            "direction": direction,
            "message": message,
            "timestamp": frappe.utils.now_datetime(),
            "step_name": step_name
        })
