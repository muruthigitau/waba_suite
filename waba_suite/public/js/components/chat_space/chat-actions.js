import { get_time, scroll_to_bottom, send_message } from "../chat_utils.js";
import EmojiPicker from "../emoji-picker.js";
import MessageRenderer from "./message-renderer.js";

export default class ChatActions {
	constructor(chatSpace) {
		this.chatSpace = chatSpace;
		this.$element = null;
		this.reply_to_message = null;
		this.messageRenderer = new MessageRenderer(chatSpace);
		this.emojiPickerInstance = null;
		this.quickEmojis = ["😀", "😂", "❤️", "👍", "🎉", "🙏"];
	}

	render() {
		const html = `
			<div class='waba-chat-actions' style="position: relative;">
				<div class='waba-emoji-button' title='${__("Send Emoji")}'>
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<path d="M8 14s1.5 2 4 2 4-2 4-2"/>
						<line x1="9" y1="9" x2="9.01" y2="9"/>
						<line x1="15" y1="9" x2="15.01" y2="9"/>
					</svg>
				</div>
				<div class='waba-type-wrapper' style='flex: 1; position: relative;'>
					<div class='waba-reply-preview' style='display: none; position: absolute; bottom: 100%; left: 0; right: 0; background: var(--wa-bg-sidebar); border-radius: 12px; margin-bottom: 8px; padding: 8px 12px; box-shadow: var(--wa-shadow-md); z-index: 10; border-left: 3px solid var(--wa-primary);'>
						<div class='waba-reply-preview-content' style='display: flex; align-items: flex-start; gap: 10px;'>
							<div style='flex: 1;'>
								<div class='waba-reply-preview-sender' style='font-size: 11px; font-weight: 600; color: var(--wa-primary); margin-bottom: 4px;'></div>
								<div class='waba-reply-preview-text' style='font-size: 12px; color: var(--wa-text-secondary); word-break: break-word;'></div>
							</div>
							<span class='waba-reply-preview-remove' style='cursor: pointer; color: var(--wa-text-light); padding: 4px;'>&times;</span>
						</div>
					</div>
					<input class='form-control waba-type-message' type='text' placeholder='${__("Type a message")}'>
				</div>
				<div class='waba-send-button'>
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
						<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
					</svg>
				</div>
			</div>
		`;
		this.$element = $(html);
		this.setupEvents();
		return this.$element;
	}

	setupEvents() {
		const me = this;

		this.$element.find(".waba-send-button").on("click", () => {
			this.handleSendMessage();
		});

		this.$element.find(".waba-type-message").on("keydown", function (e) {
			if (e.which === 13 && !e.shiftKey) {
				e.preventDefault();
				me.handleSendMessage();
			}
		});

		this.$element.find(".waba-emoji-button").on("click", (e) => {
			e.stopPropagation();
			this.showSmallEmojiPicker((emoji) => {
				this.sendEmojiMessage(emoji);
			});
		});

		this.$element.find(".waba-reply-preview-remove").on("click", () => {
			this.hideReplyPreview();
		});
	}

	showSmallEmojiPicker(onSelect) {
		$(".waba-small-emoji-picker-popup").remove();
		if (this.emojiPickerInstance) {
			this.emojiPickerInstance.destroy();
		}

		const pickerHtml = `
			<div class="waba-small-emoji-picker-popup" style="
				position: absolute;
				bottom: 60px;
				left: 10px;
				background: var(--wa-bg-sidebar, #fff);
				border-radius: 24px;
				padding: 6px 10px;
				box-shadow: 0 4px 20px rgba(0,0,0,0.18);
				display: flex;
				gap: 4px;
				align-items: center;
				z-index: 1100;
				border: 1px solid var(--wa-border);
			">
				${this.quickEmojis
					.map(
						(e) => `
					<span class="waba-quick-emoji-option" data-emoji="${e}" style="
						font-size: 22px;
						cursor: pointer;
						padding: 4px;
						border-radius: 50%;
						display: inline-block;
						transition: transform 0.12s;
					">${e}</span>
				`,
					)
					.join("")}
				<span class="waba-expand-emoji-picker" style="
					font-size: 18px;
					cursor: pointer;
					padding: 4px;
					border-radius: 50%;
					display: inline-block;
					transition: transform 0.12s;
				">➕</span>
			</div>
		`;

		const $picker = $(pickerHtml);

		$picker
			.find(".waba-quick-emoji-option")
			.on("mouseenter", function () {
				$(this).css("transform", "scale(1.25)");
			})
			.on("mouseleave", function () {
				$(this).css("transform", "scale(1)");
			})
			.on("click", function (e) {
				e.stopPropagation();
				const emoji = $(this).data("emoji");
				onSelect(emoji);
				$picker.remove();
			});

		$picker.find(".waba-expand-emoji-picker").on("click", (e) => {
			e.stopPropagation();
			$picker.remove();

			this.emojiPickerInstance = new EmojiPicker((emoji) => {
				onSelect(emoji);
			});

			this.emojiPickerInstance.init().then(() => {
				this.emojiPickerInstance.show();
			});
		});

		this.$element.append($picker);

		const dismissPicker = (e) => {
			if (
				!$(e.target).closest(
					".waba-small-emoji-picker-popup, .waba-emoji-button, .waba-action-react, .waba-emoji-full-picker",
				).length
			) {
				$picker.remove();
				$(document).off("click", dismissPicker);
			}
		};

		setTimeout(() => {
			$(document).on("click", dismissPicker);
		}, 100);
	}

