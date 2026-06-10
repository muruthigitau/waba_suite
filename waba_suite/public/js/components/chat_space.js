import {
	get_avatar_html,
	get_date_from_now,
	get_messages,
	get_time,
	is_date_change,
	is_image,
	scroll_to_bottom,
	send_message,
} from "./chat_utils";

export default class ChatSpace {
	constructor(opts) {
		this.chat_list = opts.chat_list;
		this.$wrapper = opts.$wrapper;
		this.profile = opts.profile;
		this.file = null;
		this.reply_to_message = null;
		this.refresh_interval = null;
		this.is_refreshing = false;
		this.last_message_count = 0;
		this.setup();
	}

	setup() {
		this.$chat_space = $(document.createElement("div"));
		this.$chat_space.addClass("waba-chat-space");
		this.setup_header();
		this.fetch_and_setup_messages();
		this.setup_socketio();
		this.start_auto_refresh();
	}

	setup_header() {
		this.avatar_html = get_avatar_html(
			this.profile.room_type,
			this.profile.opposite_person_email,
			this.profile.room_name,
		);

		const display_name =
			this.profile.contact_name && this.profile.contact_name !== this.profile.user_email
				? `${this.profile.contact_name} (${this.profile.user_email})`
				: this.profile.room_name;

		const header_html = `
            <div class='waba-chat-header'>
                <span class='waba-chat-back-button' title='${__("Go Back")}'>
                    ${frappe.utils.icon("left")}
                </span>
                ${this.avatar_html}
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
		this.$chat_space.append(header_html);
	}

	async fetch_and_setup_messages() {
		try {
			const res = await get_messages(
				this.profile.room,
				this.profile.user_email,
				this.profile.whatsapp_account,
			);
			this.last_message_count = res ? res.length : 0;
			this.setup_messages(res);
			this.setup_actions();
			this.render();
			await this.mark_all_unread_as_read();
		} catch (error) {
			frappe.msgprint({
				title: __("Error"),
				message: __("Something went wrong. Please refresh and try again."),
			});
		}
	}

	async mark_all_unread_as_read() {
		try {
			const result = await frappe.call({
				method: "waba_suite.api.message.mark_multiple_as_read",
				args: {
					whatsapp_contact: this.profile.room,
					whatsapp_account: this.profile.whatsapp_account,
				},
			});

			if (result.message && result.message.status === "success") {
				this.$chat_space_container.find(".waba-message-received").each(function () {
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
		} catch (error) {}
	}

	setup_messages(messages_list) {
		this.$chat_space_container = $(document.createElement("div"));
		this.$chat_space_container.addClass("waba-messages-container");
		this.make_messages_html(messages_list);
		this.$chat_space_container.html(this.message_html);
		this.$chat_space.append(this.$chat_space_container);
	}

	make_messages_html(messages_list) {
		this.prevMessage = {};
		this.message_html = ``;
		this.messages_data = messages_list;

		if (this.profile.message) {
			messages_list.push(this.profile.message);
			send_message(
				this.profile.message.content,
				this.profile.user,
				this.profile.room,
				this.profile.user_email,
				null,
				null,
				this.profile.whatsapp_account,
			);
		}

		messages_list.forEach((element) => {
			const date_line_html = this.make_date_line_html(element.creation);
			this.message_html += date_line_html;

			let message_type = "sender";

			if (element.sender_user_no === this.profile.user_email) {
				message_type = "recipient";
			} else if (this.profile.room_type === "Guest") {
				if (this.profile.is_admin === true && element.sender !== "Guest") {
					message_type = "recipient";
				}
			}

			const replied_message = this.get_replied_message(element.reply_to_message);

			this.message_html += this.make_message(
				element.content,
				get_time(element.creation),
				message_type,
				element.sender || element.sender_user_no,
				element.caption,
				element.status,
				element.type,
				element.name,
				replied_message,
				element.reply_to_message,
				element.content_type,
				element.attach,
				element.location_data,
				element.contact_data,
				element.button_data,
				element.interactive_data,
				element.reactions || null,
				element.is_template || false,
				element.template_name || null,
			).prop("outerHTML");

			this.prevMessage = element;
		});
	}

	get_replied_message(reply_to_message_id) {
		if (!reply_to_message_id) return null;

		const replied_msg = this.messages_data?.find((msg) => msg.name === reply_to_message_id);
		if (!replied_msg) return null;

		let replied_content = "";
		switch (replied_msg.content_type) {
			case "image":
				replied_content = "📷 " + __("Image");
				break;
			case "video":
				replied_content = "🎥 " + __("Video");
				break;
			case "audio":
				replied_content = "🎵 " + __("Audio");
				break;
			case "document":
				replied_content = "📄 " + __("Document");
				break;
			case "location":
				replied_content = "📍 " + __("Location");
				break;
			case "contact":
				replied_content = "👤 " + __("Contact");
				break;
			case "reaction":
				replied_content = "😊 " + __("Reaction");
				break;
			case "flow":
				replied_content = "📋 " + __("Form");
				break;
			case "button":
				replied_content = "🔘 " + __("Button");
				break;
			case "interactive":
				replied_content = "💬 " + __("Interactive Message");
				break;
			case "template":
				replied_content = "📨 " + __("Template Message");
				break;
			default:
				replied_content = replied_msg.content || replied_msg.message || "";
				if (replied_content.length > 100) {
					replied_content = replied_content.substring(0, 100) + "...";
				}
		}

		let replied_sender = replied_msg.sender_user_no || replied_msg.from || "Unknown";
		if (replied_sender === this.profile.user_email) {
			replied_sender = __("You");
		} else if (replied_msg.profile_name) {
			replied_sender = replied_msg.profile_name;
		} else if (replied_msg.contact_name) {
			replied_sender = replied_msg.contact_name;
		}

		return {
			content: replied_content,
			sender: replied_sender,
			message_id: reply_to_message_id,
			content_type: replied_msg.content_type,
		};
	}

	make_date_line_html(dateObj) {
		let result = `
            <div class='waba-date-divider'>
                <span>${__(get_date_from_now(dateObj, "space"))}</span>
            </div>
        `;
		if ($.isEmptyObject(this.prevMessage)) {
			return result;
		} else if (is_date_change(dateObj, this.prevMessage.creation)) {
			return result;
		} else {
			return "";
		}
	}

	getMessageStatusIcon(status, type) {
		if (type !== "Outgoing") return "";

		const statusMap = {
			draft: `<svg class="waba-msg-status waba-status-draft" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
			sent: `<svg class="waba-msg-status waba-status-sent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2"><path d="M20 6L9 17L4 12"/></svg>`,
			delivered: `<svg class="waba-msg-status waba-status-delivered" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#8696A0" stroke-width="2"><path d="M20 6L9 17L4 12"/><path d="M26 6L15 17L10 12"/></svg>`,
			read: `<svg class="waba-msg-status waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2"><path d="M20 6L9 17L4 12"/><path d="M26 6L15 17L10 12"/></svg>`,
			failed: `<svg class="waba-msg-status waba-status-failed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
			marked_as_read: `<svg class="waba-msg-status waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2"><path d="M20 6L9 17L4 12"/><path d="M26 6L15 17L10 12"/></svg>`,
		};

		return statusMap[status] || statusMap["sent"];
	}

	setup_actions() {
		this.$chat_actions = $(document.createElement("div"));
		this.$chat_actions.addClass("waba-chat-actions");
		const chat_actions_html = `
            <div class='waba-attach-button' title='${__("Attach file")}'>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        `;
		this.$chat_actions.html(chat_actions_html);
		this.$chat_space.append(this.$chat_actions);
	}

	show_reply_preview(message) {
		const $preview = $(".waba-reply-preview");
		const $sender = $(".waba-reply-preview-sender");
		const $text = $(".waba-reply-preview-text");

		let senderName = message.sender_user_no || message.from || "Unknown";
		if (senderName === this.profile.user_email) {
			senderName = __("You");
		} else if (message.profile_name) {
			senderName = message.profile_name;
		} else if (message.contact_name) {
			senderName = message.contact_name;
		}

		let replyText = "";
		switch (message.content_type) {
			case "image":
				replyText = "📷 " + __("Image");
				break;
			case "video":
				replyText = "🎥 " + __("Video");
				break;
			case "audio":
				replyText = "🎵 " + __("Audio");
				break;
			case "document":
				replyText = "📄 " + __("Document");
				break;
			case "location":
				replyText = "📍 " + __("Location");
				break;
			case "contact":
				replyText = "👤 " + __("Contact");
				break;
			case "reaction":
				replyText = "😊 " + __("Reaction");
				break;
			case "flow":
				replyText = "📋 " + __("Form");
				break;
			case "button":
				replyText = "🔘 " + __("Button");
				break;
			case "interactive":
				replyText = "💬 " + __("Interactive Message");
				break;
			case "template":
				replyText = "📨 " + __("Template Message");
				break;
			default:
				replyText = message.content || message.message || "";
				if (replyText.length > 80) replyText = replyText.substring(0, 80) + "...";
		}

		$sender.text(__("Replying to {0}", [senderName]));
		$text.text(replyText);
		$preview.show();
	}

	hide_reply_preview() {
		$(".waba-reply-preview").hide();
		$(".waba-reply-preview-sender").text("");
		$(".waba-reply-preview-text").text("");
		this.reply_to_message = null;
	}

	async handle_upload_file(file) {
		const me = this;
		return new Promise((resolve, reject) => {
			let xhr = new XMLHttpRequest();

			xhr.upload.addEventListener("load", () => {
				resolve();
			});
			xhr.addEventListener("error", () => {
				reject(frappe.throw(__("Internal Server Error")));
			});

			xhr.onreadystatechange = () => {
				if (xhr.readyState == XMLHttpRequest.DONE) {
					if (xhr.status === 200) {
						let r = null;
						let file_doc = null;
						try {
							r = JSON.parse(xhr.responseText);
							if (r.message.doctype === "File") file_doc = r.message;
						} catch (e) {
							r = xhr.responseText;
						}
						try {
							if (file_doc === null) reject(frappe.throw(__("File upload failed!")));
							me.handle_send_message(file_doc.file_url);
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
			form_data.append("docname", this.profile.room);
			form_data.append("optimize", true);
			xhr.send(form_data);
		});
	}

	show_file_preview(file) {
		const $preview = $(".waba-file-preview");
		const $previewName = $(".waba-file-preview-name");
		const maxNameLength = 30;
		let fileName = file.name;
		if (fileName.length > maxNameLength)
			fileName = fileName.substring(0, maxNameLength) + "...";
		$previewName.text(fileName);
		$preview.show();
	}

	hide_file_preview() {
		$(".waba-file-preview").hide();
		$(".waba-file-preview-name").text("");
		this.file = null;
		$("#waba-file-uploader").val("");
	}

	dismiss_all_popups() {
		$(".waba-msg-action-popup").remove();
		$(".waba-reaction-picker-popup").hide();
	}

	show_message_action_popup($row, messageId) {
		const me = this;
		this.dismiss_all_popups();

		const isSent = $row.hasClass("waba-message-sent");
		const $bubble = $row
			.find(".waba-message-bubble-sent, .waba-message-bubble-received")
			.first();

		const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

		const popup = $(`
            <div class="waba-msg-action-popup" style="
                position: absolute;
                ${isSent ? "right: 0;" : "left: 0;"}
                bottom: calc(100% + 8px);
                z-index: 300;
                display: flex;
                flex-direction: column;
                align-items: ${isSent ? "flex-end" : "flex-start"};
                gap: 6px;
                pointer-events: auto;
            ">
                <div class="waba-emoji-strip" style="
                    background: var(--wa-bg-sidebar, #fff);
                    border-radius: 24px;
                    padding: 6px 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.18);
                    display: flex;
                    gap: 4px;
                    align-items: center;
                ">
                    ${EMOJIS.map(
						(e) => `
                        <span class="waba-quick-emoji" data-emoji="${e}" style="
                            font-size: 22px;
                            cursor: pointer;
                            padding: 4px;
                            border-radius: 50%;
                            display: inline-block;
                            transition: transform 0.12s;
                        ">${e}</span>
                    `,
					).join("")}
                </div>
                <div class="waba-action-buttons" style="
                    background: var(--wa-bg-sidebar, #fff);
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    overflow: hidden;
                    min-width: 140px;
                ">
                    <div class="waba-action-reply" style="
                        padding: 10px 16px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 13px;
                        color: var(--wa-text-primary, #111b21);
                        transition: background 0.1s;
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 17 4 12 9 7"/>
                            <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                        </svg>
                        ${__("Reply")}
                    </div>
                </div>
            </div>
        `);

		popup
			.find(".waba-quick-emoji")
			.on("mouseenter", function () {
				$(this).css("transform", "scale(1.3)");
			})
			.on("mouseleave", function () {
				$(this).css("transform", "scale(1)");
			});

		popup.find(".waba-quick-emoji").on("click", function (e) {
			e.stopPropagation();
			const emoji = $(this).data("emoji");
			me.dismiss_all_popups();
			me.sendReaction(messageId, emoji);
		});

		popup
			.find(".waba-action-reply")
			.on("mouseenter", function () {
				$(this).css("background", "var(--wa-hover, #f5f6f6)");
			})
			.on("mouseleave", function () {
				$(this).css("background", "");
			});

		popup.find(".waba-action-reply").on("click", function (e) {
			e.stopPropagation();
			me.dismiss_all_popups();
			const fullMessage = me.messages_data?.find((msg) => msg.name === messageId);
			if (fullMessage) {
				me.reply_to_message = fullMessage;
				me.show_reply_preview(fullMessage);
				$(".waba-type-message").focus();
			}
		});

		$bubble.css("position", "relative").append(popup);
	}

	setup_events() {
		const me = this;

		$(".waba-chat-back-button").on("click", function () {
			me.stop_auto_refresh();
			me.destroy_socket_events();
			if (me.chat_list && me.chat_list.render_messages) me.chat_list.render_messages();
			if (me.chat_list && me.chat_list.render) me.chat_list.render();
		});

		$(".waba-fullscreen-chat-btn").on("click", function () {
			window.open("/whatsapp", "_blank");
		});

		$(".waba-send-button").on("click", function () {
			if (me.file) me.handle_upload_file(me.file);
			else me.handle_send_message();
		});

		$(".waba-type-message").keydown(function (e) {
			if (e.which === 13 && !e.shiftKey) {
				e.preventDefault();
				if (me.file) me.handle_upload_file(me.file);
				else me.handle_send_message();
			}
		});

		$(".waba-attach-button").on("click", function () {
			$("#waba-file-uploader").click();
		});

		$("#waba-file-uploader").on("change", function () {
			if (this.files.length > 0) {
				me.file = { file_obj: this.files[0], name: this.files[0].name };
				me.show_file_preview(me.file);
			}
		});

		$(".waba-file-preview-remove").on("click", function () {
			me.hide_file_preview();
		});
		$(".waba-reply-preview-remove").on("click", function () {
			me.hide_reply_preview();
		});

		$(".waba-chat-close-button")
			.off("click")
			.on("click", function (e) {
				e.stopPropagation();
				if (window.wabaChatBubble) window.wabaChatBubble.change_bubble();
			});

		this.$chat_space_container.on(
			"click",
			".waba-message-received, .waba-message-sent",
			function (e) {
				const $target = $(e.target);
				if (
					$target.closest(".waba-msg-action-popup").length ||
					$target.closest(".waba-reaction-bubble").length
				) {
					return;
				}

				const $row = $(this);
				const messageId = $row.data("message-id");
				if (!messageId) return;

				const existingPopup = $row.find(".waba-msg-action-popup");
				if (existingPopup.length) {
					me.dismiss_all_popups();
					return;
				}

				me.show_message_action_popup($row, messageId);
			},
		);

		$(document).on("click", function (e) {
			if (
				!$(e.target).closest(
					".waba-msg-action-popup, .waba-message-received, .waba-message-sent",
				).length
			) {
				me.dismiss_all_popups();
			}
		});

		$(".waba-type-message").on("keydown", function (e) {
			if (e.key === "Escape") {
				me.hide_reply_preview();
				me.dismiss_all_popups();
			}
		});
	}

	setup_socketio() {
		const me = this;
		this.received_message_ids = new Set();

		frappe.realtime.on(this.profile.room, function (res) {
			if (res.whatsapp_account === me.profile.whatsapp_account)
				me.handle_incoming_message(res);
		});

		frappe.realtime.on("latest_chat_updates", function (res) {
			if (
				res.room === me.profile.room &&
				res.whatsapp_account === me.profile.whatsapp_account
			) {
				me.handle_incoming_message(res);
			}
		});

		frappe.realtime.on("message_status_update", function (res) {
			if (
				res.room === me.profile.room &&
				res.whatsapp_account === me.profile.whatsapp_account
			) {
				me.update_message_status(res.message_id, res.status);
			}
		});
	}

	update_message_status(messageId, newStatus) {
		const $message = $(`.waba-message-sent[data-message-id="${messageId}"]`);
		if ($message.length) {
			const $statusIcon = $message.find(".waba-msg-status");
			const newIcon = this.getMessageStatusIcon(newStatus, "Outgoing");
			$statusIcon.replaceWith(newIcon);
		}
	}

	async handle_incoming_message(res) {
		const msg_id = res.name || `${res.content}-${res.creation}-${res.sender_user_no}`;
		if (this.received_message_ids.has(msg_id)) return;
		this.received_message_ids.add(msg_id);

		const replied_message = this.get_replied_message(res.reply_to_message);

		this.receive_message(res, get_time(res.creation), replied_message, res.reactions || null);
		await this.mark_all_unread_as_read();
	}

	destroy_socket_events() {
		frappe.realtime.off(this.profile.room);
		frappe.realtime.off("latest_chat_updates");
		frappe.realtime.off("message_status_update");
	}

	renderLocationMessage(locationData) {
		if (!locationData) return null;
		try {
			const location =
				typeof locationData === "string" ? JSON.parse(locationData) : locationData;
			const mapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
			return `
                <div class='waba-location-message' style='display: flex; align-items: flex-start; gap: 12px;'>
                    <span style='font-size: 24px;'>📍</span>
                    <div style='flex: 1;'>
                        <div style='font-weight: 500; margin-bottom: 4px;'>${__("Location")}</div>
                        <div style='font-size: 12px; color: var(--wa-text-secondary); margin-bottom: 8px;'>${location.name || ""}</div>
                        <a href='${mapsUrl}' target='_blank' style='color: var(--wa-primary); text-decoration: none; font-size: 12px;'>${__("View on Map")}</a>
                    </div>
                </div>
            `;
		} catch (e) {
			return `<div>${__("Location shared")}</div>`;
		}
	}

	renderContactMessage(contactData) {
		if (!contactData) return null;
		try {
			const contact =
				typeof contactData === "string" ? JSON.parse(contactData) : contactData;
			return `
                <div class='waba-contact-message' style='display: flex; align-items: flex-start; gap: 12px;'>
                    <span style='font-size: 24px;'>👤</span>
                    <div style='flex: 1;'>
                        <div style='font-weight: 500; margin-bottom: 4px;'>${contact.name || ""}</div>
                        ${contact.phones ? contact.phones.map((phone) => `<div style='font-size: 12px; color: var(--wa-text-secondary); margin-bottom: 4px;'>${phone.phone} ${phone.type ? `(${phone.type})` : ""}</div>`).join("") : ""}
                        ${contact.emails ? contact.emails.map((email) => `<div style='font-size: 12px; color: var(--wa-text-secondary);'>${email.email} ${email.type ? `(${email.type})` : ""}</div>`).join("") : ""}
                    </div>
                </div>
            `;
		} catch (e) {
			return `<div>${__("Contact shared")}</div>`;
		}
	}

	renderButtonMessage(buttonData) {
		if (!buttonData) return null;
		try {
			const buttons = typeof buttonData === "string" ? JSON.parse(buttonData) : buttonData;
			return `
                <div class='waba-buttons-message' style='margin-top: 8px;'>
                    ${buttons
						.map(
							(button) => `
                        <button class='waba-interactive-button' data-button-id='${button.id}' style='display: block; width: 100%; margin-top: 8px; padding: 8px 12px; background: var(--wa-primary-light); border: none; border-radius: 8px; color: var(--wa-primary); font-weight: 500; cursor: pointer; text-align: center; transition: all 0.2s;' onmouseover="this.style.background='var(--wa-primary-soft)'" onmouseout="this.style.background='var(--wa-primary-light)'">${button.text}</button>
                    `,
						)
						.join("")}
                </div>
            `;
		} catch (e) {
			return null;
		}
	}

	renderInteractiveMessage(interactiveData) {
		if (!interactiveData) return null;
		try {
			const interactive =
				typeof interactiveData === "string"
					? JSON.parse(interactiveData)
					: interactiveData;
			let html = `<div class='waba-interactive-message'>`;
			if (interactive.header)
				html += `<div style='font-weight: 600; margin-bottom: 8px;'>${interactive.header}</div>`;
			if (interactive.body)
				html += `<div style='margin-bottom: 12px;'>${interactive.body}</div>`;
			if (interactive.footer)
				html += `<div style='font-size: 11px; color: var(--wa-text-light); margin-bottom: 12px;'>${interactive.footer}</div>`;
			if (interactive.buttons && interactive.buttons.length) {
				html += `<div class='waba-interactive-buttons' style='margin-top: 8px;'>
                    ${interactive.buttons.map((button) => `<button class='waba-interactive-button' data-button-id='${button.id}' style='display: block; width: 100%; margin-top: 8px; padding: 8px 12px; background: var(--wa-primary-light); border: none; border-radius: 8px; color: var(--wa-primary); font-weight: 500; cursor: pointer; text-align: center;'>${button.text}</button>`).join("")}
                </div>`;
			}
			html += `</div>`;
			return html;
		} catch (e) {
			return null;
		}
	}

	build_reaction_bubbles_html(reactions, type) {
		if (!reactions || !Array.isArray(reactions) || reactions.length === 0) return "";

		const isSent = type === "recipient";
		let bubblesHtml = "";

		reactions.forEach((reaction) => {
			if (reaction && reaction.emoji) {
				const emoji = reaction.emoji;
				const count = reaction.count || 1;
				bubblesHtml += `
                    <div class="waba-reaction-bubble" style="
                        position: absolute;
                        bottom: -12px;
                        ${isSent ? "left: 8px;" : "right: 8px;"}
                        background: var(--wa-bg-sidebar, #fff);
                        border: 1px solid rgba(0,0,0,0.09);
                        border-radius: 20px;
                        padding: 1px 6px 1px 4px;
                        display: inline-flex;
                        align-items: center;
                        gap: 2px;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.13);
                        font-size: 14px;
                        z-index: 3;
                        cursor: default;
                        white-space: nowrap;
                        min-width: 28px;
                        justify-content: center;
                    ">
                        <span class="waba-reaction-bubble-emoji">${emoji}</span>
                        <span class="waba-reaction-bubble-count" data-count="${count}" style="font-size: 11px; color: var(--wa-text-secondary, #667781); line-height: 1;">${count > 1 ? count : ""}</span>
                    </div>
                `;
			}
		});

		return bubblesHtml;
	}

	make_message(
		content,
		time,
		type,
		name,
		caption,
		status,
		messageType,
		messageId,
		repliedMessage,
		replyToMessageId,
		contentType = "text",
		attach = null,
		locationData = null,
		contactData = null,
		buttonData = null,
		interactiveData = null,
		reactions = null,
		isTemplate = false,
		templateName = null,
	) {
		const message_class = type === "recipient" ? "waba-message-sent" : "waba-message-received";
		const bubble_class =
			type === "recipient" ? "waba-message-bubble-sent" : "waba-message-bubble-received";
		const $recipient_element = $(document.createElement("div")).addClass(message_class);

		if (messageId) $recipient_element.attr("data-message-id", messageId);
		if (replyToMessageId) $recipient_element.attr("data-reply-to", replyToMessageId);

		const $message_element = $(document.createElement("div")).addClass(bubble_class);
		$message_element.css("position", "relative");

		if (repliedMessage) {
			const $reply_indicator = $(document.createElement("div")).addClass(
				"waba-reply-indicator",
			);
			$reply_indicator.css({
				background: "var(--wa-bg-search)",
				borderRadius: "8px",
				padding: "6px 10px",
				marginBottom: "8px",
				borderLeft: "3px solid var(--wa-primary)",
				fontSize: "12px",
			});

			let replyContent = repliedMessage.content;
			if (repliedMessage.content_type !== "text") {
				const typeIcons = {
					image: "📷 " + __("Image"),
					video: "🎥 " + __("Video"),
					audio: "🎵 " + __("Audio"),
					document: "📄 " + __("Document"),
					location: "📍 " + __("Location"),
					contact: "👤 " + __("Contact"),
					reaction: "😊 " + __("Reaction"),
					flow: "📋 " + __("Form"),
					button: "🔘 " + __("Button"),
					interactive: "💬 " + __("Interactive Message"),
					template: "📨 " + __("Template Message"),
				};
				replyContent = typeIcons[repliedMessage.content_type] || replyContent;
			}

			$reply_indicator.html(`
                <div style="font-weight: 600; color: var(--wa-primary); margin-bottom: 2px; font-size: 11px;">${__("Replying to {0}", [repliedMessage.sender])}</div>
                <div style="color: var(--wa-text-secondary); word-break: break-word; font-size: 12px;">${replyContent}</div>
            `);
			$message_element.append($reply_indicator);
		}

		const $name_element = $(document.createElement("div"))
			.addClass("waba-message-name")
			.text(name);

		let $sanitized_content;

		switch (contentType) {
			case "template":
				$sanitized_content = $(document.createElement("div"));
				$sanitized_content.addClass("waba-template-content");
				if (content) {
					$sanitized_content.html(content);
					$sanitized_content.css({
						"font-size": "14px",
						"line-height": "1.5",
					});
					$sanitized_content.find("button, a").on("click", function (e) {
						e.stopPropagation();
						const url = $(this).attr("href");
						if (url && url !== "#") {
							window.open(url, "_blank");
						}
					});
				}
				break;
			case "image":
				$sanitized_content = $(document.createElement("div"));
				$sanitized_content.html(`
                    <img src='${attach || content}' class='waba-chat-image' style='max-width: 250px; max-height: 250px; border-radius: 12px; cursor: pointer;' onclick='window.open("${attach || content}", "_blank")'>
                    ${caption ? `<div class='waba-message-caption'>${__(caption)}</div>` : ""}
                `);
				$message_element.css({ padding: "0px", background: "inherit" });
				$name_element.css({ color: "var(--wa-text-light)", "padding-bottom": "4px" });
				break;
			case "video":
				$sanitized_content = $(document.createElement("div"));
				$sanitized_content.html(`
                    <video controls style='max-width: 250px; max-height: 250px; border-radius: 12px;'>
                        <source src='${attach || content}' type='video/mp4'>
                    </video>
                    ${caption ? `<div class='waba-message-caption'>${__(caption)}</div>` : ""}
                `);
				$message_element.css({ padding: "0px", background: "inherit" });
				break;
			case "audio":
				$sanitized_content = $(document.createElement("div"));
				$sanitized_content.html(`
                    <audio controls style='width: 200px;'>
                        <source src='${attach || content}'>
                    </audio>
                    ${caption ? `<div class='waba-message-caption'>${__(caption)}</div>` : ""}
                `);
				break;
			case "document":
				$sanitized_content = $(document.createElement("div"));
				const fileName = content?.split("/").pop() || __("Document");
				$sanitized_content.html(`
                    <div class='waba-file-message' style='display: flex; align-items: center; gap: 10px;'>
                        <span style='font-size: 24px;'>📄</span>
                        <div style='flex: 1;'>
                            <div style='font-weight: 500; margin-bottom: 2px;'>${__(fileName)}</div>
                            <a href='${attach || content}' target='_blank' style='color: var(--wa-primary); text-decoration: none; font-size: 12px;'>${__("Download")}</a>
                        </div>
                    </div>
                    ${caption ? `<div class='waba-message-caption'>${__(caption)}</div>` : ""}
                `);
				if (type === "recipient") $sanitized_content.css("color", "var(--wa-green-dark)");
				break;
			case "location":
				$sanitized_content = $(document.createElement("div"));
				$sanitized_content.html(this.renderLocationMessage(locationData || content));
				break;
			case "contact":
				$sanitized_content = $(document.createElement("div"));
				$sanitized_content.html(this.renderContactMessage(contactData || content));
				break;
			case "button":
				$sanitized_content = $(document.createElement("div"));
				$sanitized_content.html(
					`<div>${content || ""}</div>${this.renderButtonMessage(buttonData || content)}`,
				);
				break;
			case "interactive":
				$sanitized_content = $(document.createElement("div"));
				$sanitized_content.html(this.renderInteractiveMessage(interactiveData || content));
				break;
			case "flow":
				$sanitized_content = $(document.createElement("div"));
				let flowData = null;
				try {
					flowData = typeof content === "string" ? JSON.parse(content) : content;
				} catch (e) {
					flowData = null;
				}
				$sanitized_content.html(`
                    <div class='waba-flow-message' style='background: var(--wa-primary-light); border-radius: 12px; padding: 12px;'>
                        <div style='display: flex; align-items: center; gap: 10px; margin-bottom: 8px;'>
                            <span style='font-size: 20px;'>📋</span>
                            <div style='font-weight: 600;'>${flowData?.title || __("Form")}</div>
                        </div>
                        <div style='font-size: 13px; margin-bottom: 12px;'>${flowData?.description || content || __("Please fill out the form")}</div>
                        <button class='waba-flow-button' data-flow-token='${flowData?.token || ""}' style='width: 100%; padding: 8px; background: var(--wa-primary); border: none; border-radius: 8px; color: white; font-weight: 500; cursor: pointer;'>${__("Open Form")}</button>
                    </div>
                `);
				break;
			case "reaction":
				$sanitized_content = $(document.createElement("div"));
				let reactionData = null;
				try {
					reactionData = typeof content === "string" ? JSON.parse(content) : content;
				} catch (e) {
					reactionData = { emoji: "👍", message_id: content };
				}
				$sanitized_content.html(`
                    <div class='waba-reaction-message' style='display: flex; align-items: center; gap: 8px;'>
                        <span style='font-size: 24px;'>${reactionData?.emoji || "👍"}</span>
                        <span style='color: var(--wa-text-secondary);'>${__("Reacted to a message")}</span>
                    </div>
                `);
				break;
			default:
				const n = content?.lastIndexOf("/") || -1;
				const file_name = n > -1 ? content.substring(n + 1) : "";

				if (content?.startsWith("/files/") && file_name !== "") {
					let $url;
					if (is_image(file_name)) {
						$url = $(document.createElement("img"));
						$url.attr({ src: content }).addClass("waba-chat-image");
						$message_element.css({ padding: "0px", background: "inherit" });
						$name_element.css({
							color: "var(--wa-text-light)",
							"padding-bottom": "4px",
						});
					} else {
						$url = $(document.createElement("div"));
						const fileIcon = this.get_file_icon(file_name);
						$url.html(`
                            <div class='waba-file-message' style='display: flex; align-items: center; gap: 10px;'>
                                <span style='font-size: 24px;'>${fileIcon}</span>
                                <div style='flex: 1;'>
                                    <div style='font-weight: 500; margin-bottom: 2px;'>${__(file_name)}</div>
                                    <a href='${content}' target='_blank' style='color: var(--wa-primary); text-decoration: none; font-size: 12px;'>${__("Download")}</a>
                                </div>
                            </div>
                        `);
						if (type === "recipient") $url.css("color", "var(--wa-green-dark)");
					}
					$sanitized_content = $url;
				} else {
					$sanitized_content = __(
						$("<div>")
							.text(content || "")
							.html(),
					);
				}
				break;
		}

		if (type === "sender" && this.profile.room_type === "Group") {
			$message_element.append($name_element);
		}
		$message_element.append($sanitized_content);

		const statusIcon = this.getMessageStatusIcon(status, messageType);
		$message_element.append(`
            <div class="waba-message-meta" style="display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 3px;">
                <span style="font-size: 11px; color: var(--wa-text-light);">${__(time)}</span>
                ${statusIcon}
            </div>
        `);

		const reactionsHtml = this.build_reaction_bubbles_html(reactions, type);
		if (reactionsHtml) {
			$message_element.append(reactionsHtml);
		}

		$recipient_element.append($message_element);

		if (reactions && reactions.length > 0) {
			$recipient_element.css("margin-bottom", "14px");
		}

		return $recipient_element;
	}

	receive_message(res, time, repliedMessage, reactions) {
		let chat_type = "sender";
		if (res.sender_user_no === "Administrator" || res.sender_user_no === this.profile.user)
			return;

		if (
			this.profile.is_admin === true &&
			$(".waba-chat-element").is(":visible") &&
			frappe.Chat.settings.user.enable_message_tone === 1
		) {
			frappe.utils.play_sound("chat-message-receive");
		}

		if (this.profile.room_type === "Guest") {
			if (this.profile.is_admin === true && res.user !== "Guest") {
				chat_type = "recipient";
			}
		}

		this.$chat_space_container.append(
			this.make_message(
				res.content,
				time,
				chat_type,
				res.user || res.sender_user_no,
				res.caption,
				res.status,
				res.type,
				res.name,
				repliedMessage,
				res.reply_to_message,
				res.content_type,
				res.attach,
				res.location_data,
				res.contact_data,
				res.button_data,
				res.interactive_data,
				reactions,
				res.is_template || false,
				res.template_name || null,
			),
		);
		scroll_to_bottom(this.$chat_space_container);
	}

	async sendReaction(messageId, emoji) {
		const reactionMessageId = Date.now().toString();

		this.$chat_space_container.append(
			this.make_message(
				emoji,
				get_time(),
				"recipient",
				this.profile.user,
				null,
				"sent",
				"Outgoing",
				reactionMessageId,
				null,
				messageId,
				"reaction",
				null,
				null,
				null,
				null,
				null,
				null,
			),
		);

		scroll_to_bottom(this.$chat_space_container);

		send_message(
			emoji,
			this.profile.user,
			this.profile.room,
			this.profile.user_email,
			null,
			reactionMessageId,
			this.profile.whatsapp_account,
			messageId,
			"reaction",
		);
	}

	get_file_icon(filename) {
		const ext = filename.split(".").pop().toLowerCase();
		const icons = {
			pdf: "📄",
			doc: "📘",
			docx: "📘",
			xls: "📊",
			xlsx: "📊",
			ppt: "📽️",
			pptx: "📽️",
			zip: "🗜️",
			rar: "🗜️",
			txt: "📝",
			mp3: "🎵",
			mp4: "🎬",
			avi: "🎬",
			mov: "🎬",
		};
		return icons[ext] || "📎";
	}

	handle_send_message(attachment) {
		const $type_message = $(".waba-type-message");
		let content = null;

		if (attachment) {
			content = attachment;
		} else {
			content = $type_message.val();
		}

		if ((!content || content.trim().length === 0) && !attachment) return;

		if (
			this.profile.is_admin === true &&
			frappe.Chat.settings.user.enable_message_tone === 1
		) {
			frappe.utils.play_sound("chat-message-send");
		}

		const messageId = Date.now().toString();
		const tempStatus = "sent";
		const replyToMessageId = this.reply_to_message ? this.reply_to_message.name : null;
		const repliedMessage = this.reply_to_message
			? this.get_replied_message(this.reply_to_message.name)
			: null;

		if (content && content.trim().length > 0) {
			this.$chat_space_container.append(
				this.make_message(
					content,
					get_time(),
					"recipient",
					this.profile.user,
					null,
					tempStatus,
					"Outgoing",
					messageId,
					repliedMessage,
					replyToMessageId,
					"text",
					null,
					null,
					null,
					null,
					null,
					null,
				),
			);
			$type_message.val("");
		}

		scroll_to_bottom(this.$chat_space_container);
		send_message(
			content,
			this.profile.user,
			this.profile.room,
			this.profile.user_email,
			attachment,
			messageId,
			this.profile.whatsapp_account,
			replyToMessageId,
		);

		if (attachment) this.hide_file_preview();
		this.hide_reply_preview();
	}

	start_auto_refresh() {
		this.refresh_interval = setInterval(() => {
			this.refresh_space();
		}, 5000);
	}

	stop_auto_refresh() {
		if (this.refresh_interval) {
			clearInterval(this.refresh_interval);
			this.refresh_interval = null;
		}
	}

	async refresh_space() {
		if (this.is_refreshing) return;
		this.is_refreshing = true;

		try {
			const current_scroll_position = this.$chat_space_container.scrollTop();
			const was_at_bottom =
				this.$chat_space_container[0].scrollHeight - current_scroll_position <=
				this.$chat_space_container.height() + 50;

			const messages = await get_messages(
				this.profile.room,
				this.profile.user_email,
				this.profile.whatsapp_account,
			);

			if (messages && messages.length > 0) {
				const new_message_count = messages.length;
				if (new_message_count !== this.last_message_count) {
					const old_scroll_height = this.$chat_space_container[0].scrollHeight;
					this.make_messages_html(messages);
					this.$chat_space_container.html(this.message_html);
					const new_scroll_height = this.$chat_space_container[0].scrollHeight;

					if (was_at_bottom) {
						scroll_to_bottom(this.$chat_space_container);
					} else if (new_message_count > this.last_message_count) {
						const height_diff = new_scroll_height - old_scroll_height;
						this.$chat_space_container.scrollTop(
							current_scroll_position + height_diff,
						);
					}

					this.last_message_count = new_message_count;
					await this.mark_all_unread_as_read();
				}
			}
		} catch (error) {
		} finally {
			this.is_refreshing = false;
		}
	}

	render() {
		this.$wrapper.html(this.$chat_space);
		this.setup_events();
		scroll_to_bottom(this.$chat_space_container);
	}
}
