# Copyright (c) 2026, David Gitau and contributors
# For license information, please see license.txt


import frappe
from frappe import _
from frappe.utils import get_datetime, getdate, today


def execute(filters=None):
	filters = frappe._dict(filters or {})

	if not filters.get("from_date"):
		filters.from_date = today()

	if not filters.get("to_date"):
		filters.to_date = today()

	columns = get_columns()

	message_filters = {
		"creation": ["between", [f"{filters.from_date} 00:00:00", f"{filters.to_date} 23:59:59"]]
	}

	if filters.get("whatsapp_account"):
		message_filters["whatsapp_account"] = filters.whatsapp_account

	messages = frappe.get_all(
		"WhatsApp Message",
		filters=message_filters,
		fields=[
			"whatsapp_contact",
			"whatsapp_account",
			"type",
			"creation",
		],
		order_by="creation asc",
	)

	contact_names = {m.whatsapp_contact for m in messages if m.whatsapp_contact}

	contact_map = {}

	if contact_names:
		for contact in frappe.get_all(
			"WhatsApp Contact",
			filters={"name": ["in", list(contact_names)]},
			fields=["name", "contact_name", "mobile_no", "creation"],
		):
			contact_map[contact.name] = contact

	rows = {}

	trend_labels = [
		"00:00-04:00",
		"04:00-08:00",
		"08:00-12:00",
		"12:00-16:00",
		"16:00-20:00",
		"20:00-24:00",
	]

	accounts = frappe.get_all(
		"WhatsApp Account",
		pluck="name",
	)

	account_trends = {}

	for account in accounts:
		account_trends[account] = [0, 0, 0, 0, 0, 0]

	for message in messages:
		if not message.whatsapp_contact:
			continue

		account = message.whatsapp_account or "Unknown"

		if account not in account_trends:
			account_trends[account] = [0, 0, 0, 0, 0, 0]

		hour = get_datetime(message.creation).hour

		if hour < 4:
			account_trends[account][0] += 1
		elif hour < 8:
			account_trends[account][1] += 1
		elif hour < 12:
			account_trends[account][2] += 1
		elif hour < 16:
			account_trends[account][3] += 1
		elif hour < 20:
			account_trends[account][4] += 1
		else:
			account_trends[account][5] += 1

		if message.whatsapp_contact not in rows:
			contact = contact_map.get(message.whatsapp_contact)

			rows[message.whatsapp_contact] = {
				"contact": message.whatsapp_contact,
				"contact_name": contact.contact_name if contact else "",
				"mobile_no": contact.mobile_no if contact else "",
				"whatsapp_account": message.whatsapp_account,
				"incoming": 0,
				"outgoing": 0,
				"total": 0,
				"first_message": message.creation,
				"last_message": message.creation,
				"new_chat": "No",
			}

			if contact:
				contact_date = getdate(contact.creation)

				if getdate(filters.from_date) <= contact_date <= getdate(filters.to_date):
					rows[message.whatsapp_contact]["new_chat"] = "Yes"

		row = rows[message.whatsapp_contact]

		if message.type == "Incoming":
			row["incoming"] += 1
		elif message.type == "Outgoing":
			row["outgoing"] += 1

		row["total"] += 1
		row["last_message"] = message.creation

	data = sorted(
		list(rows.values()),
		key=lambda d: d["total"],
		reverse=True,
	)

	total_chats = len(data)
	new_chats = len([d for d in data if d["new_chat"] == "Yes"])
	total_incoming = sum(d["incoming"] for d in data)
	total_outgoing = sum(d["outgoing"] for d in data)

	report_summary = [
		{
			"value": total_chats,
			"label": _("Total Chats"),
			"datatype": "Int",
		},
		{
			"value": new_chats,
			"label": _("New Chats"),
			"datatype": "Int",
		},
		{
			"value": total_incoming,
			"label": _("Incoming Messages"),
			"datatype": "Int",
		},
		{
			"value": total_outgoing,
			"label": _("Outgoing Messages"),
			"datatype": "Int",
		},
		{
			"value": total_incoming + total_outgoing,
			"label": _("Total Messages"),
			"datatype": "Int",
		},
	]

	datasets = []

	for account in accounts:
		datasets.append(
			{
				"name": account,
				"values": account_trends.get(account, [0, 0, 0, 0, 0, 0]),
			}
		)

	for account, values in account_trends.items():
		if account not in accounts:
			datasets.append(
				{
					"name": account,
					"values": values,
				}
			)

	chart = {
		"data": {
			"labels": trend_labels,
			"datasets": datasets,
		},
		"type": "line",
		"height": 320,
	}

	return columns, data, None, chart, report_summary


def get_columns():
	return [
		{
			"fieldname": "contact_name",
			"label": "Contact Name",
			"fieldtype": "Data",
			"width": 220,
		},
		{
			"fieldname": "mobile_no",
			"label": "Mobile No",
			"fieldtype": "Data",
			"width": 140,
		},
		{
			"fieldname": "whatsapp_account",
			"label": "WhatsApp Account",
			"fieldtype": "Link",
			"options": "WhatsApp Account",
			"width": 180,
		},
		{
			"fieldname": "incoming",
			"label": "Incoming",
			"fieldtype": "Int",
			"width": 120,
		},
		{
			"fieldname": "outgoing",
			"label": "Outgoing",
			"fieldtype": "Int",
			"width": 120,
		},
		{
			"fieldname": "total",
			"label": "Total",
			"fieldtype": "Int",
			"width": 120,
		},
		{
			"fieldname": "first_message",
			"label": "First Message",
			"fieldtype": "Datetime",
			"width": 180,
		},
		{
			"fieldname": "last_message",
			"label": "Last Message",
			"fieldtype": "Datetime",
			"width": 180,
		},
		{
			"fieldname": "new_chat",
			"label": "New Chat",
			"fieldtype": "Data",
			"width": 120,
		},
	]