	sendReactionToMessage(messageId, emoji) {
		send_message(
			emoji,
			this.chatSpace.profile.user,
			this.chatSpace.profile.room,
			this.chatSpace.profile.user_email,
			null,
			Date.now().toString(),
			this.chatSpace.profile.whatsapp_account,
			messageId,
			"reaction",
		);
	}

	sendEmojiMessage(emoji) {
		if (!emoji) return;

		const messageId = Date.now().toString();
		const replyToMessageId = this.reply_to_message ? this.reply_to_message.name : null;
		const repliedMessage = this.reply_to_message
			? this.messageRenderer.getRepliedMessage(
					this.reply_to_message.name,
					this.chatSpace.messagesContainer.messages,
				)
			: null;

		const $message = this.messageRenderer.makeMessage(
			emoji,
			get_time(),
			"recipient",
			this.chatSpace.profile.user,
			null,
			"sent",
			"Outgoing",
			messageId,
			repliedMessage,
			replyToMessageId,
			"text",
		);

		this.chatSpace.messagesContainer.getContainer().append($message);
		scroll_to_bottom(this.chatSpace.messagesContainer.getContainer());

		send_message(
			emoji,
			this.chatSpace.profile.user,
			this.chatSpace.profile.room,
			this.chatSpace.profile.user_email,
			null,
			messageId,
			this.chatSpace.profile.whatsapp_account,
			replyToMessageId,
		);

		this.hideReplyPreview();
	}

	showReplyPreview(message) {
		const $preview = this.$element.find(".waba-reply-preview");
		const $sender = $preview.find(".waba-reply-preview-sender");
		const $text = $preview.find(".waba-reply-preview-text");

		let senderName = message.sender_user_no || message.from || "Unknown";
		if (senderName === this.chatSpace.profile.user_email) {
			senderName = __("You");
		} else if (message.profile_name) {
			senderName = message.profile_name;
		} else if (message.contact_name) {
			senderName = message.contact_name;
		}

		let replyText = this.messageRenderer.getRepliedContent(message);
		$sender.text(__("Replying to {0}", [senderName]));

		if (replyText.length > 100) {
			replyText = replyText.substring(0, 100) + "...";
		}
		$text.text(replyText);
		$preview.show();
	}

	hideReplyPreview() {
		const $preview = this.$element.find(".waba-reply-preview");
		$preview.hide();
		$preview.find(".waba-reply-preview-sender").text("");
		$preview.find(".waba-reply-preview-text").text("");
		this.reply_to_message = null;
	}

	handleSendMessage() {
		const $type_message = this.$element.find(".waba-type-message");
		let content = $type_message.val();

		if (!content || content.trim().length === 0) {
			return;
		}

		const messageId = Date.now().toString();
		const replyToMessageId = this.reply_to_message ? this.reply_to_message.name : null;
		const repliedMessage = this.reply_to_message
			? this.messageRenderer.getRepliedMessage(
					this.reply_to_message.name,
					this.chatSpace.messagesContainer.messages,
				)
			: null;

		const $message = this.messageRenderer.makeMessage(
			content,
			get_time(),
			"recipient",
			this.chatSpace.profile.user,
			null,
			"sent",
			"Outgoing",
			messageId,
			repliedMessage,
			replyToMessageId,
		);

		this.chatSpace.messagesContainer.getContainer().append($message);
		$type_message.val("");
		scroll_to_bottom(this.chatSpace.messagesContainer.getContainer());

		send_message(
			content,
			this.chatSpace.profile.user,
			this.chatSpace.profile.room,
			this.chatSpace.profile.user_email,
			null,
			messageId,
			this.chatSpace.profile.whatsapp_account,
			replyToMessageId,
		);

		this.hideReplyPreview();
	}
}
