import frappe
from frappe import _


@frappe.whitelist()
def get_user_accounts_with_default():
	user = frappe.session.user
	is_admin = user == "Administrator"

	accounts = frappe.get_all(
		"WhatsApp Account",
		filters={"status": "Active"},
		fields=["name", "account_name", "phone_id", "status"],
		order_by="account_name asc",
	)

	user_accounts = []
	default_account = None
	total_unread_messages = 0

	for acc in accounts:
		unread_count = frappe.db.count(
			"WhatsApp Message", filters={"whatsapp_account": acc.name, "type": "Incoming", "status": "draft"}
		)
		acc["unread_count"] = unread_count
		total_unread_messages += unread_count

		if is_admin:
			acc["is_default"] = 0
			user_accounts.append(acc)
		else:
			user_link = frappe.get_value(
				"POS Profile User", {"parent": acc.name, "user": user}, ["name", "default"], as_dict=1
			)

			if user_link:
				acc["is_default"] = user_link.default
				user_accounts.append(acc)
				if user_link.default:
					default_account = acc

	if is_admin and user_accounts:
		default_account = user_accounts[0]
		default_account["is_default"] = 1

	return {
		"accounts": user_accounts,
		"default_account": default_account,
		"has_accounts": len(user_accounts) > 0,
		"total_unread_messages": total_unread_messages,
	}


@frappe.whitelist()
def switch_account(account_name):
	user = frappe.session.user
	is_admin = user == "Administrator"

	if not is_admin:
		exists = frappe.db.exists("POS Profile User", {"parent": account_name, "user": user})
		if not exists:
			frappe.throw(_("You are not authorized to access this account."))

		linked_profiles = frappe.get_all(
			"POS Profile User", filters={"user": user, "parenttype": "WhatsApp Account"}
		)

		for profile in linked_profiles:
			frappe.db.set_value("POS Profile User", profile.name, "default", 0)

		frappe.db.set_value("POS Profile User", {"parent": account_name, "user": user}, "default", 1)

	account_info = frappe.get_value("WhatsApp Account", account_name, ["name", "account_name"], as_dict=1)

	return {"success": True, "account": account_info}


@frappe.whitelist()
def get_active_account():
	user = frappe.session.user
	is_admin = user == "Administrator"

	if is_admin:
		fallback_admin = frappe.get_all(
			"WhatsApp Account", filters={"status": "Active"}, fields=["name", "account_name"], limit=1
		)
		return fallback_admin[0] if fallback_admin else None

	res = frappe.get_all(
		"POS Profile User",
		filters={"user": user, "default": 1, "parenttype": "WhatsApp Account"},
		fields=["parent"],
	)

	if res:
		account = frappe.get_value(
			"WhatsApp Account",
			{"name": res[0].parent, "status": "Active"},
			["name", "account_name"],
			as_dict=1,
		)
		if account:
			return account

	fallback_links = frappe.get_all(
		"POS Profile User", filters={"user": user, "parenttype": "WhatsApp Account"}, fields=["parent"]
	)

	for link in fallback_links:
		account = frappe.get_value(
			"WhatsApp Account", {"name": link.parent, "status": "Active"}, ["name", "account_name"], as_dict=1
		)
		if account:
			return account

	return None
