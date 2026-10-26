"""Tests for bulk WhatsApp helper logic.

Covers recipient option filtering/pagination and the template value section
serialisation used when queueing bulk messages.
"""

import json
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from waba_suite.api.bulk_recipients import (
	_collect,
	_excluded_numbers,
	_normalize_number,
)


class TestBulkRecipientHelpers(FrappeTestCase):
	"""Pure helpers behind the bulk recipient picker endpoint."""

	def test_normalize_number_keeps_digits_only(self):
		self.assertEqual(_normalize_number("+254 (712) 345-678"), "254712345678")
		self.assertEqual(_normalize_number(None), "")

	def test_excluded_numbers_accepts_json_and_lists(self):
		self.assertEqual(_excluded_numbers('["+254712345678"]'), {"254712345678"})
		self.assertEqual(_excluded_numbers(["254712345678"]), {"254712345678"})
		self.assertEqual(_excluded_numbers(None), set())

	def test_collect_skips_excluded_and_duplicates(self):
		pages = [
			[
				{"mobile_no": "254700000001"},
				{"mobile_no": "+254 700 000 001"},
				{"mobile_no": "254700000002"},
			],
			[
				{"mobile_no": "254700000003"},
				{"mobile_no": "254700000004"},
			],
		]

		rows = _collect(pages, {"254700000002"}, 2)

		self.assertEqual(
			[row["mobile_no"] for row in rows],
			["254700000001", "254700000003", "254700000004"],
		)


class TestBulkTemplateValues(FrappeTestCase):
	"""Template variables are serialised per preview section."""

	def _doc(self, template_variables):
		doc = frappe.new_doc("Bulk WhatsApp Message")
		doc.template_variables = template_variables
		return doc

	def test_sections_are_serialised_separately(self):
		doc = self._doc(json.dumps({"header": ["Hi"], "body": ["Alice"], "footer": ["Bye"]}))

		values = json.loads(doc.get_common_template_values())

		self.assertEqual(values["header_values"], ["Hi"])
		self.assertEqual(values["body_values"], ["Alice"])
		self.assertEqual(values["footer_values"], ["Bye"])

	def test_legacy_list_maps_to_body_values(self):
		doc = self._doc(json.dumps(["Alice"]))

		values = json.loads(doc.get_common_template_values())

		self.assertEqual(values["header_values"], [])
		self.assertEqual(values["body_values"], ["Alice"])
		self.assertEqual(values["footer_values"], [])

	def test_empty_values_return_none(self):
		self.assertIsNone(self._doc(json.dumps({"body": []})).get_common_template_values())

	def test_media_header_requires_attachment(self):
		doc = frappe.new_doc("Bulk WhatsApp Message")
		doc.use_template = 1
		doc.template = "Any Template"

		with patch(
			"waba_suite.waba_suite.doctype.bulk_whatsapp_message.bulk_whatsapp_message.frappe.db.get_value",
			return_value="IMAGE",
		):
			with self.assertRaises(frappe.ValidationError):
				doc.validate_template_attachment()

			doc.attach = "/files/banner.png"
			doc.validate_template_attachment()
