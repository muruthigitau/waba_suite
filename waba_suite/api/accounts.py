import frappe
from frappe import _


@frappe.whitelist()
def get_user_accounts_with_default():
	user = frappe.session.user

	accounts = frappe.get_all(
		"WhatsApp Account",
		filters={"status": "Active"},
		fields=["name", "account_name", "phone_id", "status"],
		order_by="account_name asc",
	)

	user_accounts = []
	default_account = None

	for acc in accounts:
		user_link = frappe.get_value(
			"POS Profile User", {"parent": acc.name, "user": user}, ["name", "default"], as_dict=1
		)

		if user_link:
			acc["is_default"] = user_link.default
			user_accounts.append(acc)
			if user_link.default:
				default_account = acc

	return {
		"accounts": user_accounts,
		"default_account": default_account,
		"has_accounts": len(user_accounts) > 0,
	}


@frappe.whitelist()
def switch_account(account_name):
	user = frappe.session.user

	exists = frappe.db.exists("POS Profile User", {"parent": account_name, "user": user})
	if not exists:
		frappe.throw(_("You are not authorized to access this account."))

	frappe.db.sql(
		"""
        UPDATE `tabPOS Profile User` 
        SET `default` = 0 
        WHERE user = %s AND parenttype = 'WhatsApp Account'
    """,
		user,
	)

	frappe.db.set_value("POS Profile User", {"parent": account_name, "user": user}, "default", 1)

	account_info = frappe.get_value("WhatsApp Account", account_name, ["name", "account_name"], as_dict=1)

	return {"success": True, "account": account_info}


@frappe.whitelist()
def get_active_account():
	user = frappe.session.user

	res = frappe.db.sql(
		"""
        SELECT wa.name, wa.account_name 
        FROM `tabWhatsApp Account` wa
        JOIN `tabPOS Profile User` wau ON wa.name = wau.parent
        WHERE wau.user = %s AND wau.default = 1 AND wa.status = 'Active'
        LIMIT 1
    """,
		user,
		as_dict=1,
	)

	if res:
		return res[0]

	fallback = frappe.db.sql(
		"""
        SELECT wa.name, wa.account_name 
        FROM `tabWhatsApp Account` wa
        JOIN `tabPOS Profile User` wau ON wa.name = wau.parent
        WHERE wau.user = %s AND wa.status = 'Active'
        LIMIT 1
    """,
		user,
		as_dict=1,
	)

	return fallback[0] if fallback else None
