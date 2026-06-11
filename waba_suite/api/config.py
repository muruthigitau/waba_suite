import frappe
import frappe.utils
from frappe import _
from frappe.twofactor import two_factor_is_enabled
from frappe.utils.html_utils import get_icon_html
from frappe.utils.oauth import get_oauth2_authorize_url, get_oauth_keys
from frappe.utils.password import get_decrypted_password

no_cache = True


@frappe.whitelist(allow_guest=True)
def settings(token):
	"""Fetch and return the settings for a chat session

	Args:
	    token (str): Guest token.

	"""
	config = {
		"socketio_port": frappe.conf.socketio_port,
		"user_email": frappe.session.user,
		"is_admin": True if "user_type" in frappe.session.data else False,
		"guest_title": "".join(frappe.get_hooks("guest_title")),
	}

	config = {**config, **get_chat_settings()}

	if config["is_admin"]:
		config["user"] = get_admin_name(config["user_email"])
		config["user_settings"] = get_user_settings()
	else:
		config["user"] = "Guest"
		token_verify = validate_token(token)
		if token_verify[0] is True:
			config["room"] = token_verify[1]["room"]
			config["user_email"] = token_verify[1]["email"]
			config["is_verified"] = True
		else:
			config["is_verified"] = False

	return config


def get_admin_name(user_key):
	"""Get the admin name for specified user key"""
	full_name = frappe.db.get_value("User", user_key, "full_name")
	return full_name


def get_chat_settings():
	"""Get the chat settings
	Returns:
	    dict: Dictionary containing chat settings.
	"""
	# chat_settings = frappe.get_cached_doc('Chat Settings')
	# user_roles = frappe.get_roles()

	# allowed_roles = [u.role for u in chat_settings.allowed_roles]
	# allowed_roles.extend(['System Manager', 'Administrator'])
	result = {"enable_chat": False}

	# if frappe.session.user == 'Guest':
	#     result['enable_chat'] = True

	# if not chat_settings.enable_chat or not has_common(allowed_roles, user_roles):
	#     return result

	# chat_settings.chat_operators = [co.user for co in chat_settings.chat_operators]

	# if chat_settings.start_time and chat_settings.end_time:
	#     start_time = datetime.time.fromisoformat(chat_settings.start_time)
	#     end_time = datetime.time.fromisoformat(chat_settings.end_time)
	#     current_time = datetime.datetime.now().time()

	#     chat_status = 'Online' if time_in_range(
	#         start_time, end_time, current_time) else 'Offline'
	# else:
	#     chat_status = 'Online'

	result["enable_chat"] = True
	result["chat_status"] = "Online"
	return result


@frappe.whitelist()
def get_user_settings():
	"""Get current user's chat settings"""
	user = frappe.session.user

	if user == "Guest":
		return {"enable_message_tone": True, "enable_notifications": True, "user": user}

	return {
		"enable_message_tone": True,
		"enable_notifications": True,
		"user": user,
		"user_email": user,
		"full_name": frappe.db.get_value("User", user, "full_name"),
	}


@frappe.whitelist(allow_guest=True)
def get_user_details() -> dict:
	name = frappe.session.user
	user = frappe.get_doc("User", name)
	user_dict = user.as_dict()

	return user_dict


@frappe.whitelist(allow_guest=True)
def get_context():

	redirect_to = frappe.local.request.args.get("redirect-to")
	context = {"provider_logins": []}
	providers = frappe.get_all(
		"Social Login Key",
		filters={"enable_social_login": 1},
		fields=["name", "client_id", "base_url", "provider_name", "icon", "redirect_url"],
		order_by="name",
	)

	for provider in providers:
		client_secret = get_decrypted_password("Social Login Key", provider.name, "client_secret")
		if not client_secret:
			continue

		icon = {"html": "", "src": "", "alt": ""}
		if provider.icon:
			if provider.provider_name == "Custom":
				icon["html"] = get_icon_html(provider.icon, small=True)
			else:
				icon["src"] = provider.icon
				icon["alt"] = provider.provider_name

		if provider.client_id and provider.base_url and get_oauth_keys(provider.name):
			context["provider_logins"].append(
				{
					"name": provider.name,
					"provider_name": provider.provider_name,
					"auth_url": get_oauth2_authorize_url(provider.name, redirect_to),
					"redirect_to": provider.redirect_url,
					"icon": icon,
				}
			)
			context["social_login"] = True

	login_label = [_("Email")]
	if frappe.utils.cint(frappe.get_system_settings("allow_login_using_mobile_number")):
		login_label.append(_("Mobile"))

	if frappe.utils.cint(frappe.get_system_settings("allow_login_using_user_name")):
		login_label.append(_("Username"))

	context["login_label"] = f" {_('/')} ".join(login_label)

	context["login_with_email_link"] = frappe.get_system_settings("login_with_email_link")
	context["two_factor_is_enabled"] = two_factor_is_enabled()
	context["disable_signup"] = frappe.get_website_settings("disable_signup")

	return context
