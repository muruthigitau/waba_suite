"""WABA Suite app hooks.

Registers the app's frontend assets, scheduler events, document-event hooks,
sounds, and website route rules for the WhatsApp chat interface.

Key dependencies:
    - waba_suite.utils: Notification triggers and doc-event script runner
    - waba_suite.api.session: Session expiry maintenance
"""

app_name = "waba_suite"
app_title = "WABA Suite"
app_publisher = "David Gitau"
app_description = (
	"A comprehensive, all-in-one WhatsApp Business API (WABA) integration for the Frappe Framework"
)
app_email = "muruthigitau@gmail.com"
app_license = "agpl-3.0"

# Assets injected into the desk (chat UI bundle + core JS).
app_include_css = ["whatsapp_chat.bundle.css"]
app_include_js = ["whatsapp_chat.bundle.js", "/assets/waba_suite/js/wabasuitejs.js"]

# Scheduled jobs: trigger WhatsApp notifications by frequency and expire
# customer-service sessions once their 24h window elapses.
scheduler_events = {
	"all": ["waba_suite.utils.trigger_whatsapp_notifications_all"],
	"hourly": ["waba_suite.utils.trigger_whatsapp_notifications_hourly"],
	"hourly_long": ["waba_suite.utils.trigger_whatsapp_notifications_hourly_long"],
	"daily": [
		"waba_suite.utils.trigger_whatsapp_notifications_daily",
		"waba_suite.waba_suite.doctype.whatsapp_notification.whatsapp_notification.trigger_notifications",
		"waba_suite.api.session.expire_outdated_sessions",
	],
	"daily_long": ["waba_suite.utils.trigger_whatsapp_notifications_daily_long"],
	"weekly": ["waba_suite.utils.trigger_whatsapp_notifications_weekly"],
	"weekly_long": ["waba_suite.utils.trigger_whatsapp_notifications_weekly_long"],
	"monthly": ["waba_suite.utils.trigger_whatsapp_notifications_monthly"],
	"monthly_long": ["waba_suite.utils.trigger_whatsapp_notifications_monthly_long"],
}

# Document events: run the server-script runner on all doctypes, and update
# the session status whenever an incoming WhatsApp Message is inserted.
doc_events = {
	"*": {
		"before_insert": "waba_suite.utils.run_server_script_for_doc_event",
		"after_insert": "waba_suite.utils.run_server_script_for_doc_event",
		"before_validate": "waba_suite.utils.run_server_script_for_doc_event",
		"validate": "waba_suite.utils.run_server_script_for_doc_event",
		"on_update": "waba_suite.utils.run_server_script_for_doc_event",
		"before_submit": "waba_suite.utils.run_server_script_for_doc_event",
		"on_submit": "waba_suite.utils.run_server_script_for_doc_event",
		"before_cancel": "waba_suite.utils.run_server_script_for_doc_event",
		"on_cancel": "waba_suite.utils.run_server_script_for_doc_event",
		"on_trash": "waba_suite.utils.run_server_script_for_doc_event",
		"after_delete": "waba_suite.utils.run_server_script_for_doc_event",
		"before_update_after_submit": "waba_suite.utils.run_server_script_for_doc_event",
		"on_update_after_submit": "waba_suite.utils.run_server_script_for_doc_event",
	},
	"WhatsApp Message": {
		"after_insert": "waba_suite.api.session.on_whatsapp_message_after_insert",
	},
}

# UI sounds played for chat events.
sounds = [
	{
		"name": "chat-notification",
		"src": "/assets/frappe/sounds/email.mp3",
		"volume": 0.2,
	},
	{
		"name": "chat-message-send",
		"src": "/assets/frappe/sounds/submit.mp3",
		"volume": 0.2,
	},
	{
		"name": "chat-message-receive",
		"src": "/assets/frappe/sounds/alert.mp3",
		"volume": 0.5,
	},
]

# Serve the WhatsApp chat app at /whatsapp/<path>.
website_route_rules = [
	{"from_route": "/whatsapp/<path:app_path>", "to_route": "whatsapp"},
]
