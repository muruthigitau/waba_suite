// Copyright (c) 2026, David Gitau and contributors
// For license information, please see license.txt

frappe.query_reports["WhatsApp Conversation Analytics"] = {
	filters: [
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 1,
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 1,
		},
		{
			fieldname: "whatsapp_account",
			label: __("WhatsApp Account"),
			fieldtype: "Link",
			options: "WhatsApp Account",
		},
	],
};
