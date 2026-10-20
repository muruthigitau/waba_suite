"""Contacts API for WhatsApp.

Provides whitelisted endpoints to create, search, and retrieve WhatsApp
contacts along with their chat preferences and 24h-window details.

Key dependencies:
    - frappe
    - waba_suite.api.contact_helpers: Shared window constant and payload builder
"""

import frappe
from frappe import _

from waba_suite.api.contact_helpers import (
    contact_payload,
    is_session_expired,
    require_whatsapp_access,
)


@frappe.whitelist()
def create(contact_name, mobile_no, whatsapp_account=None):
    """Create (or get) a WhatsApp Contact without creating a room/chat.

    Only the contact record is created; a chat/room materialises once the first
    message is sent (see message.send). The email (Assign User) field is left
    unset because chats are no longer assigned at creation time.

    Args:
        contact_name: Display name for the contact.
        mobile_no: Phone number of the contact.
        whatsapp_account: Optional WhatsApp account identifier.

    Returns:
        Contact payload dict (see contact_payload).
    """
    require_whatsapp_access()
    mobile = (mobile_no or "").strip()
    if not mobile:
        frappe.throw(_("Mobile number is required"))

    existing = frappe.db.get_value("WhatsApp Contact", {"mobile_no": mobile}, "name")
    contact_name = (contact_name or "").strip() or mobile

    if existing:
        contact = frappe.get_doc("WhatsApp Contact", existing)
        if contact_name and not contact.contact_name:
            contact.contact_name = contact_name
            contact.save(ignore_permissions=True)
    else:
        contact = frappe.get_doc(
            {
                "doctype": "WhatsApp Contact",
                "contact_name": contact_name,
                "mobile_no": mobile,
            }
        )
        contact.insert(ignore_permissions=True)

    return contact_payload(contact.name, whatsapp_account)


@frappe.whitelist()
def search(query, whatsapp_account=None, limit=20):
    require_whatsapp_access()
    """Search existing WhatsApp contacts by name or mobile number.

    Used by the "New Message" dialog to pick an existing contact. With no query
    it returns contacts that already have chats (existing rooms).

    Args:
        query: Search string (name or phone number).
        whatsapp_account: Optional account filter.
        limit: Max results to return.

    Returns:
        List of contact payload dicts matching the query.
    """
    query = (query or "").strip()
    filters = {}
    if whatsapp_account:
        filters["whatsapp_account"] = whatsapp_account

    if query:
        contact_names = frappe.get_all(
            "WhatsApp Contact",
            filters={"mobile_no": ["like", f"%{query}%"]},
            fields=["name"],
            limit=limit,
        )
        name_contacts = frappe.get_all(
            "WhatsApp Contact",
            filters={"contact_name": ["like", f"%{query}%"]},
            fields=["name"],
            limit=limit,
        )
        return _build_payloads(
            [c["name"] for c in list(contact_names) + list(name_contacts)],
            whatsapp_account,
            limit,
        )

    if whatsapp_account:
        msg_contacts = frappe.get_all(
            "WhatsApp Message",
            filters={"whatsapp_account": whatsapp_account},
            fields=["whatsapp_contact"],
            distinct=True,
        )
    else:
        msg_contacts = frappe.get_all(
            "WhatsApp Message",
            fields=["whatsapp_contact"],
            distinct=True,
        )
    names = [row.get("whatsapp_contact") for row in msg_contacts]
    return _build_payloads(names, whatsapp_account, limit)


def _build_payloads(names, whatsapp_account, limit):
    """Build contact payloads from a list of contact names, deduplicated.

    Args:
        names: Iterable of WhatsApp Contact names (may contain None).
        whatsapp_account: Optional account for window resolution.
        limit: Max payloads to return.

    Returns:
        List of contact payload dicts.
    """
    result = []
    seen = set()
    for name in names:
        if not name or name in seen:
            continue
        seen.add(name)
        result.append(contact_payload(name, whatsapp_account))
        if len(result) >= limit:
            break
    return result


