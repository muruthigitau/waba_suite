"""Recipient options for bulk WhatsApp recipient lists.

Provides one paginated endpoint used by the bulk recipient picker:

* ``contacts`` - saved `WhatsApp Contact` records.
* ``chats`` - WhatsApp contacts that already have messages on the account.
* ``frappe`` - standard Frappe `Contact` records that have a phone number.

Numbers already present in the recipient list are excluded server-side, so the
picker only receives contacts that can still be added.
"""

import frappe
from frappe import _
from frappe.query_builder import Order
from frappe.query_builder.functions import Max
from frappe.utils import cint

from waba_suite.api.contact_helpers import require_whatsapp_access

DEFAULT_LIMIT = 100
MAX_LIMIT = 5000
SCAN_PAGE_SIZE = 200
WHATSAPP_CONTACT_FIELDS = ["name", "contact_name", "mobile_no"]


def _normalize_number(value):
	"""Return the digits-only form of a phone number.

	Args:
	    value: Raw phone number.

	Returns:
	    Digits-only string used for duplicate detection.
	"""
	return "".join(char for char in (value or "") if char.isdigit())


def _excluded_numbers(exclude):
	"""Build the set of numbers already present in the recipient list.

	Args:
	    exclude: JSON string or list of mobile numbers.

	Returns:
	    Set of digits-only numbers.
	"""
	if isinstance(exclude, str):
		exclude = frappe.parse_json(exclude)
	return {number for number in (_normalize_number(value) for value in exclude or []) if number}


def _collect(pages, excluded, limit):
	"""Collect unique, non-excluded rows from paginated sources.

	Args:
	    pages: Iterable yielding lists of row dicts with ``mobile_no``.
	    excluded: Digits-only numbers to skip.
	    limit: Number of usable rows to collect before stopping.

	Returns:
	    list: At most ``limit + 1`` rows; the extra row signals more options.
	"""
	rows = []
	seen = set()
	for page in pages:
		for row in page:
			number = _normalize_number(row.get("mobile_no"))
			if not number or number in excluded or number in seen:
				continue
			seen.add(number)
			rows.append(row)
			if len(rows) > limit:
				return rows
	return rows


def _whatsapp_contact_pages(query):
	"""Yield pages of saved WhatsApp contacts.

	Args:
	    query: Optional name/number search string.

	Yields:
	    list: WhatsApp contact rows.
	"""
	offset = 0
	while True:
		or_filters = None
		if query:
			or_filters = {
				"mobile_no": ["like", f"%{query}%"],
				"contact_name": ["like", f"%{query}%"],
			}
		rows = frappe.get_all(
			"WhatsApp Contact",
			or_filters=or_filters,
			fields=WHATSAPP_CONTACT_FIELDS,
			limit_start=offset,
			limit_page_length=SCAN_PAGE_SIZE,
			order_by="modified desc",
		)
		if not rows:
			return
		yield rows
		if len(rows) < SCAN_PAGE_SIZE:
			return
		offset += SCAN_PAGE_SIZE


def _chat_contact_pages(whatsapp_account=None):
	"""Yield pages of WhatsApp contacts that already have messages.

	Args:
	    whatsapp_account: Optional account used to scope the messages.

	Yields:
	    list: WhatsApp contact rows, most recently active first.
	"""
	message = frappe.qb.DocType("WhatsApp Message")
	last_message = Max(message.creation)
	offset = 0
	while True:
		query = (
			frappe.qb.from_(message)
			.select(message.whatsapp_contact, last_message.as_("last_message"))
			.where(message.whatsapp_contact != "")
		)
		if whatsapp_account:
			query = query.where(message.whatsapp_account == whatsapp_account)
		rows = (
			query.groupby(message.whatsapp_contact)
			.orderby(last_message, order=Order.desc)
			.limit(SCAN_PAGE_SIZE)
			.offset(offset)
			.run(as_dict=True)
		)
		names = [row.whatsapp_contact for row in rows if row.whatsapp_contact]
		if not names:
			return
		yield frappe.get_all(
			"WhatsApp Contact",
			filters={"name": ["in", names]},
			fields=WHATSAPP_CONTACT_FIELDS,
		)
		if len(rows) < SCAN_PAGE_SIZE:
			return
		offset += SCAN_PAGE_SIZE


