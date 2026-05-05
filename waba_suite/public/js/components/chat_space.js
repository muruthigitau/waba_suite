import {
	get_avatar_html,
	get_date_from_now,
	get_messages,
	get_time,
	is_date_change,
	is_image,
	mark_message_read,
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
		this.setup();
	}

	setup() {
		this.$chat_space = $(document.createElement("div"));
		this.typing = false;
		this.$chat_space.addClass("chat-space");
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
		const header_html = `
			<div class='chat-header'>
				${
					this.profile.is_admin === true
						? `<span class='chat-back-button' title='${__("Go Back")}' >
								${frappe.utils.icon("left")}
							</span>`
						: ``
				}
				${this.avatar_html}
				<div class='chat-profile-info'>
					<div class='chat-profile-name'>
					${__(this.profile.room_name)}
					<div class='online-circle'></div>
					</div>
					<div class='chat-profile-status'>${__("Typing...")}</div>
				</div>
			</div>
		`;
		this.$chat_space.append(header_html);
	}

	async fetch_and_setup_messages() {
		try {
			const res = await get_messages(this.profile.room, this.profile.user_email);
			this.setup_messages(res);
			this.setup_actions();
			this.render();
			mark_message_read(this.profile.room);
		} catch (error) {
			frappe.msgprint({
				title: __("Error"),
				message: __("Something went wrong. Please refresh and try again."),
			});
		}
	}

	setup_messages(messages_list) {
		this.$chat_space_container = $(document.createElement("div"));
		this.$chat_space_container.addClass("chat-space-container");

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
				element.sender,
				element.caption,
			).prop("outerHTML");

			this.prevMessage = element;
		});
	}

	make_date_line_html(dateObj) {
		let result = `
			<div class='date-line'>
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

	setup_actions() {
		this.$chat_actions = $(document.createElement("div"));
		this.$chat_actions.addClass("chat-space-actions");
		const chat_actions_html = `
			<span class='open-attach-items'>
				${frappe.utils.icon("attachment", "lg")}
			</span>
			<input type='file' id='chat-file-uploader'
				accept='image/*, application/pdf, .doc, .docx'
				style='display: none;'
			>
			<input class='form-control type-message'
				type='search'
				placeholder='${__("Type message")}'
			>
			<div>
				<span class='message-send-button'>
					<svg xmlns="http://www.w3.org/2000/svg" width="1.2rem" height="1.2rem" viewBox="0 0 24 24" fill="#075E54">
						<path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.45-4.45-9.9-9.91-9.9zm0 18.23c-1.5 0-2.97-.4-4.26-1.15l-.31-.18-3.11.82.83-3.04-.2-.32c-.81-1.32-1.24-2.84-1.24-4.39 0-4.56 3.71-8.27 8.28-8.27 4.56 0 8.27 3.71 8.27 8.27.01 4.56-3.7 8.26-8.26 8.26zm4.53-6.18c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.24-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.12-1.06-.39-2.02-1.25-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.76-1.85-.2-.49-.41-.43-.56-.43-.15 0-.32-.01-.49-.01-.17 0-.45.06-.68.31-.23.25-.88.86-.88 2.11 0 1.25.91 2.45 1.04 2.62.13.17 1.76 2.7 4.28 3.76.6.25 1.08.4 1.45.51.61.19 1.17.17 1.61.1.49-.06 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29z"/>
					</svg>
				</span>
			</div>
		`;
		this.$chat_actions.html(chat_actions_html);
		this.$chat_space.append(this.$chat_actions);
	}

	async handle_upload_file(file) {
		const dataurl = await frappe.dom.file_to_base64(file.file_obj);
		file.dataurl = dataurl;
		file.name = file.file_obj.name;
		return this.upload_file(file);
	}

	upload_file(file) {
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
						} catch (error) {}
					} else {
						try {
							const error = JSON.parse(xhr.responseText);
							const messages = JSON.parse(error._server_messages);
							const errorObj = JSON.parse(messages[0]);
							reject(frappe.throw(__(errorObj.message)));
						} catch (e) {}
					}
				}
			};

			xhr.open("POST", "/api/method/upload_file", true);
			xhr.setRequestHeader("Accept", "application/json");
			xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);

			let form_data = new FormData();

			form_data.append("file", file.file_obj, file.name);
			form_data.append("is_private", +false);

			form_data.append("doctype", "WhatsApp Contact");
			form_data.append("docname", this.profile.room);
			form_data.append("optimize", +true);
			xhr.send(form_data);
		});
	}

	setup_events() {
		const me = this;

		me.typing_timeout = () => {
			me.typing = false;
		};

		$(".chat-back-button").on("click", function () {
			me.stop_auto_refresh();
			me.destroy_socket_events();
			me.chat_list.render_messages();
			me.chat_list.render();
		});

		$(".open-attach-items").on("click", function () {
			$("#chat-file-uploader").click();
		});

		$("#chat-file-uploader").on("change", function () {
			if (this.files.length > 0) {
				me.file = {};
				me.file.file_obj = this.files[0];
				me.handle_upload_file(me.file);
				me.file = null;
			}
		});

		$(".message-send-button").on("click", function () {
			me.handle_send_message();
		});

		$(".type-message").keydown(function (e) {
			if (e.which === 13) {
				me.handle_send_message();
			}
		});
	}

	setup_socketio() {
		const me = this;
		this.received_message_ids = new Set();

		frappe.realtime.on(this.profile.room, function (res) {
			me.handle_incoming_message(res);
		});

		frappe.realtime.on("latest_chat_updates", function (res) {
			if (res.room === me.profile.room) {
				me.handle_incoming_message(res);
			}
		});
	}

	handle_incoming_message(res) {
		const msg_id = res.name || `${res.content}-${res.creation}-${res.sender_user_no}`;

		if (this.received_message_ids.has(msg_id)) {
			return;
		}
		this.received_message_ids.add(msg_id);

		this.receive_message(res, get_time(res.creation));

		mark_message_read(this.profile.room);
	}

	destroy_socket_events() {
		frappe.realtime.off(this.profile.room);
		frappe.realtime.off("latest_chat_updates");
	}

	get_typing_changes(res) {
		if (res.user != this.profile.user_email) {
			if (
				(this.profile.is_admin === true && res.is_guest === "true") ||
				this.profile.is_admin === false ||
				this.profile.room_type === "Group" ||
				this.profile.room_type === "Direct"
			) {
				if (res.is_typing === "false") {
					$(".chat-profile-status").css("visibility", "hidden");
				} else {
					$(".chat-profile-status").css("visibility", "visible");
					const timeout = setTimeout(() => {
						$(".chat-profile-status").css("visibility", "hidden");
					}, 3000);
				}
			}
		}
	}

	make_message(content, time, type, name, caption) {
		const message_class = type === "recipient" ? "recipient-message" : "sender-message";
		const $recipient_element = $(document.createElement("div")).addClass(message_class);
		const $message_element = $(document.createElement("div")).addClass("message-bubble");

		const $name_element = $(document.createElement("div")).addClass("message-name").text(name);

		const n = content.lastIndexOf("/");
		const file_name = content.substring(n + 1) || "";
		let $sanitized_content;

		if (content.startsWith("/files/") && file_name !== "") {
			let $url;
			if (is_image(file_name)) {
				$url = $(document.createElement("img"));
				$url.attr({ src: content }).addClass("img-responsive chat-image");
				$message_element.css({ padding: "0px", background: "inherit" });
				$name_element.css({
					color: "var(--text-muted)",
					"padding-bottom": "var(--padding-xs)",
				});
			} else {
				$url = $(document.createElement("a"));
				$url.attr({ href: content, target: "_blank" }).text(__(file_name));

				if (type === "sender") {
					$url.css("color", "var(--cyan-100)");
				}
			}
			$sanitized_content = $url;
		} else {
			$sanitized_content = __($("<div>").text(content).html());
		}

		if (type === "sender" && this.profile.room_type === "Group") {
			$message_element.append($name_element);
		}
		$message_element.append($sanitized_content);

		if (caption) {
			const $caption_element = $(document.createElement("div"))
				.addClass("message-caption")
				.css({
					padding: "var(--padding-sm)",
					"font-size": "var(--text-sm)",
					color: type === "sender" ? "var(--white)" : "var(--text-color)",
					background: type === "sender" ? "var(--primary-color)" : "var(--control-bg)",
					"border-radius": "0 0 13px 13px",
				})
				.text(caption);
			$message_element.append($caption_element);
		}

		$recipient_element.append($message_element);
		$recipient_element.append(`<div class='message-time'>${__(time)}</div>`);

		return $recipient_element;
	}

	handle_send_message(attachment) {
		const $type_message = $(".type-message");
		let content = null;

		if (attachment) {
			content = attachment;
		} else {
			content = $type_message.val();
		}

		if (content.length === 0) {
			return;
		}
		this.typing = false;
		if (this.timeout) {
			clearTimeout(this.timeout);
		}

		if (
			this.profile.is_admin === true &&
			frappe.Chat.settings.user.enable_message_tone === 1
		) {
			frappe.utils.play_sound("chat-message-send");
		}

		this.$chat_space_container.append(
			this.make_message(content, get_time(), "recipient", this.profile.user),
		);
		$type_message.val("");
		scroll_to_bottom(this.$chat_space_container);
		send_message(
			content,
			this.profile.user,
			this.profile.room,
			this.profile.user_email,
			attachment,
		);
	}

	receive_message(res, time) {
		let chat_type = "sender";
		if (res.sender_user_no === "Administrator" || res.sender_user_no === this.profile.user) {
			return;
		}

		if (
			this.profile.is_admin === true &&
			$(".chat-element").is(":visible") &&
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
			this.make_message(res.content, time, chat_type, res.user),
		);
		scroll_to_bottom(this.$chat_space_container);
	}

	start_auto_refresh() {
		this.refresh_interval = setInterval(() => {
			this.refresh_space();
		}, 3000);
	}

	stop_auto_refresh() {
		if (this.refresh_interval) {
			clearInterval(this.refresh_interval);
			this.refresh_interval = null;
		}
	}

	async refresh_space() {
		try {
			const current_scroll_position = this.$chat_space_container.scrollTop();
			const was_at_bottom =
				this.$chat_space_container[0].scrollHeight - current_scroll_position <=
				this.$chat_space_container.height() + 50;

			const messages = await get_messages(this.profile.room, this.profile.user_email);

			if (messages && messages.length > 0) {
				const last_existing_message = this.$chat_space_container
					.find(".message-bubble")
					.last();
				const last_new_message = messages[messages.length - 1];

				if (last_existing_message.length && last_new_message) {
					const existing_content = last_existing_message
						.closest(".recipient-message, .sender-message")
						.find(".message-bubble")
						.text();
					const new_content = last_new_message.content;

					if (existing_content !== new_content) {
						const current_message_count = this.$chat_space_container.find(
							".recipient-message, .sender-message",
						).length;

						if (messages.length > current_message_count) {
							const old_height = this.$chat_space_container[0].scrollHeight;
							this.make_messages_html(messages);
							this.$chat_space_container.html(this.message_html);
							const new_height = this.$chat_space_container[0].scrollHeight;

							if (was_at_bottom) {
								scroll_to_bottom(this.$chat_space_container);
							} else {
								const height_diff = new_height - old_height;
								this.$chat_space_container.scrollTop(
									current_scroll_position + height_diff,
								);
							}

							mark_message_read(this.profile.room);
						}
					}
				}
			}
		} catch (error) {
			console.error("Auto-refresh error:", error);
		}
	}

	render() {
		this.$wrapper.html(this.$chat_space);
		this.setup_events();
		scroll_to_bottom(this.$chat_space_container);
	}
}