@frappe.whitelist()
def search_frappe_contacts(query, limit=20):
    """Search the standard Frappe 'Contact' doctype phone numbers.

    Matches Contact Phone child rows and contact names so the user can pick an
    existing CRM contact and convert it to a WhatsApp Contact.

    Args:
        query: Search string (name or phone number).
        limit: Max results to return.

    Returns:
        List of contacts with name, first/last name, company, and phones.
    """
    query = (query or "").strip()
    result = []
    seen = set()

    if query:
        contacts = frappe.get_all(
            "Contact",
            filters={"name": ["like", f"%{query}%"]},
            fields=["name", "first_name", "last_name", "company_name"],
            limit=limit,
        )
        phones = frappe.get_all(
            "Contact Phone",
            filters={"phone": ["like", f"%{query}%"]},
            fields=["parent", "phone", "is_primary_phone"],
            limit=limit,
        )
        contact_names = [c["name"] for c in contacts]
        contact_names += [
            p["parent"] for p in phones if p["parent"] not in contact_names
        ]
    else:
        contact_names = [
            c["name"]
            for c in frappe.get_all("Contact", fields=["name"], limit=limit)
        ]

    for name in contact_names[:limit]:
        if name in seen:
            continue
        seen.add(name)
        c = frappe.get_doc("Contact", name)
        phone_numbers = [
            {"phone": ph.phone, "is_primary_phone": ph.is_primary_phone}
            for ph in c.get("phone_nos") or []
        ]
        wa_name = frappe.db.get_value("WhatsApp Contact", {"contact": name}, "name")
        result.append(
            {
                "name": name,
                "contact_name": _display_name(c.first_name, c.last_name),
                "company_name": c.company_name,
                "phones": phone_numbers,
                "is_whatsapp_contact": bool(wa_name),
                "whatsapp_contact": wa_name,
            }
        )
        if len(result) >= limit:
            break
    return result


@frappe.whitelist()
def convert_frappe_contact(contact_name, whatsapp_account=None):
    """Convert an existing Frappe Contact into a WhatsApp Contact.

    Picks the primary phone (or the first phone), creates a WhatsApp Contact
    linked back via the `contact` field, and returns it (get-or-create).

    Args:
        contact_name: The Frappe Contact document name.
        whatsapp_account: Optional WhatsApp account for window resolution.

    Returns:
        Contact payload dict (same shape as create).
    """
    src = frappe.get_doc("Contact", contact_name)
    mobile = _pick_phone(src)
    if not mobile:
        frappe.throw("The selected Frappe Contact has no phone number")

    existing_wa = frappe.db.get_value("WhatsApp Contact", {"contact": contact_name}, "name")
    if existing_wa:
        return contact_payload(existing_wa, whatsapp_account)

    contact = frappe.get_doc(
        {
            "doctype": "WhatsApp Contact",
            "contact_name": _display_name(src.first_name, src.last_name) or mobile,
            "mobile_no": mobile,
            "contact": contact_name,
        }
    )
    contact.insert(ignore_permissions=True)
    return contact_payload(contact.name, whatsapp_account)


