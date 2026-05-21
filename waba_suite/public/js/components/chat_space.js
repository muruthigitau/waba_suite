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
	set_typing,
} from "./chat_utils";

export default class ChatSpace {
	constructor(opts) {
		this.chat_list = opts.chat_list;
		this.$wrapper = opts.$wrapper;
		this.profile = opts.profile;
		this.file = null;
		this.refresh_interval = null;
		this.typing_timeout = null;
		this.setup();
	}

	setup() {
		this.$chat_space = $(document.createElement("div"));
		this.typing = false;
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
		const header_html = `
			<div class='waba-chat-header'>
				<span class='waba-chat-back-button' title='${__("Go Back")}'>
					${frappe.utils.icon("left")}
				</span>
				${this.avatar_html}
				<div class='waba-chat-profile-info'>
					<div class='waba-chat-profile-name'>
						${__(this.profile.room_name)}
						<div class='waba-online-circle'></div>
					</div>
					<div class='waba-chat-profile-status'>${__("Typing...")}</div>
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

	setup_actions() {
		this.$chat_actions = $(document.createElement("div"));
		this.$chat_actions.addClass("waba-chat-actions");
		const chat_actions_html = `
			<input class='form-control waba-type-message' type='text' placeholder='${__("Type a message")}'>
			<div class='waba-send-button'>
				<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
					<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
				</svg>
			</div>
		`;
		this.$chat_actions.html(chat_actions_html);
		this.$chat_space.append(this.$chat_actions);
	}

	setup_events() {
		const me = this;

		me.typing_timeout = null;

		$(".waba-chat-back-button").on("click", function () {
			me.stop_auto_refresh();
			me.destroy_socket_events();
			me.chat_list.render_messages();
			me.chat_list.render();
		});

		$(".waba-fullscreen-chat-btn").on("click", function () {
			window.open("/whatsapp", "_blank");
		});

		$(".waba-send-button").on("click", function () {
			me.handle_send_message();
		});

		$(".waba-type-message").keydown(function (e) {
			if (e.which === 13 && !e.shiftKey) {
				e.preventDefault();
				me.handle_send_message();
			}
		});

		$(".waba-type-message").on("input", function () {
			if (!me.typing) {
				me.typing = true;
				set_typing(me.profile.room, me.profile.user_email, true, false);
			}
			if (me.typing_timeout) clearTimeout(me.typing_timeout);
			me.typing_timeout = setTimeout(() => {
				if (me.typing) {
					me.typing = false;
					set_typing(me.profile.room, me.profile.user_email, false, false);
				}
			}, 2000);
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

	make_message(content, time, type, name, caption) {
		const message_class = type === "recipient" ? "waba-message-sent" : "waba-message-received";
		const bubble_class =
			type === "recipient" ? "waba-message-bubble-sent" : "waba-message-bubble-received";
		const $recipient_element = $(document.createElement("div")).addClass(message_class);
		const $message_element = $(document.createElement("div")).addClass(bubble_class);

		const $name_element = $(document.createElement("div"))
			.addClass("waba-message-name")
			.text(name);

		const n = content.lastIndexOf("/");
		const file_name = content.substring(n + 1) || "";
		let $sanitized_content;

		if (content.startsWith("/files/") && file_name !== "") {
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
				$url = $(document.createElement("a"));
				$url.attr({ href: content, target: "_blank" }).text(__(file_name));
				if (type === "recipient") {
					$url.css("color", "var(--wa-green-dark)");
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
				.addClass("waba-message-caption")
				.text(caption);
			$message_element.append($caption_element);
		}

		$recipient_element.append($message_element);
		$recipient_element.append(`<div class='waba-message-time'>${__(time)}</div>`);

		return $recipient_element;
	}

	handle_send_message(attachment) {
		const $type_message = $(".waba-type-message");
		let content = null;

		if (attachment) {
			content = attachment;
		} else {
			content = $type_message.val();
		}

		if (!content || content.trim().length === 0) {
			return;
		}

		this.typing = false;
		if (this.typing_timeout) {
			clearTimeout(this.typing_timeout);
			set_typing(this.profile.room, this.profile.user_email, false, false);
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
						.closest(".waba-message-sent, .waba-message-received")
						.find(".waba-message-bubble-sent, .waba-message-bubble-received")
						.text();
					const new_content = last_new_message.content;

					if (existing_content !== new_content) {
						const current_message_count = this.$chat_space_container.find(
							".waba-message-sent, .waba-message-received",
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
