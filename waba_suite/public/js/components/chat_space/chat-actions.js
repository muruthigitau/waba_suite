import { get_time, scroll_to_bottom, send_message } from "../chat_utils.js";
import MessageRenderer from "./message-renderer.js";

export default class ChatActions {
	constructor(chatSpace) {
		this.chatSpace = chatSpace;
		this.$element = null;
		this.file = null;
		this.reply_to_message = null;
		this.messageRenderer = new MessageRenderer(chatSpace);
	}

	render() {
		const html = `
			<div class='waba-chat-actions'>
				<div class='waba-attach-button' title='${__("Attach file")}'>
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
					</svg>
				</div>
				<input type='file' id='waba-file-uploader' accept='image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain' style='display: none;'>
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
			if (this.file) this.handleUploadFile(this.file);
			else this.handleSendMessage();
		});

		this.$element.find(".waba-type-message").keydown(function (e) {
			if (e.which === 13 && !e.shiftKey) {
				e.preventDefault();
				if (me.file) me.handleUploadFile(me.file);
				else me.handleSendMessage();
			}
		});

		this.$element.find(".waba-type-message").on("keydown", (e) => {
			if (e.key === "Escape") {
				this.hideReplyPreview();
				this.chatSpace.dismissAllPopups();
			}
		});

		this.$element.find(".waba-attach-button").on("click", () => {
			$("#waba-file-uploader").click();
		});

		$("#waba-file-uploader").on("change", (e) => {
			if (e.target.files.length > 0) {
				this.file = { file_obj: e.target.files[0], name: e.target.files[0].name };
				this.showFilePreview(this.file);
			}
		});

		this.$element.find(".waba-reply-preview-remove").on("click", () => {
			this.hideReplyPreview();
		});
	}

	showReplyPreview(message) {
		const $preview = $(".waba-reply-preview");
		const $sender = $(".waba-reply-preview-sender");
		const $text = $(".waba-reply-preview-text");

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
		$text.text(replyText);
		$preview.show();
	}

	hideReplyPreview() {
		$(".waba-reply-preview").hide();
		$(".waba-reply-preview-sender").text("");
		$(".waba-reply-preview-text").text("");
		this.reply_to_message = null;
	}

	showFilePreview(file) {
		const $preview = $(".waba-file-preview");
		const $previewName = $(".waba-file-preview-name");
		const maxNameLength = 30;
		let fileName = file.name;
		if (fileName.length > maxNameLength)
			fileName = fileName.substring(0, maxNameLength) + "...";
		$previewName.text(fileName);
		$preview.show();
	}

	hideFilePreview() {
		$(".waba-file-preview").hide();
		$(".waba-file-preview-name").text("");
		this.file = null;
		$("#waba-file-uploader").val("");
	}

	async handleUploadFile(file) {
		return new Promise((resolve, reject) => {
			let xhr = new XMLHttpRequest();

			xhr.upload.addEventListener("load", () => resolve());
			xhr.addEventListener("error", () => reject(frappe.throw(__("Internal Server Error"))));

			xhr.onreadystatechange = () => {
				if (xhr.readyState === XMLHttpRequest.DONE) {
					if (xhr.status === 200) {
						let r = null,
							file_doc = null;
						try {
							r = JSON.parse(xhr.responseText);
							if (r.message.doctype === "File") file_doc = r.message;
						} catch (e) {
							r = xhr.responseText;
						}
						try {
							if (file_doc === null) reject(frappe.throw(__("File upload failed!")));
							this.handleSendMessage(file_doc.file_url);
						} catch (error) {
							reject(error);
						}
					} else {
						try {
							const error = JSON.parse(xhr.responseText);
							const messages = JSON.parse(error._server_messages);
							const errorObj = JSON.parse(messages[0]);
							reject(frappe.throw(__(errorObj.message)));
						} catch (e) {
							reject(frappe.throw(__("File upload failed!")));
						}
					}
				}
			};

			xhr.open("POST", "/api/method/upload_file", true);
			xhr.setRequestHeader("Accept", "application/json");
			xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);

			let form_data = new FormData();
			form_data.append("file", file.file_obj, file.name);
			form_data.append("is_private", false);
			form_data.append("doctype", "WhatsApp Contact");
			form_data.append("docname", this.chatSpace.profile.room);
			form_data.append("optimize", true);
			xhr.send(form_data);
		});
	}

	handleSendMessage(attachment) {
		const $type_message = $(".waba-type-message");
		let content = attachment || $type_message.val();

		if ((!content || content.trim().length === 0) && !attachment) return;

		const messageId = Date.now().toString();
		const replyToMessageId = this.reply_to_message ? this.reply_to_message.name : null;
		const repliedMessage = this.reply_to_message
			? this.messageRenderer.getRepliedMessage(
					this.reply_to_message.name,
					this.chatSpace.messagesContainer.messages,
				)
			: null;

		if (content && content.trim().length > 0 && !attachment) {
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
		}

		scroll_to_bottom(this.chatSpace.messagesContainer.getContainer());

		send_message(
			content,
			this.chatSpace.profile.user,
			this.chatSpace.profile.room,
			this.chatSpace.profile.user_email,
			attachment,
			messageId,
			this.chatSpace.profile.whatsapp_account,
			replyToMessageId,
		);

		if (attachment) this.hideFilePreview();
		this.hideReplyPreview();
	}

	async sendReaction(messageId, emoji) {
		const reactionMessageId = Date.now().toString();

		const $message = this.messageRenderer.makeMessage(
			emoji,
			get_time(),
			"recipient",
			this.chatSpace.profile.user,
			null,
			"sent",
			"Outgoing",
			reactionMessageId,
			null,
			messageId,
			"reaction",
		);

		this.chatSpace.messagesContainer.getContainer().append($message);
		scroll_to_bottom(this.chatSpace.messagesContainer.getContainer());

		send_message(
			emoji,
			this.chatSpace.profile.user,
			this.chatSpace.profile.room,
			this.chatSpace.profile.user_email,
			null,
			reactionMessageId,
			this.chatSpace.profile.whatsapp_account,
			messageId,
			"reaction",
		);
	}
}