@frappe.whitelist()
def get(email, whatsapp_account=None):
    require_whatsapp_access()
    """Retrieve WhatsApp contacts with their last message and preferences.

    Fetches contacts that have at least one WhatsApp Message, along with the
    current user's chat preferences (pin, star, archive status). All per-contact
    data (last message, unread count, session, labels) is resolved with batched
    queries to avoid N+1 lookups, so the chat list loads quickly.

    Args:
        email: Not used; kept for API compatibility.
        whatsapp_account: Optional filter for a specific WhatsApp account.
            Falls back to the default incoming account if not provided.

    Returns:
        List of contact dicts sorted by last message creation (newest first).
    """
    if not whatsapp_account:
        whatsapp_account = frappe.db.get_single_value(
            "WhatsApp Settings", "default_incoming_account"
        )

    if not whatsapp_account:
        return []

    contact_names = [
        m.whatsapp_contact
        for m in frappe.get_all(
            "WhatsApp Message",
            filters={
                "whatsapp_account": whatsapp_account,
                "whatsapp_contact": ["!=", ""],
            },
            fields=["whatsapp_contact"],
            distinct=True,
        )
        if m.whatsapp_contact
    ]
    if not contact_names:
        return []

    contacts = frappe.get_all(
        "WhatsApp Contact",
        filters={"name": ["in", contact_names]},
        fields=[
            "name",
            "contact_name",
            "mobile_no",
            "last_message",
            "is_read",
            "profile_picture",
        ],
    )
    contact_ids = [c.name for c in contacts]
    if not contact_ids:
        return []

    # ── Batch: last message + unread counts for every contact in one query ──
    all_messages = frappe.get_all(
        "WhatsApp Message",
        filters={
            "whatsapp_account": whatsapp_account,
            "whatsapp_contact": ["in", contact_ids],
        },
        fields=[
            "whatsapp_contact",
            "message",
            "type",
            "status",
            "creation",
            "use_template",
            "to",
            "from",
        ],
        order_by="creation desc",
    )
    last_msg_map = {}
    unread_map = {}
    for msg in all_messages:
        contact = msg.get("whatsapp_contact")
        if not contact:
            continue
        if contact not in last_msg_map:
            last_msg_map[contact] = msg
        if msg.get("type") == "Incoming" and msg.get("status") == "draft":
            unread_map[contact] = unread_map.get(contact, 0) + 1

    # ── Batch: preferences for the current user ──
    prefs_list = frappe.get_all(
        "WhatsApp Chat Preference",
        filters={"user": frappe.session.user},
        fields=["whatsapp_contact", "is_pinned", "is_starred", "is_archived"],
    )
    prefs_map = {
        p.whatsapp_contact: {
            "is_pinned": bool(p.is_pinned),
            "is_starred": bool(p.is_starred),
            "is_archived": bool(p.is_archived),
        }
        for p in prefs_list
    }

    # ── Batch: latest session per contact+account in one query ──
    session_rows = frappe.get_all(
        "WhatsApp Session",
        filters={
            "whatsapp_account": whatsapp_account,
            "whatsapp_contact": ["in", contact_ids],
        },
        fields=["whatsapp_contact", "status", "expires_at"],
        order_by="creation desc",
    )
    session_map = {}
    for s in session_rows:
        if s.whatsapp_contact and s.whatsapp_contact not in session_map:
            session_map[s.whatsapp_contact] = s

    # ── Batch: labels assigned to these contacts ──
    assignments = frappe.get_all(
        "WhatsApp Chat Label Assignment",
        filters={
            "whatsapp_account": whatsapp_account,
            "whatsapp_contact": ["in", contact_ids],
        },
        fields=["whatsapp_contact", "whatsapp_chat_label"],
    )
    label_ids = {
        a.whatsapp_chat_label for a in assignments if a.whatsapp_chat_label
    }
    label_map = {
        lbl.name: lbl
        for lbl in frappe.get_all(
            "WhatsApp Chat Label",
            filters={"name": ["in", list(label_ids)], "disabled": 0},
            fields=["name", "label_name", "color"],
        )
    }
    labels_by_contact = {}
    for a in assignments:
        lbl = label_map.get(a.whatsapp_chat_label)
        if lbl:
            labels_by_contact.setdefault(a.whatsapp_contact, []).append(lbl)

    for contact in contacts:
        last = last_msg_map.get(contact.name)
        contact["last_message"] = last if last else None

        contact["unread_incoming"] = unread_map.get(contact.name, 0)

        # Scope every contact to the account it was fetched for so the UI can
        # bind each chat to (and filter by) its WhatsApp Account.
        contact["whatsapp_account"] = whatsapp_account

        session = session_map.get(contact.name)
        contact["session_status"] = session.status if session else None
        contact["session_expires_at"] = (
            str(session.expires_at) if session and session.expires_at else None
        )
        contact["is_session_expired"] = is_session_expired(session)

        pref = prefs_map.get(contact.name, {})
        contact["is_pinned"] = pref.get("is_pinned", False)
        contact["is_starred"] = pref.get("is_starred", False)
        contact["is_archived"] = pref.get("is_archived", False)
        contact["preference"] = prefs_list

        contact["labels"] = labels_by_contact.get(contact.name, [])

    contacts.sort(
        key=lambda x: x.get("last_message", {}).get("creation")
        if x.get("last_message")
        else "",
        reverse=True,
    )
    return contacts


def _display_name(first_name, last_name):
    """Join first and last names into a single display string."""
    parts = [p for p in (first_name or "", last_name or "") if p]
    return " ".join(parts)


def _pick_phone(src):
    """Return the primary phone, else the first phone, of a Frappe Contact.

    Args:
        src: Frappe Contact document.

    Returns:
        The chosen phone string, or None if the contact has no phones.
    """
    for ph in src.get("phone_nos") or []:
        if ph.is_primary_phone and ph.phone:
            return ph.phone
    for ph in src.get("phone_nos") or []:
        if ph.phone:
            return ph.phone
    return None