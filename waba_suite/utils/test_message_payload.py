"""Tests for structured WhatsApp message payload parsing.

The helpers are framework-independent, so these tests use plain ``unittest``
and do not require database fixtures.
"""

import unittest

from waba_suite.utils.message_payload import (
	build_contact_data,
	build_location_data,
	get_message_payload,
	parse_message_payload,
)

PYTHON_REPR_LOCATION = (
	"{'address': 'Nairobi, Nairobi, KE', 'latitude': -1.33859152, "
	"'longitude': 36.87169067, 'name': 'Hari Industrial Park'}"
)


class TestParseMessagePayload(unittest.TestCase):
	"""Payload parsing accepts both JSON and legacy Python repr strings."""

	def test_parses_json_object(self):
		self.assertEqual(
			parse_message_payload('{"latitude": 1, "longitude": 2}'),
			{
				"latitude": 1,
				"longitude": 2,
			},
		)

	def test_parses_python_repr_object(self):
		self.assertEqual(parse_message_payload(PYTHON_REPR_LOCATION)["name"], "Hari Industrial Park")

	def test_passes_through_dict(self):
		payload = {"latitude": 1.5, "longitude": 2.5}
		self.assertIs(parse_message_payload(payload), payload)

	def test_returns_none_for_plain_text(self):
		self.assertIsNone(parse_message_payload("Hello there"))
		self.assertIsNone(parse_message_payload(""))
		self.assertIsNone(parse_message_payload(None))

	def test_get_message_payload_uses_styled_message_fallback(self):
		message = {"message": "", "styled_message": PYTHON_REPR_LOCATION}
		self.assertEqual(get_message_payload(message)["latitude"], -1.33859152)


class TestBuildLocationData(unittest.TestCase):
	"""Location payloads are normalised to numeric coordinates."""

	def test_builds_location_from_python_repr(self):
		self.assertEqual(
			build_location_data(parse_message_payload(PYTHON_REPR_LOCATION)),
			{
				"latitude": -1.33859152,
				"longitude": 36.87169067,
				"name": "Hari Industrial Park",
				"address": "Nairobi, Nairobi, KE",
			},
		)

	def test_coerces_string_coordinates(self):
		location = build_location_data({"latitude": "1.5", "longitude": "2.5"})
		self.assertEqual(location["latitude"], 1.5)
		self.assertEqual(location["longitude"], 2.5)

	def test_requires_both_coordinates(self):
		self.assertIsNone(build_location_data({"address": "Nairobi"}))
		self.assertIsNone(build_location_data({"latitude": 1, "longitude": None}))
		self.assertIsNone(build_location_data(None))

	def test_ignores_non_text_name(self):
		location = build_location_data({"latitude": 1, "longitude": 2, "name": 123})
		self.assertIsNone(location["name"])


class TestBuildContactData(unittest.TestCase):
	"""Shared contact payloads are flattened for the chat UI."""

	def test_flattens_name_and_entries(self):
		contact = build_contact_data(
			{
				"name": {"first_name": "Jane", "last_name": "Doe"},
				"phones": [{"phone": "+254700000000", "type": "CELL"}],
				"emails": [{"email": "jane@example.com", "type": "WORK"}],
			}
		)
		self.assertEqual(contact["name"], "Jane Doe")
		self.assertEqual(contact["phones"], [{"phone": "+254700000000", "type": "CELL"}])
		self.assertEqual(contact["emails"], [{"email": "jane@example.com", "type": "WORK"}])

	def test_prefers_formatted_name_and_skips_invalid_entries(self):
		contact = build_contact_data(
			{
				"name": {"first_name": "Jane", "formatted_name": "Dr. Jane Doe"},
				"phones": [{"type": "CELL"}, "not-a-phone"],
				"emails": [],
			}
		)
		self.assertEqual(contact["name"], "Dr. Jane Doe")
		self.assertEqual(contact["phones"], [])

	def test_returns_none_without_payload(self):
		self.assertIsNone(build_contact_data(None))


if __name__ == "__main__":
	unittest.main()
