"""Tests for marking WhatsApp conversations as read.

Covers the shared ``waba_suite.api.message_utils.mark_messages_read`` helper
used by both the ``mark_as_read`` and ``mark_multiple_as_read`` endpoints.
"""

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase


class TestMarkMessagesRead(FrappeTestCase):
    """Verify unread inbound messages are marked read and counters clear."""

    ACCOUNT = "Test Read Status Account"
    MOBILE = "919900001111"
    OTHER_MOBILE = "919900002222"

    def setUp(self):
        if not frappe.db.exists("WhatsApp Account", self.ACCOUNT):
            frappe.get_doc(
                {
                    "doctype": "WhatsApp Account",
                    "account_name": self.ACCOUNT,
                    "status": "Active",
                    "url": "https://graph.facebook.com",
                    "version": "v17.0",
                    "phone_id": "read_status_phone_id",
                    "business_id": "read_status_business_id",
                    "app_id": "read_status_app_id",
                    "webhook_verify_token": "read_status_verify_token",
                    "allow_auto_read_receipt": 0,
                }
            ).insert(ignore_permissions=True)

        self.contact = self._get_or_create_contact("Test Read Status", self.MOBILE)
        self.other_contact = self._get_or_create_contact(
            "Test Read Status Other", self.OTHER_MOBILE
        )
        frappe.db.commit()

    def _get_or_create_contact(self, contact_name, mobile):
        name = frappe.db.get_value(
            "WhatsApp Contact", {"mobile_no": mobile}, "name"
        )
        if name:
            return name
        return frappe.get_doc(
            {
                "doctype": "WhatsApp Contact",
                "contact_name": contact_name,
                "mobile_no": mobile,
            }
        ).insert(ignore_permissions=True).name

    def tearDown(self):
        for mobile in (self.MOBILE, self.OTHER_MOBILE):
            for name in frappe.get_all(
                "WhatsApp Message", filters={"from": mobile}, pluck="name"
            ):
                frappe.delete_doc("WhatsApp Message", name, force=True)
        frappe.db.commit()

    def _create_incoming(self, mobile, message_id, contact=None):
        doc = frappe.get_doc(
            {
                "doctype": "WhatsApp Message",
                "type": "Incoming",
                "from": mobile,
                "message": "Ping",
                "message_id": message_id,
                "content_type": "text",
                "whatsapp_account": self.ACCOUNT,
                "whatsapp_contact": contact,
            }
        )
        doc.insert(ignore_permissions=True)
        return doc

    @patch(
        "waba_suite.waba_suite.doctype.whatsapp_message.whatsapp_message.process_incoming_sync"
    )
    @patch("waba_suite.api.message_utils.send_whatsapp_read_receipts_sync")
    def test_marks_all_unread_inbound_messages_as_read(
        self, mock_receipts, mock_process
    ):
        first = self._create_incoming(self.MOBILE, "wamid.read.test.1")
        second = self._create_incoming(self.MOBILE, "wamid.read.test.2")
        frappe.db.commit()

        from waba_suite.api.message_utils import mark_messages_read

        marked = mark_messages_read(self.contact, self.ACCOUNT)

        self.assertEqual(marked, 2)
        for name in (first.name, second.name):
            self.assertEqual(
                frappe.db.get_value("WhatsApp Message", name, "status"),
                "marked_as_read",
            )
        self.assertEqual(
            frappe.db.get_value("WhatsApp Contact", self.contact, "is_read"), 1
        )
        mock_receipts.assert_called_once_with(self.contact, self.ACCOUNT)

    @patch(
        "waba_suite.waba_suite.doctype.whatsapp_message.whatsapp_message.process_incoming_sync"
    )
    @patch("waba_suite.api.message_utils.send_whatsapp_read_receipts_sync")
    def test_is_idempotent_when_nothing_unread(self, mock_receipts, mock_process):
        from waba_suite.api.message_utils import mark_messages_read

        self.assertEqual(mark_messages_read(self.contact, self.ACCOUNT), 0)

    @patch(
        "waba_suite.waba_suite.doctype.whatsapp_message.whatsapp_message.process_incoming_sync"
    )
    @patch("waba_suite.api.message_utils.send_whatsapp_read_receipts_sync")
    def test_does_not_touch_other_contacts(self, mock_receipts, mock_process):
        self._create_incoming(self.MOBILE, "wamid.read.test.3")
        other = self._create_incoming(self.OTHER_MOBILE, "wamid.read.test.4")
        frappe.db.commit()

        from waba_suite.api.message_utils import mark_messages_read

        mark_messages_read(self.contact, self.ACCOUNT)

        self.assertEqual(
            frappe.db.get_value("WhatsApp Message", other.name, "status"),
            "draft",
        )

    @patch(
        "waba_suite.waba_suite.doctype.whatsapp_message.whatsapp_message.process_incoming_sync"
    )
    def test_contacts_get_exposes_whatsapp_account(self, mock_process):
        self._create_incoming(
            self.MOBILE, "wamid.read.test.5", contact=self.contact
        )
        frappe.db.commit()

        from waba_suite.api.contacts import get as get_contacts

        rows = get_contacts("", self.ACCOUNT)
        row = next((r for r in rows if r["name"] == self.contact), None)

        self.assertIsNotNone(row)
        self.assertEqual(row.get("whatsapp_account"), self.ACCOUNT)