def _frappe_contact_names(query, offset):
	"""Return a page of Frappe Contact names that may have phone numbers.

	Args:
	    query: Optional name/number search string.
	    offset: Query offset.

	Returns:
	    tuple: (contact names, whether more rows may exist)
	"""
	if not query:
		names = frappe.get_all(
			"Contact Phone",
			filters={"phone": ["!=", ""]},
			distinct=True,
			limit_start=offset,
			limit_page_length=SCAN_PAGE_SIZE,
			order_by="parent asc",
			pluck="parent",
		)
		unique_names = list(dict.fromkeys(name for name in names if name))
		return unique_names, len(names) >= SCAN_PAGE_SIZE

	phone_names = frappe.get_all(
		"Contact Phone",
		filters={"phone": ["like", f"%{query}%"]},
		limit_start=offset,
		limit_page_length=SCAN_PAGE_SIZE,
		order_by="parent asc",
		pluck="parent",
	)
	contact_names = frappe.get_all(
		"Contact",
		or_filters={
			"full_name": ["like", f"%{query}%"],
			"first_name": ["like", f"%{query}%"],
			"last_name": ["like", f"%{query}%"],
			"company_name": ["like", f"%{query}%"],
		},
		limit_start=offset,
		limit_page_length=SCAN_PAGE_SIZE,
		order_by="name asc",
		pluck="name",
	)
	unique_names = list(dict.fromkeys(name for name in list(phone_names) + list(contact_names) if name))
	has_more = len(phone_names) >= SCAN_PAGE_SIZE or len(contact_names) >= SCAN_PAGE_SIZE
	return unique_names, has_more


def _frappe_contact_rows(names):
	"""Build picker rows for standard Frappe Contacts.

	Args:
	    names: Contact document names.

	Returns:
	    list: Rows with name, contact_name, company_name and mobile_no.
	"""
	if not names:
		return []

	contacts = frappe.get_all(
		"Contact",
		filters={"name": ["in", names]},
		fields=["name", "first_name", "last_name", "company_name"],
	)
	if not contacts:
		return []

	phones = frappe.get_all(
		"Contact Phone",
		filters={"parent": ["in", names], "phone": ["!=", ""]},
		fields=["parent", "phone", "is_primary_phone"],
	)
	phone_map = {}
	for phone in phones:
		current = phone_map.get(phone.parent)
		if current is None or (phone.is_primary_phone and not current[1]):
			phone_map[phone.parent] = (phone.phone, phone.is_primary_phone)

	rows = []
	for contact in contacts:
		chosen = phone_map.get(contact.name)
		if not chosen:
			continue
		display_name = " ".join(part for part in (contact.first_name, contact.last_name) if part).strip()
		rows.append(
			{
				"name": contact.name,
				"contact_name": display_name or chosen[0],
				"company_name": contact.company_name,
				"mobile_no": chosen[0],
			}
		)
	return rows


def _frappe_contact_pages(query):
	"""Yield pages of standard Frappe Contacts that have phone numbers.

	Args:
	    query: Optional name/number search string.

	Yields:
	    list: Contact rows for the picker.
	"""
	offset = 0
	while True:
		names, has_more = _frappe_contact_names(query, offset)
		if names:
			rows = _frappe_contact_rows(names)
			if rows:
				yield rows
		if not has_more:
			return
		offset += SCAN_PAGE_SIZE


@frappe.whitelist()
def get_recipient_options(
	source="contacts",
	query="",
	exclude=None,
	limit=DEFAULT_LIMIT,
	whatsapp_account=None,
):
	"""Return paginated recipient options for the bulk recipient picker.

	Args:
	    source: One of ``contacts``, ``chats`` or ``frappe``.
	    query: Optional name/number search string.
	    exclude: JSON array (or list) of mobile numbers already added.
	    limit: Maximum rows to return (1-5000, default 100).
	    whatsapp_account: Optional WhatsApp account for the ``chats`` source.

	Returns:
	    dict: ``items`` (name/contact_name/mobile_no rows) and ``has_more``.

	Raises:
	    frappe.ValidationError: If ``source`` is not supported.
	"""
	require_whatsapp_access()
	source = (source or "contacts").strip().lower()
	query = (query or "").strip()
	size = max(1, min(cint(limit) or DEFAULT_LIMIT, MAX_LIMIT))
	excluded = _excluded_numbers(exclude)

	if source == "contacts":
		pages = _whatsapp_contact_pages(query)
	elif source == "chats":
		pages = _chat_contact_pages(whatsapp_account)
	elif source == "frappe":
		pages = _frappe_contact_pages(query)
	else:
		frappe.throw(_("Unsupported recipient source: {0}").format(source))

	rows = _collect(pages, excluded, size)
	return {"items": rows[:size], "has_more": len(rows) > size}
