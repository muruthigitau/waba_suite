"""Parsing helpers for structured WhatsApp message payloads.

Inbound payloads that are not plain text or media are persisted as the string
representation of the webhook object (see :mod:`waba_suite.utils.webhook`).
Those strings may be JSON, but older rows contain Python repr output using
single quotes, so both formats are supported.

Used by :func:`waba_suite.api.message.get_all` to expose structured
``location_data`` / ``contact_data`` to the chat UI.
"""

import ast
import json
from typing import Any

# Keys carrying the raw structured payload, in order of preference.
PAYLOAD_KEYS = ("message", "styled_message")


def parse_message_payload(value: Any) -> dict | None:
	"""Parse a stored structured payload into a dictionary.

	Args:
	    value: Raw field value; a dict, JSON text, or a Python repr string.

	Returns:
	    The parsed dictionary, or ``None`` when the value is not a mapping.
	"""
	if isinstance(value, dict):
		return value
	if not isinstance(value, str):
		return None

	text = value.strip()
	if not text:
		return None

	for parser in (json.loads, ast.literal_eval):
		try:
			parsed = parser(text)
		except (ValueError, SyntaxError, TypeError):
			continue
		if isinstance(parsed, dict):
			return parsed
		return None
	return None


def get_message_payload(message: dict) -> dict | None:
	"""Return the first structured payload found on a message row.

	Args:
	    message: Row from ``WhatsApp Message``.

	Returns:
	    Parsed payload dictionary, or ``None`` if none of the candidate keys
	    hold a mapping.
	"""
	for key in PAYLOAD_KEYS:
		payload = parse_message_payload(message.get(key))
		if payload:
			return payload
	return None


def _to_float(value: Any) -> float | None:
	"""Coerce a coordinate value to float, returning ``None`` when invalid."""
	try:
		return float(value)
	except (TypeError, ValueError):
		return None


def _to_text(value: Any) -> str | None:
	"""Return a stripped string, or ``None`` for empty/non-text values."""
	if not isinstance(value, str):
		return None
	text = value.strip()
	return text or None


def build_location_data(payload: dict | None) -> dict | None:
	"""Normalise a location payload for the chat UI.

	Args:
	    payload: Parsed location payload.

	Returns:
	    ``{"latitude", "longitude", "name", "address"}`` with numeric
	    coordinates, or ``None`` when the payload has no usable coordinates.
	"""
	if not payload:
		return None

	latitude = _to_float(payload.get("latitude"))
	longitude = _to_float(payload.get("longitude"))
	if latitude is None or longitude is None:
		return None

	name = _to_text(payload.get("name"))
	address = _to_text(payload.get("address"))
	return {
		"latitude": latitude,
		"longitude": longitude,
		"name": name,
		"address": address,
	}


def build_contact_data(payload: dict | None) -> dict | None:
	"""Normalise a shared-contact payload for the chat UI.

	WhatsApp sends ``name`` as an object of name parts and phone/email entries
	as objects; the UI expects a display name plus flat lists.

	Args:
	    payload: Parsed contact payload.

	Returns:
	    ``{"name", "phones", "emails"}`` or ``None`` when no payload exists.
	"""
	if not payload:
		return None

	raw_name = payload.get("name")
	if isinstance(raw_name, dict):
		name = raw_name.get("formatted_name") or " ".join(
			part for part in (raw_name.get("first_name"), raw_name.get("last_name")) if part
		)
		name = _to_text(name)
	else:
		name = _to_text(raw_name)

	phones = [
		{"phone": phone.get("phone"), "type": phone.get("type")}
		for phone in payload.get("phones") or []
		if isinstance(phone, dict) and phone.get("phone")
	]
	emails = [
		{"email": email.get("email"), "type": email.get("type")}
		for email in payload.get("emails") or []
		if isinstance(email, dict) and email.get("email")
	]

	return {"name": name, "phones": phones, "emails": emails}
