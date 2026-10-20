"""WhatsApp chat page context.

Provides the boot context (CSRF token + app metadata) for the WhatsApp web
page, and a developer-only endpoint to fetch the same boot data.

Key dependencies:
    - frappe
"""

import frappe
from frappe.utils import get_system_timezone

from waba_suite.api.contact_helpers import is_user_allowed

no_cache = 1


def get_context():
    """Build the page context with CSRF token and boot data.

    Strict permissions: only users on a WhatsApp Account's Users table
    (or Administrators) may view the WhatsApp page. The access flag is
    exposed in the boot context for the frontend to enforce.
    """
    csrf_token = frappe.sessions.get_csrf_token()
    context = frappe._dict()
    context.boot = get_boot()
    context.boot.csrf_token = csrf_token
    context.boot.has_whatsapp_access = is_user_allowed()
    return context


@frappe.whitelist(methods=["POST"])
def get_access_status():
    """Return the current user's WhatsApp access status.

    Returns:
        Dict with has_access (bool) and user (str).
    """
    if not is_user_allowed():
        frappe.throw(
            "You do not have access to WhatsApp. Please contact your administrator.",
            frappe.PermissionError,
        )
    return {
        "has_access": True,
        "user": frappe.session.user,
    }


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
    """Return boot data for development (restricted to developer mode).

    Raises:
        frappe.ValidationError if the site is not in developer mode.
    """
    if not frappe.conf.developer_mode:
        frappe.throw("This method is only meant for developer mode")
    return get_boot()


def get_boot():
    """Build the boot dict with app version, site, and timezone info."""
    return frappe._dict(
        {
            "frappe_version": frappe.__version__,
            "site_name": frappe.local.site,
            "read_only_mode": frappe.flags.read_only,
            "system_timezone": get_system_timezone(),
        }
    )