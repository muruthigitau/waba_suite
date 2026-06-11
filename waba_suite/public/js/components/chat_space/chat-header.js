import { get_avatar_html } from "../chat_utils.js";

export default class ChatHeader {
	constructor(chatSpace) {
		this.chatSpace = chatSpace;
		this.$element = null;
	}

	render() {
		const profile = this.chatSpace.profile;
		const avatar_html = get_avatar_html(
			profile.room_type,
			profile.opposite_person_email,
			profile.room_name,
		);

		const display_name =
			profile.contact_name && profile.contact_name !== profile.user_email
				? `${profile.contact_name} (${profile.user_email})`
				: profile.room_name;

		const html = `
			<div class='waba-chat-header'>
				<span class='waba-chat-back-button' title='${__("Go Back")}'>
					${frappe.utils.icon("left")}
				</span>
				${avatar_html}
				<div class='waba-chat-profile-info'>
					<div class='waba-chat-profile-name'>
						<span class='waba-profile-name'>${__(display_name)}</span>
						<div class='waba-online-circle'></div>
					</div>
				</div>
				<div class='waba-chat-header-actions'>
					<div class='waba-header-icon waba-fullscreen-chat-btn' title='${__("Open in Full Page")}'>
						${frappe.utils.icon("expand", "sm")}
					</div>
					<div class='waba-header-icon waba-chat-close-button' title='${__("Close")}'>
						${frappe.utils.icon("close", "md")}
					</div>
				</div>
			</div>
		`;
		this.$element = $(html);
		return this.$element;
	}
}
