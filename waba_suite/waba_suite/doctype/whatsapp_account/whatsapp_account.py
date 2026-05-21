# Copyright (c) 2025, Shridhar Patil and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class WhatsAppAccount(Document):
	def on_update(self):
		self.there_must_be_only_one_default()

	def validate(self):
		self.validate_helpdesk_dependency()
		self.validate_user_enabled()
		self.validate_unique_user_default()

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
