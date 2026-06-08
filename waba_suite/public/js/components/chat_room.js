import ChatSpace from "./chat_space";
import {
	get_avatar_html,
	get_date_from_now,
	get_message_display_text,
	mark_message_read,
} from "./chat_utils";

export default class ChatRoom {
	constructor(opts) {
		this.$wrapper = opts.$wrapper;
		this.$chat_rooms_container = opts.$chat_rooms_container;
		this.chat_list = opts.chat_list;
		this.profile = opts.element;
		this.$chat_room = null;
		this.chat_space = null;
		this.setup();
	}

	update_room_data(new_profile) {
		const old_unread_count = this.profile.unread_incoming || 0;
		const new_unread_count = new_profile.unread_incoming || 0;

		this.profile = { ...this.profile, ...new_profile };

		if (this.$chat_room) {
			this.refresh_display();

			const unread_diff = new_unread_count - old_unread_count;
			if (unread_diff !== 0 && this.chat_list) {
				this.chat_list.update_unread_count(null, this.profile.room, new_unread_count);
			}
		}
	}

	refresh_display() {
		this.$chat_room.empty();

		this.avatar_html = get_avatar_html(
			this.profile.room_type,
			this.profile.opposite_person_email,
			this.profile.room_name,
		);

		const messageInfo = get_message_display_text(this.profile.last_message);
		const last_message_text = this.sanitize_last_message(messageInfo.text);
		const last_message_status = messageInfo.status;
		const last_message_type = messageInfo.type;
		const last_message_date =
			messageInfo.date || this.profile.last_date || this.profile.modified;

		const status_icon = this.getMessageStatusIcon(last_message_type, last_message_status);
		const unread_count = this.profile.unread_incoming || 0;

		const display_name =
			this.profile.contact_name && this.profile.contact_name !== this.profile.mobile_no
				? `${this.profile.contact_name} (${this.profile.mobile_no})`
				: this.profile.room_name;

		const info_html = `
			<div class='waba-room-info'>
				<div class='waba-room-name'>
					<span class='waba-room-title'>${__(display_name)}</span>
					${unread_count > 0 ? `<div class='waba-unread-badge'>${unread_count > 9 ? "9+" : unread_count}</div>` : ""}
				</div>
				<div class='waba-last-message'>
					${status_icon}
					<span>${__(last_message_text) || __("No messages yet")}</span>
				</div>
			</div>
		`;

		const date_html = `
			<div class='waba-room-date'>
				${__(get_date_from_now(last_message_date, "room"))}
			</div>
		`;

		let inner_html = "";
		inner_html += this.avatar_html + info_html + date_html;
		this.$chat_room.html(inner_html);
	}

	getMessageStatusIcon(messageType, status) {
		if (messageType !== "Outgoing") {
			return "";
		}

		const statusMap = {
			draft: `<svg class="waba-status-icon waba-status-draft" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2">
		<circle cx="12" cy="12" r="10"/>
		<line x1="12" y1="8" x2="12" y2="12"/>
		<line x1="12" y1="16" x2="12.01" y2="16"/>
	</svg>`,
			sent: `<svg class="waba-status-icon waba-status-sent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2">
		<path d="M20 6L9 17L4 12"/>
	</svg>`,
			delivered: `<svg class="waba-status-icon waba-status-delivered" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#8696A0" stroke-width="2">
		<path d="M20 6L9 17L4 12"/>
		<path d="M26 6L15 17L10 12"/>
	</svg>`,
			read: `<svg class="waba-status-icon waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2">
		<path d="M20 6L9 17L4 12"/>
		<path d="M26 6L15 17L10 12"/>
	</svg>`,
			failed: `<svg class="waba-status-icon waba-status-failed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2">
		<circle cx="12" cy="12" r="10"/>
		<line x1="18" y1="6" x2="6" y2="18"/>
		<line x1="6" y1="6" x2="18" y2="18"/>
	</svg>`,
			marked_as_read: `<svg class="waba-status-icon waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2">
		<path d="M20 6L9 17L4 12"/>
		<path d="M26 6L15 17L10 12"/>
	</svg>`,
		};

		return statusMap[status] || statusMap["sent"];
	}

	sanitize_last_message(message) {
		if (!message) return "";
		let sanitize_last_message = $("<div>").text(message).html();
		if (sanitize_last_message) {
			if (sanitize_last_message.length > 30) {
				sanitize_last_message = sanitize_last_message.substring(0, 30) + "...";
			}
		}
		return sanitize_last_message || "";
	}

	setup() {
		this.$chat_room = $(document.createElement("div"));
		this.$chat_room.addClass("waba-chat-room");
		this.refresh_display();
	}

	set_as_read() {
		if (this.profile.is_read === 1) return;

		this.profile.is_read = 1;
		const old_unread = this.profile.unread_incoming || 0;
		this.profile.unread_incoming = 0;
		this.$chat_room.find(".waba-unread-badge").remove();

		if (this.chat_list && old_unread > 0) {
			this.chat_list.update_unread_count("decrement", this.profile.room, 0);
		}
	}

	set_last_message(message, date, status, type) {
		const messageContent =
			typeof message === "object" ? message.message || message.attach || "" : message;
		const sanitized_message = this.sanitize_last_message(messageContent);
		const status_icon = this.getMessageStatusIcon(type || "Outgoing", status || "sent");

		this.$chat_room.find(".waba-last-message").html(`
			${status_icon}
			<span>${__(sanitized_message)}</span>
		`);
		this.$chat_room.find(".waba-room-date").text(__(get_date_from_now(date, "room")));
	}

	set_as_unread(unreadCount) {
		if (this.profile.is_read) {
			this.profile.is_read = 0;
			const newUnreadCount = unreadCount || this.profile.unread_incoming + 1;
			const oldUnread = this.profile.unread_incoming || 0;
			this.profile.unread_incoming = newUnreadCount;

			if (this.chat_list) {
				const diff = newUnreadCount - oldUnread;
				if (diff > 0) {
					this.chat_list.update_unread_count(null, this.profile.room, newUnreadCount);
				}
			}

			const $nameDiv = this.$chat_room.find(".waba-room-name");
			const $existingBadge = $nameDiv.find(".waba-unread-badge");
			const displayCount = newUnreadCount > 9 ? "9+" : newUnreadCount;

			if ($existingBadge.length) {
				$existingBadge.text(displayCount);
			} else {
				$nameDiv.append(`<div class='waba-unread-badge'>${displayCount}</div>`);
			}
		}
	}

	destroy_chat_space() {
		if (this.chat_space && this.chat_space.destroy_socket_events) {
			this.chat_space.destroy_socket_events();
		}
		this.chat_space = null;
	}

	render(mode) {
		if (mode == "append") {
			this.$chat_rooms_container.append(this.$chat_room);
		} else {
			this.$chat_rooms_container.prepend(this.$chat_room);
		}
		this.setup_events();
	}

	move_to_top() {
		$(this.$chat_room).prependTo(this.$chat_rooms_container);
	}

	setup_events() {
		const me = this;

		this.$chat_room.on("click", function () {
			if (me.chat_space) {
				me.destroy_chat_space();
			}

			if (me.chat_list && me.chat_list.set_active_room) {
				me.chat_list.set_active_room(me.profile.room);
			}

			me.chat_space = new ChatSpace({
				$wrapper: me.$wrapper,
				chat_list: me.chat_list,
				profile: me.profile,
			});

			if (me.profile.is_read === 0) {
				mark_message_read(me.profile.room, me.profile.whatsapp_account);
				me.set_as_read();
			}
		});
	}
}
