import { get_date_from_now, get_time, is_date_change, scroll_to_bottom } from "../chat_utils.js";
import MessageRenderer from "./message-renderer.js";

export default class MessagesContainer {
	constructor(chatSpace) {
		this.chatSpace = chatSpace;
		this.$container = null;
		this.messages = [];
		this.prevMessage = {};
		this.messageRenderer = new MessageRenderer(chatSpace);
	}

	render() {
		this.$container = $(document.createElement("div")).addClass("waba-messages-container");
		return this.$container;
	}

	getContainer() {
		return this.$container;
	}

	setMessages(messages) {
		this.messages = messages || [];
		this.prevMessage = {};
		this.renderMessages();
	}

	renderMessages() {
		if (!this.$container) return;

		let html = "";

		for (const message of this.messages) {
			const date_line_html = this.makeDateLineHtml(message.creation);
			html += date_line_html;

			const message_type = this.getMessageType(message);
			const replied_message = this.getMessageRenderer().getRepliedMessage(
				message.reply_to_message,
				this.messages,
			);

			html += this.getMessageRenderer()
				.makeMessage(
					message.content,
					get_time(message.creation),
					message_type,
					message.sender || message.sender_user_no,
					message.caption,
					message.status,
					message.type,
					message.name,
					replied_message,
					message.reply_to_message,
					message.content_type,
					message.attach,
					message.location_data,
					message.contact_data,
					message.button_data,
					message.interactive_data,
					message.reactions || null,
					message.is_template || false,
					message.template_name || null,
					message,
				)
				.prop("outerHTML");

			this.prevMessage = message;
		}

		this.$container.html(html);
	}

	appendMessage(message) {
		const date_line_html = this.makeDateLineHtml(message.creation);
		const message_type = this.getMessageType(message);
		const replied_message = this.getMessageRenderer().getRepliedMessage(
			message.reply_to_message,
			this.messages,
		);

		const $message = this.getMessageRenderer().makeMessage(
			message.content,
			get_time(message.creation),
			message_type,
			message.sender || message.sender_user_no,
			message.caption,
			message.status,
			message.type,
			message.name,
			replied_message,
			message.reply_to_message,
			message.content_type,
			message.attach,
			message.location_data,
			message.contact_data,
			message.button_data,
			message.interactive_data,
			message.reactions || null,
			message.is_template || false,
			message.template_name || null,
			message,
		);

		if (date_line_html) {
			this.$container.append($(date_line_html));
		}
		this.$container.append($message);
		scroll_to_bottom(this.$container);
	}
	getMessageType(message) {
		if (message.sender_user_no === this.chatSpace.profile.user_email) {
			return "recipient";
		}

		if (
			this.chatSpace.profile.room_type === "Guest" &&
			this.chatSpace.profile.is_admin === true &&
			message.sender !== "Guest"
		) {
			return "recipient";
		}

		return "sender";
	}

	makeDateLineHtml(dateObj) {
		let result = `
			<div class='waba-date-divider'>
				<span>${__(get_date_from_now(dateObj, "space"))}</span>
			</div>
		`;

		if ($.isEmptyObject(this.prevMessage)) {
			return result;
		} else if (is_date_change(dateObj, this.prevMessage.creation)) {
			return result;
		}
		return "";
	}

	updateReadStatus() {
		this.$container.find(".waba-message-received").each(function () {
			const $msg = $(this);
			const $statusIcon = $msg.find(".waba-msg-status");
			const hasReadIcon = $statusIcon.hasClass("waba-status-read");

			if (!hasReadIcon && $statusIcon.length) {
				const readIcon = `<svg class="waba-msg-status waba-status-read" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2">
					<path d="M20 6L9 17L4 12"/>
					<path d="M20 10L9 21L4 16"/>
				</svg>`;
				$statusIcon.replaceWith(readIcon);
			}
		});
	}

	getMessageRenderer() {
		return this.messageRenderer;
	}
}
