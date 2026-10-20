"""Tests for the WhatsApp template preview API helpers."""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestGetDefaultPrintFormat(FrappeTestCase):
    """``get_default_print_format`` must ignore DocType read permission."""

    USER = "read_fmt_test@example.com"

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.db.rollback()

    def test_returns_database_value(self):
        from waba_suite.api.template_preview import get_default_print_format

        expected = frappe.db.get_value("DocType", "ToDo", "default_print_format")
        self.assertEqual(get_default_print_format("ToDo"), expected)

    def test_returns_none_without_doctype(self):
        from waba_suite.api.template_preview import get_default_print_format

        self.assertIsNone(get_default_print_format(""))

    def test_works_without_doctype_read_permission(self):
        from waba_suite.api.template_preview import get_default_print_format

        expected = frappe.db.get_value("DocType", "ToDo", "default_print_format")

        if not frappe.db.exists("User", self.USER):
            frappe.get_doc(
                {
                    "doctype": "User",
                    "email": self.USER,
                    "first_name": "Read Fmt Test",
                    "send_welcome_email": 0,
                    "user_type": "Website User",
                }
            ).insert(ignore_permissions=True)

        # A plain user cannot read the DocType doctype, so the permission-checked
        # client API would fail — our helper reads it directly and must succeed.
        frappe.set_user(self.USER)
        self.assertEqual(get_default_print_format("ToDo"), expected)
