# Copyright (c) 2024, Shridhar Patil and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class WhatsAppAgentTransfer(Document):
    def before_save(self):
        # If status changed to Resumed, record when and by whom
        if self.has_value_changed("status") and self.status == "Resumed":
            self.resumed_at = now_datetime()
            self.resumed_by = frappe.session.user

    @staticmethod
    def is_transferred(phone_number, whatsapp_account=None):
        """Check if a phone number is currently transferred to an agent.

        Args:
            phone_number: The phone number to check
            whatsapp_account: Optional WhatsApp account filter

        Returns:
            bool: True if transferred and active, False otherwise
        """
        filters = {
            "phone_number": phone_number,
            "status": "Active"
        }
        if whatsapp_account:
            filters["whatsapp_account"] = whatsapp_account

        return frappe.db.exists("WhatsApp Agent Transfer", filters)

    @staticmethod
    def transfer_to_agent(phone_number, whatsapp_account=None, agent=None, notes=None):
        """Transfer a conversation to a human agent.

        Args:
            phone_number: The customer's phone number
            whatsapp_account: Optional WhatsApp account
            agent: Optional user to assign
            notes: Optional notes about the transfer

        Returns:
            WhatsApp Agent Transfer document
        """
        # Check if already transferred
        existing = frappe.db.exists("WhatsApp Agent Transfer", {
            "phone_number": phone_number,
            "status": "Active"
        })

        if existing:
            return frappe.get_doc("WhatsApp Agent Transfer", existing)

        doc = frappe.get_doc({
            "doctype": "WhatsApp Agent Transfer",
            "phone_number": phone_number,
            "whatsapp_account": whatsapp_account,
            "agent": agent,
            "notes": notes,
            "status": "Active",
            "transferred_at": now_datetime()
        })
        doc.insert(ignore_permissions=True)

        return doc

    @staticmethod
    def resume_chatbot(phone_number, whatsapp_account=None):
        """Resume chatbot for a phone number.

        Args:
            phone_number: The customer's phone number
            whatsapp_account: Optional WhatsApp account filter

        Returns:
            bool: True if resumed, False if no active transfer found
        """
        filters = {
            "phone_number": phone_number,
            "status": "Active"
        }
        if whatsapp_account:
            filters["whatsapp_account"] = whatsapp_account

        transfers = frappe.get_all("WhatsApp Agent Transfer", filters=filters)

        if not transfers:
            return False

        for transfer in transfers:
            doc = frappe.get_doc("WhatsApp Agent Transfer", transfer.name)
            doc.status = "Resumed"
            doc.save(ignore_permissions=True)

        return True
