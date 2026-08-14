"""WhatsApp Message Sender.

Handles sending WhatsApp messages via the Facebook Business API,
including template messages, media messages, and read receipts.

Key dependencies:
    - frappe: ERPNext framework
    - json: JSON serialization for API requests
    - waba_suite.utils: Utility functions for number formatting
"""

import json

import frappe
from frappe.integrations.utils import make_post_request


def send_whatsapp_message(doc):
    """Send a WhatsApp message via the Facebook Business API.

    Handles all message types: text, image, video, document, audio,
    reaction, interactive, and template messages.

    Args:
        doc: WhatsApp Message document to send.
    """
    if not doc.whatsapp_account:
        return
    wa = frappe.get_doc("WhatsApp Account", doc.whatsapp_account)
    token = wa.get_password("token")
    headers = {
        "authorization": f"Bearer {token}",
        "content-type": "application/json",
    }
    url = f"{wa.url}/{wa.version}/{wa.phone_id}/messages"
    ir = _create_integration_request(
        doc, url, headers, doc._data, f"Send WhatsApp {doc._data.get('type', 'message')} to {doc._data.get('to')}"
    )
    try:
        resp = make_post_request(url, headers=headers, data=json.dumps(doc._data))
        ir.status = "Completed"
        ir.output = json.dumps(resp, indent=2) if isinstance(resp, dict) else str(resp)
        ir.save(ignore_permissions=True)
        frappe.get_doc(
            {
                "doctype": "WhatsApp Notification Log",
                "template": doc.template,
                "whatsapp_message": doc.name,
                "whatsapp_account": doc.whatsapp_account,
                "meta_data": {"request": doc._data, "response": resp},
            }
        ).insert(ignore_permissions=True)
        if isinstance(resp, dict) and resp.get("error"):
            frappe.throw(resp["error"].get("message", "WhatsApp API Error"))
        mid = None
        if isinstance(resp, dict):
            msgs = resp.get("messages", [])
            if msgs and len(msgs) > 0:
                mid = msgs[0].get("id")
        if mid:
            frappe.db.set_value("WhatsApp Message", doc.name, "message_id", mid)
    except Exception as api_err:
        _handle_api_error(doc, ir, url, headers, api_err)


def send_read_receipt(doc):
    """Send a read receipt for a WhatsApp message.

    Args:
        doc: WhatsApp Message document to mark as read.

    Returns:
        True if successful, False otherwise.
    """
    if not doc.message_id:
        return False
    data = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": doc.message_id,
    }
    st = frappe.get_doc("WhatsApp Account", doc.whatsapp_account)
    token = st.get_password("token")
    headers = {
        "authorization": f"Bearer {token}",
        "content-type": "application/json",
    }
    url = f"{st.url}/{st.version}/{st.phone_id}/messages"
    ir = _create_integration_request(
        doc, url, headers, data, f"Read receipt {doc.message_id}"
    )
    try:
        resp = make_post_request(url, headers=headers, data=json.dumps(data))
        ir.status = "Completed"
        ir.output = json.dumps(resp, indent=2) if isinstance(resp, dict) else str(resp)
        ir.save(ignore_permissions=True)
        if isinstance(resp, dict) and resp.get("success"):
            frappe.db.set_value("WhatsApp Message", doc.name, "status", "marked_as_read")
            frappe.db.commit()
            return True
        return False
    except Exception as api_err:
        er = {"error": str(api_err)}
        if hasattr(api_err, "response") and api_err.response:
            if hasattr(api_err.response, "text"):
                er["response_text"] = api_err.response.text
        ir.status = "Failed"
        ir.error = json.dumps(er, indent=2)
        ir.save(ignore_permissions=True)
        return False


def _create_integration_request(doc, url, headers, data, description):
    """Create an Integration Request document for API call tracking.

    Args:
        doc: Source document.
        url: API endpoint URL.
        headers: Request headers.
        data: Request payload.
        description: Human-readable description.

    Returns:
        Integration Request document.
    """
    return frappe.get_doc(
        {
            "doctype": "Integration Request",
            "integration_request_service": "WhatsApp",
            "is_remote_request": 1,
            "request_description": description,
            "status": "Queued",
            "url": url,
            "request_headers": json.dumps(headers, indent=2),
            "data": json.dumps(data, indent=2),
            "reference_doctype": doc.doctype,
            "reference_docname": doc.name,
        }
    ).insert(ignore_permissions=True)


def _handle_api_error(doc, ir, url, headers, api_err):
    """Handle and log WhatsApp API errors.

    Args:
        doc: Source document.
        ir: Integration Request document.
        url: API endpoint URL.
        headers: Request headers.
        api_err: The exception that occurred.
    """
    response_body = None
    response_status = None
    if hasattr(api_err, "response") and api_err.response is not None:
        resp = api_err.response
        if hasattr(resp, "status_code"):
            response_status = resp.status_code
        if hasattr(resp, "text"):
            response_body = resp.text
            try:
                response_body = json.loads(resp.text)
            except Exception:
                pass

    ir.status = "Failed"
    ir.error = json.dumps(response_body or str(api_err), indent=2)
    ir.save(ignore_permissions=True)

    log_parts = [
        "WHATSAPP API ERROR",
        f"URL: {url}",
        f"Status: {response_status}",
        f"Headers: {json.dumps(headers, indent=2)}",
        f"Request Body: {json.dumps(doc._data, indent=2)}",
    ]
    if response_body:
        if isinstance(response_body, dict):
            error_data = response_body.get("error", {})
            if isinstance(error_data, dict):
                log_parts.append(f"FB Error Code: {error_data.get('code', 'N/A')}")
                log_parts.append(f"FB Error Type: {error_data.get('type', 'N/A')}")
                log_parts.append(f"FB Error Message: {error_data.get('message', 'N/A')}")
                log_parts.append(f"FB Error Details: {error_data.get('error_data', {})}")
            log_parts.append(f"Full FB Response: {json.dumps(response_body, indent=2)}")
        else:
            log_parts.append(f"Response: {response_body}")
    frappe.log_error(title="WhatsApp Send Error", message="\n".join(log_parts))
    frappe.get_doc(
        {
            "doctype": "WhatsApp Notification Log",
            "template": doc.template,
            "whatsapp_message": doc.name,
            "whatsapp_account": doc.whatsapp_account,
            "meta_data": {"request": doc._data, "response": response_body or str(api_err)},
        }
    ).insert(ignore_permissions=True)