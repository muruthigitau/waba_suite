"""WhatsApp Chat Preference DocType.

Stores per-user chat preferences (pin, star, archive) for WhatsApp contacts.

Key dependencies:
    - frappe: ERPNext framework
"""

import frappe
from frappe.model.document import Document


class WhatsAppChatPreference(Document):
    """DocType for user chat preferences.

    Tracks pin, star, and archive status per user-contact pair.
    """

    def validate(self):
        """Ensure the user_contact_key is properly set."""
        if not self.user_contact_key:
            self.user_contact_key = f"{self.user}_{self.whatsapp_contact}"