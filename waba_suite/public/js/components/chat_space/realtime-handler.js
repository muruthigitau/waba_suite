import { get_time } from "../chat_utils.js";

export default class RealtimeHandler {
	constructor(chatSpace) {
		this.chatSpace = chatSpace;
		this.received_message_ids = new Set();
	}

	setup() {
		const me = this;

		frappe.realtime.on(this.chatSpace.profile.room, (res) => {
			if (res.whatsapp_account === me.chatSpace.profile.whatsapp_account) {
				me.handleIncomingMessage(res);
			}
		});

		frappe.realtime.on("latest_chat_updates", (res) => {
			if (
				res.room === me.chatSpace.profile.room &&
				res.whatsapp_account === me.chatSpace.profile.whatsapp_account
			) {
				me.handleIncomingMessage(res);
			}
		});

		frappe.realtime.on("message_status_update", (res) => {
			if (
				res.room === me.chatSpace.profile.room &&
				res.whatsapp_account === me.chatSpace.profile.whatsapp_account
			) {
				me.updateMessageStatus(res.message_id, res.status);
			}
		});
	}

	handleIncomingMessage(res) {
		const msg_id = res.name || `${res.content}-${res.creation}-${res.sender_user_no}`;
		if (this.received_message_ids.has(msg_id)) return;
		this.received_message_ids.add(msg_id);

		if (
			res.sender_user_no === "Administrator" ||
			res.sender_user_no === this.chatSpace.profile.user
		)
			return;

		const replied_message = this.chatSpace.messagesContainer
			.getMessageRenderer()
			.getRepliedMessage(res.reply_to_message, this.chatSpace.messagesContainer.messages);

		let chat_type = "sender";
		if (
			this.chatSpace.profile.room_type === "Guest" &&
			this.chatSpace.profile.is_admin === true &&
			res.user !== "Guest"
		) {
			chat_type = "recipient";
		}

		const $message = this.chatSpace.messagesContainer
			.getMessageRenderer()
			.makeMessage(
				res.content,
				get_time(res.creation),
				chat_type,
				res.user || res.sender_user_no,
				res.caption,
				res.status,
				res.type,
				res.name,
				replied_message,
				res.reply_to_message,
				res.content_type,
				res.attach,
				res.location_data,
				res.contact_data,
				res.button_data,
				res.interactive_data,
				res.reactions || null,
				res.is_template || false,
				res.template_name || null,
			);

		this.chatSpace.messagesContainer.getContainer().append($message);
		this.chatSpace.markAllUnreadAsRead();
	}

	updateMessageStatus(messageId, newStatus) {
		const $message = $(`.waba-message-sent[data-message-id="${messageId}"]`);
		if ($message.length) {
			const $statusIcon = $message.find(".waba-msg-status");
			const newIcon = this.chatSpace.messagesContainer
				.getMessageRenderer()
				.getMessageStatusIcon(newStatus, "Outgoing");
			$statusIcon.replaceWith(newIcon);
		}
	}

	destroy() {
		frappe.realtime.off(this.chatSpace.profile.room);
		frappe.realtime.off("latest_chat_updates");
		frappe.realtime.off("message_status_update");
	}
}
