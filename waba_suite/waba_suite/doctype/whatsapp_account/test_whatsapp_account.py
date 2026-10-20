# Copyright (c) 2025, Shridhar Patil and Contributors
# See license.txt

from datetime import datetime
from unittest.mock import patch

import frappe
from waba_suite.testing import IntegrationTestCase


class TestWhatsAppAccount(IntegrationTestCase):
    """Tests for WhatsApp Account doctype."""

    def setUp(self):
        # Clean up any existing test accounts
        for name in frappe.get_all(
            "WhatsApp Account",
            filters={"account_name": ["like", "Test WA Account%"]},
            pluck="name",
        ):
            frappe.delete_doc("WhatsApp Account", name, force=True)
        # Clear ALL defaults to prevent cascading on_update side effects
        # (other test classes' accounts would trigger there_must_be_only_one_default)
        frappe.db.sql(
            "UPDATE `tabWhatsApp Account` SET is_default_incoming=0, is_default_outgoing=0"
        )
        frappe.db.commit()

    def tearDown(self):
        for name in frappe.get_all(
            "WhatsApp Account",
            filters={"account_name": ["like", "Test WA Account%"]},
            pluck="name",
        ):
            frappe.delete_doc("WhatsApp Account", name, force=True)
        frappe.db.commit()

    def _make_account(self, account_name="Test WA Account 1", **kwargs):
        """Helper to create a WhatsApp Account."""
        doc = frappe.get_doc(
            {
                "doctype": "WhatsApp Account",
                "account_name": account_name,
                "status": kwargs.get("status", "Active"),
                "url": kwargs.get("url", "https://graph.facebook.com"),
                "version": kwargs.get("version", "v17.0"),
                "phone_id": kwargs.get(
                    "phone_id", f"phone_{account_name.replace(' ', '_')}"
                ),
                "business_id": kwargs.get("business_id", "test_business_id"),
                "app_id": kwargs.get("app_id", "test_app_id"),
                "webhook_verify_token": kwargs.get(
                    "webhook_verify_token", f"verify_{account_name.replace(' ', '_')}"
                ),
                "is_default_incoming": kwargs.get("is_default_incoming", 0),
                "is_default_outgoing": kwargs.get("is_default_outgoing", 0),
            }
        )
        doc.insert(ignore_permissions=True)
        if kwargs.get("token"):
            from frappe.utils.password import set_encrypted_password

            set_encrypted_password(
                "WhatsApp Account", doc.name, kwargs["token"], "token"
            )
        return doc

    def test_account_creation(self):
        """Test basic account creation."""
        doc = self._make_account()
        self.assertTrue(frappe.db.exists("WhatsApp Account", doc.name))
        self.assertEqual(doc.status, "Active")
        self.assertEqual(doc.url, "https://graph.facebook.com")

    def test_account_autoname(self):
        """Test account is named from account_name field."""
        doc = self._make_account(account_name="Test WA Account Autoname")
        self.assertEqual(doc.name, "Test WA Account Autoname")

    def test_unique_phone_id(self):
        """Test phone_id must be unique."""
        self._make_account(
            account_name="Test WA Account Unique1", phone_id="unique_phone_id"
        )
        with self.assertRaises(frappe.UniqueValidationError):
            self._make_account(
                account_name="Test WA Account Unique2", phone_id="unique_phone_id"
            )

    def test_unique_webhook_verify_token(self):
        """Test webhook_verify_token must be unique."""
        self._make_account(
            account_name="Test WA Account Token1", webhook_verify_token="same_token"
        )
        with self.assertRaises(frappe.UniqueValidationError):
            self._make_account(
                account_name="Test WA Account Token2", webhook_verify_token="same_token"
            )

    def test_only_one_default_incoming(self):
        """Test only one account can be default incoming."""
        doc1 = self._make_account(
            account_name="Test WA Account Default1",
            is_default_incoming=1,
            phone_id="default_phone_1",
            webhook_verify_token="default_verify_1",
        )
        doc2 = self._make_account(
            account_name="Test WA Account Default2",
            is_default_incoming=1,
            phone_id="default_phone_2",
            webhook_verify_token="default_verify_2",
        )

        # After doc2 is set as default, doc1 should no longer be default
        doc1.reload()
        self.assertEqual(doc1.is_default_incoming, 0)
        self.assertEqual(doc2.is_default_incoming, 1)

    def test_only_one_default_outgoing(self):
        """Test only one account can be default outgoing."""
        doc1 = self._make_account(
            account_name="Test WA Account Out1",
            is_default_outgoing=1,
            phone_id="out_phone_1",
            webhook_verify_token="out_verify_1",
        )
        doc2 = self._make_account(
            account_name="Test WA Account Out2",
            is_default_outgoing=1,
            phone_id="out_phone_2",
            webhook_verify_token="out_verify_2",
        )

        doc1.reload()
        self.assertEqual(doc1.is_default_outgoing, 0)
        self.assertEqual(doc2.is_default_outgoing, 1)

    def test_setting_non_default_does_not_affect_others(self):
        """Test setting an account as non-default doesn't change others."""
        doc1 = self._make_account(
            account_name="Test WA Account Keep1",
            is_default_incoming=1,
            phone_id="keep_phone_1",
            webhook_verify_token="keep_verify_1",
        )
        doc2 = self._make_account(
            account_name="Test WA Account Keep2",
            is_default_incoming=0,
            phone_id="keep_phone_2",
            webhook_verify_token="keep_verify_2",
        )

        doc1.reload()
        self.assertEqual(doc1.is_default_incoming, 1)
        self.assertEqual(doc2.is_default_incoming, 0)

    def test_both_defaults_on_same_account(self):
        """Test same account can be both default incoming and outgoing."""
        doc = self._make_account(
            account_name="Test WA Account Both",
            is_default_incoming=1,
            is_default_outgoing=1,
        )
        doc.reload()
        self.assertEqual(doc.is_default_incoming, 1)
        self.assertEqual(doc.is_default_outgoing, 1)

    def _make_account_with_hours(self, **kwargs):
        """Helper to create an account with business hours."""
        doc = self._make_account(**kwargs)
        doc.enable_away_auto_reply = 1
        doc.away_message = "We are away. Please try again later."
        doc.business_hours = [
            {
                "day_of_week": "Monday",
                "start_time": "09:00:00",
                "end_time": "17:00:00",
            },
            {
                "day_of_week": "Wednesday",
                "start_time": "09:00:00",
                "end_time": "17:00:00",
            },
        ]
        doc.save(ignore_permissions=True)
        return doc

    def test_within_business_hours_on_matching_day(self):
        """Return True when current time falls inside a configured window."""
        doc = self._make_account_with_hours(account_name="Test WA Account Hours1")
        with patch(
            "waba_suite.waba_suite.doctype.whatsapp_account.whatsapp_account.get_datetime_in_timezone",
            return_value=datetime(2026, 8, 24, 10, 30, 0),
        ):  # Monday 10:30
            self.assertTrue(doc.is_within_business_hours())

    def test_outside_business_hours_on_matching_day(self):
        """Return False when current time is outside the window on a matching day."""
        doc = self._make_account_with_hours(account_name="Test WA Account Hours2")
        with patch(
            "waba_suite.waba_suite.doctype.whatsapp_account.whatsapp_account.get_datetime_in_timezone",
            return_value=datetime(2026, 8, 24, 18, 0, 0),
        ):  # Monday 18:00
            self.assertFalse(doc.is_within_business_hours())

    def test_outside_business_hours_on_non_matching_day(self):
        """Return False when the current day has no configured window."""
        doc = self._make_account_with_hours(account_name="Test WA Account Hours3")
        with patch(
            "waba_suite.waba_suite.doctype.whatsapp_account.whatsapp_account.get_datetime_in_timezone",
            return_value=datetime(2026, 8, 28, 10, 0, 0),
        ):  # Friday
            self.assertFalse(doc.is_within_business_hours())

    def test_within_business_hours_with_microseconds(self):
        """Return True inside a 00:00-18:00 window even when the time has microseconds."""
        doc = self._make_account(account_name="Test WA Account Hours6")
        doc.enable_away_auto_reply = 1
        doc.away_message = "We are away."
        doc.business_hours = [
            {
                "day_of_week": "Thursday",
                "start_time": "00:00:00",
                "end_time": "18:00:00",
            }
        ]
        doc.save(ignore_permissions=True)
        with patch(
            "waba_suite.waba_suite.doctype.whatsapp_account.whatsapp_account.get_datetime_in_timezone",
            return_value=datetime(2026, 8, 27, 5, 46, 8, 485927),
        ):  # Thursday 05:46:08.485927
            self.assertTrue(doc.is_within_business_hours())
            self.assertFalse(doc.send_away_reply_if_outside_hours(frappe._dict({"from": "1"})))

    def test_away_reply_sent_when_disabled(self):
        """No away reply when the feature is disabled."""
        doc = self._make_account(account_name="Test WA Account Hours4")
        doc.enable_away_auto_reply = 0
        doc.save(ignore_permissions=True)
        message_doc = frappe._dict({"from": "919876543210"})
        self.assertFalse(doc.send_away_reply_if_outside_hours(message_doc))

    def test_invalid_business_hours_rejected(self):
        """Raise validation error when end time is before start time."""
        doc = self._make_account(account_name="Test WA Account Hours5")
        doc.business_hours = [
            {
                "day_of_week": "Monday",
                "start_time": "17:00:00",
                "end_time": "09:00:00",
            }
        ]
        with self.assertRaises(frappe.ValidationError):
            doc.validate()
