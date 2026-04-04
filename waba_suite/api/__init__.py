# Copyright (c) 2024, Shridhar Patil and contributors
# For license information, please see license.txt

import frappe
from frappe import _


@frappe.whitelist()
def transfer_to_agent(phone_number, whatsapp_account=None, agent=None, notes=None):
    """Transfer a WhatsApp conversation to a human agent.

    This stops the chatbot from auto-responding to this number.

    Args:
        phone_number: The customer's phone number (required)
        whatsapp_account: Optional WhatsApp account
        agent: Optional user email to assign the conversation to
        notes: Optional notes about the transfer

    Returns:
        dict with transfer status and document name
    """
    if not phone_number:
        frappe.throw(_("Phone number is required"))

    from waba_suite.frappe_whatsapp_chatbot.doctype.whatsapp_agent_transfer.whatsapp_agent_transfer import (
        WhatsAppAgentTransfer,
    )

    doc = WhatsAppAgentTransfer.transfer_to_agent(
        phone_number=phone_number,
        whatsapp_account=whatsapp_account,
        agent=agent,
        notes=notes,
    )

    return {
        "status": "transferred",
        "name": doc.name,
        "phone_number": phone_number,
        "agent": agent,
    }


@frappe.whitelist()
def resume_chatbot(phone_number, whatsapp_account=None):
    """Resume chatbot auto-responses for a phone number.

    Args:
        phone_number: The customer's phone number (required)
        whatsapp_account: Optional WhatsApp account filter

    Returns:
        dict with resume status
    """
    if not phone_number:
        frappe.throw(_("Phone number is required"))

    from waba_suite.frappe_whatsapp_chatbot.doctype.whatsapp_agent_transfer.whatsapp_agent_transfer import (
        WhatsAppAgentTransfer,
    )

    resumed = WhatsAppAgentTransfer.resume_chatbot(
        phone_number=phone_number, whatsapp_account=whatsapp_account
    )

    if resumed:
        return {
            "status": "resumed",
            "phone_number": phone_number,
            "message": _("Chatbot has been resumed for this number"),
        }
    else:
        return {
            "status": "not_found",
            "phone_number": phone_number,
            "message": _("No active transfer found for this number"),
        }


@frappe.whitelist()
def is_transferred(phone_number, whatsapp_account=None):
    """Check if a phone number is currently transferred to an agent.

    Args:
        phone_number: The phone number to check (required)
        whatsapp_account: Optional WhatsApp account filter

    Returns:
        dict with transfer status
    """
    if not phone_number:
        frappe.throw(_("Phone number is required"))

    from waba_suite.frappe_whatsapp_chatbot.doctype.whatsapp_agent_transfer.whatsapp_agent_transfer import (
        WhatsAppAgentTransfer,
    )

    is_active = WhatsAppAgentTransfer.is_transferred(
        phone_number=phone_number, whatsapp_account=whatsapp_account
    )

    if is_active:
        # Get transfer details
        transfer = frappe.get_doc("WhatsApp Agent Transfer", is_active)
        return {
            "is_transferred": True,
            "phone_number": phone_number,
            "transfer_name": transfer.name,
            "agent": transfer.agent,
            "agent_name": transfer.agent_name,
            "transferred_at": transfer.transferred_at,
        }
    else:
        return {"is_transferred": False, "phone_number": phone_number}


@frappe.whitelist()
def get_active_transfers(whatsapp_account=None, agent=None):
    """Get all active agent transfers.

    Args:
        whatsapp_account: Optional filter by WhatsApp account
        agent: Optional filter by assigned agent

    Returns:
        list of active transfers
    """
    filters = {"status": "Active"}

    if whatsapp_account:
        filters["whatsapp_account"] = whatsapp_account
    if agent:
        filters["agent"] = agent

    transfers = frappe.get_all(
        "WhatsApp Agent Transfer",
        filters=filters,
        fields=[
            "name",
            "phone_number",
            "whatsapp_account",
            "agent",
            "agent_name",
            "transferred_at",
            "notes",
        ],
        order_by="transferred_at desc",
    )

    return transfers
