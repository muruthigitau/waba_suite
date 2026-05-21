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
			console.error("Error fetching messages:", error);
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
		} catch (error) {
			console.error("Error marking messages as read:", error);
		}
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

			this.message_html += this.make_message(
				element.content,
				get_time(element.creation),
				message_type,
				element.sender || element.sender_user_no,
				element.caption,
				element.status,
				element.type,
				element.name,
			).prop("outerHTML");

			this.prevMessage = element;
		});
	}

	make_date_line_html(dateObj) {
		let result = `
			<div class='waba-date-divider'>
				<span>
					${__(get_date_from_now(dateObj, "space"))}
				</span>
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
		if (type !== "Outgoing") {
			return "";
		}

		const statusMap = {
			draft: `<svg class="waba-msg-status waba-status-draft" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="8" x2="12" y2="12"/>
				<line x1="12" y1="16" x2="12.01" y2="16"/>
			</svg>`,
			sent: `<svg class="waba-msg-status waba-status-sent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2">
				<path d="M20 6L9 17L4 12"/>
			</svg>`,
			delivered: `<svg class="waba-msg-status waba-status-delivered" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#8696A0" stroke-width="2">
				<path d="M20 6L9 17L4 12"/>
				<path d="M26 6L15 17L10 12"/>
			</svg>`,
			read: `<svg class="waba-msg-status waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2">
				<path d="M20 6L9 17L4 12"/>
				<path d="M26 6L15 17L10 12"/>
			</svg>`,
			failed: `<svg class="waba-msg-status waba-status-failed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2">
				<circle cx="12" cy="12" r="10"/>
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>`,
			marked_as_read: `<svg class="waba-msg-status waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2">
				<path d="M20 6L9 17L4 12"/>
				<path d="M26 6L15 17L10 12"/>
			</svg>`,
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
				<input class='form-control waba-type-message' type='text' placeholder='${__("Type a message")}'>
				<div class='waba-file-preview' style='display: none; position: absolute; bottom: 100%; left: 0; right: 0; background: var(--wa-bg-sidebar); border-radius: 12px; margin-bottom: 8px; padding: 8px 12px; box-shadow: var(--wa-shadow-md); z-index: 10;'>
					<div class='waba-file-preview-content' style='display: flex; align-items: center; gap: 10px;'>
						<span class='waba-file-preview-icon'>📎</span>
						<span class='waba-file-preview-name' style='flex: 1; font-size: 13px; color: var(--wa-text-primary);'></span>
						<span class='waba-file-preview-remove' style='cursor: pointer; color: var(--wa-text-light);'>&times;</span>
					</div>
				</div>
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
							if (r.message.doctype === "File") {
								file_doc = r.message;
							}
						} catch (e) {
							r = xhr.responseText;
						}
						try {
							if (file_doc === null) {
								reject(frappe.throw(__("File upload failed!")));
							}
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
		if (fileName.length > maxNameLength) {
			fileName = fileName.substring(0, maxNameLength) + "...";
		}
		$previewName.text(fileName);
		$preview.show();
	}

	hide_file_preview() {
		$(".waba-file-preview").hide();
		$(".waba-file-preview-name").text("");
		this.file = null;
		$("#waba-file-uploader").val("");
	}

	setup_events() {
		const me = this;

		$(".waba-chat-back-button").on("click", function () {
			me.stop_auto_refresh();
			me.destroy_socket_events();
			if (me.chat_list && me.chat_list.render_messages) {
				me.chat_list.render_messages();
			}
			if (me.chat_list && me.chat_list.render) {
				me.chat_list.render();
			}
		});

		$(".waba-fullscreen-chat-btn").on("click", function () {
			window.open("/whatsapp", "_blank");
		});

		$(".waba-send-button").on("click", function () {
			if (me.file) {
				me.handle_upload_file(me.file);
			} else {
				me.handle_send_message();
			}
		});

		$(".waba-type-message").keydown(function (e) {
			if (e.which === 13 && !e.shiftKey) {
				e.preventDefault();
				if (me.file) {
					me.handle_upload_file(me.file);
				} else {
					me.handle_send_message();
				}
			}
		});

		$(".waba-attach-button").on("click", function () {
			$("#waba-file-uploader").click();
		});

		$("#waba-file-uploader").on("change", function () {
			if (this.files.length > 0) {
				me.file = {
					file_obj: this.files[0],
					name: this.files[0].name,
				};
				me.show_file_preview(me.file);
			}
		});

		$(".waba-file-preview-remove").on("click", function () {
			me.hide_file_preview();
		});

		$(".waba-chat-close-button")
			.off("click")
			.on("click", function (e) {
				e.stopPropagation();
				if (window.wabaChatBubble) {
					window.wabaChatBubble.change_bubble();
				}
			});
	}

	setup_socketio() {
		const me = this;
		this.received_message_ids = new Set();

		frappe.realtime.on(this.profile.room, function (res) {
			if (res.whatsapp_account === me.profile.whatsapp_account) {
				me.handle_incoming_message(res);
			}
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

		if (this.received_message_ids.has(msg_id)) {
			return;
		}
		this.received_message_ids.add(msg_id);

		this.receive_message(res, get_time(res.creation));

		await this.mark_all_unread_as_read();
	}

	destroy_socket_events() {
		frappe.realtime.off(this.profile.room);
		frappe.realtime.off("latest_chat_updates");
		frappe.realtime.off("message_status_update");
	}

	make_message(content, time, type, name, caption, status, messageType, messageId) {
		const message_class = type === "recipient" ? "waba-message-sent" : "waba-message-received";
		const bubble_class =
			type === "recipient" ? "waba-message-bubble-sent" : "waba-message-bubble-received";
		const $recipient_element = $(document.createElement("div")).addClass(message_class);

		if (messageId) {
			$recipient_element.attr("data-message-id", messageId);
		}

		const $message_element = $(document.createElement("div")).addClass(bubble_class);

		const $name_element = $(document.createElement("div"))
			.addClass("waba-message-name")
			.text(name);

		const n = content?.lastIndexOf("/") || -1;
		const file_name = n > -1 ? content.substring(n + 1) : "";
		let $sanitized_content;

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
				if (type === "recipient") {
					$url.css("color", "var(--wa-green-dark)");
				}
			}
			$sanitized_content = $url;
		} else {
			$sanitized_content = __(
				$("<div>")
					.text(content || "")
					.html(),
			);
		}

		if (type === "sender" && this.profile.room_type === "Group") {
			$message_element.append($name_element);
		}
		$message_element.append($sanitized_content);

		if (caption) {
			const $caption_element = $(document.createElement("div"))
				.addClass("waba-message-caption")
				.text(caption);
			$message_element.append($caption_element);
		}

		const statusIcon = this.getMessageStatusIcon(status, messageType);

		$recipient_element.append($message_element);
		$recipient_element.append(`
			<div class='waba-message-time'>
				${__(time)}
				${statusIcon}
			</div>
		`);

		return $recipient_element;
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

		if ((!content || content.trim().length === 0) && !attachment) {
			return;
		}

		if (
			this.profile.is_admin === true &&
			frappe.Chat.settings.user.enable_message_tone === 1
		) {
			frappe.utils.play_sound("chat-message-send");
		}

		const messageId = Date.now().toString();
		const tempStatus = "sent";

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
		);

		if (attachment) {
			this.hide_file_preview();
		}
	}

	receive_message(res, time) {
		let chat_type = "sender";
		if (res.sender_user_no === "Administrator" || res.sender_user_no === this.profile.user) {
			return;
		}

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
			),
		);
		scroll_to_bottom(this.$chat_space_container);
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
		if (this.is_refreshing) {
			return;
		}

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
			console.error("Auto-refresh error:", error);
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
