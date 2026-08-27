# Copyright (c) 2025, Shridhar Patil and contributors
# For license information, please see license.txt

from datetime import datetime, time, timedelta

import frappe
from frappe.model.document import Document
from frappe.utils import get_datetime_in_timezone, get_system_timezone


class WhatsAppAccount(Document):
	# English day name -> datetime.weekday() (Monday=0) mapping. Used instead of
	# locale-dependent ``strftime("%A")`` so the check is independent of server locale.
	WEEKDAY_INDEX = {
		"Monday": 0,
		"Tuesday": 1,
		"Wednesday": 2,
		"Thursday": 3,
		"Friday": 4,
		"Saturday": 5,
		"Sunday": 6,
	}

	def on_update(self):
		self.there_must_be_only_one_default()

	def validate(self):
		self.validate_helpdesk_dependency()
		self.validate_user_enabled()
		self.validate_unique_user_default()
		self.validate_business_hours()

	def is_within_business_hours(self):
		"""Return True if the current time falls within a configured working window.

		The current time is computed in the System Settings timezone (via
		``get_system_timezone()``) rather than the server's local timezone, so the
		day-of-week and wall-clock comparison stays correct regardless of where the
		server runs. Day names are matched through a fixed English mapping so the
		comparison is independent of the server's locale.

		Returns:
		    True when the current day/time matches any business hours row, else False.
		"""
		now = get_datetime_in_timezone(get_system_timezone())
		current_weekday = now.weekday()
		current_time = now.time().replace(microsecond=0)

		for row in self.business_hours:
			if self.WEEKDAY_INDEX.get(row.day) != current_weekday:
				continue
			start = self._to_time(row.start_time)
			end = self._to_time(row.end_time)

			if start is None or end is None:
				continue
			if start <= current_time <= end:
				return True
		return False

	def send_away_reply_if_outside_hours(self, message_doc):
		"""Send the away message when the account is outside business hours.

		Args:
		    message_doc: Incoming WhatsApp Message document that triggered the flow.

		Returns:
		    True when the away reply was sent, otherwise False.
		"""
		if not self.enable_away_auto_reply or not self.away_message:
			return False
		if self.is_within_business_hours():
			return False
		frappe.get_doc(
			{
				"doctype": "WhatsApp Message",
				"to": message_doc.get("from"),
				"type": "Outgoing",
				"content_type": "text",
				"message": self.away_message,
				"whatsapp_account": self.name,
			}
		).insert(ignore_permissions=True)
		return True

	@staticmethod
	def _to_time(value):
		"""Convert a Time field value to a ``datetime.time`` object.

		Args:
		    value: Time string or time object.

		Returns:
		    datetime.time or None when the value cannot be parsed.
		"""
		if not value:
			return time.min
		if isinstance(value, time):
			return value
		if isinstance(value, datetime):
			return value.time()
		if isinstance(value, timedelta):
			return (datetime.min + value).time()
		text = str(value).strip()
		for fmt in ("%H:%M:%S.%f", "%H:%M:%S", "%H:%M", "%H.%M.%S.%f", "%H.%M.%S", "%H.%M"):
			try:
				return datetime.strptime(text, fmt).time()
			except ValueError:
				continue
		return time.min

	def validate_business_hours(self):
		"""Validate business hours rows: end time must be after start time."""
		for row in self.business_hours:
			start = self._to_time(row.start_time)
			end = self._to_time(row.end_time)
			if start and end and end < start:
				frappe.throw(
					msg=frappe._("Row {0}: End Time must be after Start Time for {1}.").format(
						row.idx, frappe.bold(row.day)
					),
					title=frappe._("Invalid Business Hours"),
				)

	def validate_helpdesk_dependency(self):
		if self.support_enabled and "helpdesk" not in frappe.get_installed_apps():
			frappe.throw(
				msg=frappe._(
					"Support features require Helpdesk to be installed. Please install Helpdesk or disable support features."
				),
				title=frappe._("Helpdesk Not Installed"),
			)

	def validate_user_enabled(self):
		for user in self.users:
			if user.user not in frappe.get_all("User", filters={"enabled": 1}, pluck="name"):
				frappe.throw(
					msg=frappe._(
						"User {0} is disabled. Please enable the user or remove it from the WhatsApp Account users."
					).format(user.user),
					title=frappe._("User Disabled"),
				)

	def validate_unique_user_default(self):
		for row in self.users:
			if not row.default:
				continue

			existing_default = frappe.get_all(
				"POS Profile User",
				filters={
					"user": row.user,
					"default": 1,
					"parent": ["!=", self.name],
					"parenttype": "WhatsApp Account",
				},
				pluck="parent",
			)

			if existing_default:
				frappe.throw(
					msg=frappe._(
						"User {0} is already set as default in another WhatsApp Account: {1}"
					).format(frappe.bold(row.user), frappe.bold(existing_default[0])),
					title=frappe._("Duplicate User Default"),
				)

			current_defaults = [r.user for r in self.users if r.default and r.user == row.user]
			if len(current_defaults) > 1:
				frappe.throw(
					msg=frappe._("User {0} is marked as default multiple times in this account.").format(
						row.user
					),
					title=frappe._("Duplicate User Default"),
				)

	def there_must_be_only_one_default(self):
		"""If current WhatsApp Account is default, un-default all other accounts."""
		for field in ("is_default_incoming", "is_default_outgoing"):
			if not self.get(field):
				continue

			for whatsapp_account in frappe.get_all("WhatsApp Account", filters={field: 1}):
				if whatsapp_account.name == self.name:
					continue

				whatsapp_account = frappe.get_doc("WhatsApp Account", whatsapp_account.name)
				whatsapp_account.set(field, 0)
				whatsapp_account.save()
