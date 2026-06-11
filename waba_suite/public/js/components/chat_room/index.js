import ChatSpace from "../chat_space";
import { get_avatar_html, get_date_from_now, mark_message_read } from "../chat_utils";
import LastMessageDisplay from "./last-message-display";

export default class ChatRoom {
	constructor(opts) {
		this.$wrapper = opts.$wrapper;
		this.$chat_rooms_container = opts.$chat_rooms_container;
		this.chat_list = opts.chat_list;
		this.profile = opts.element;
		this.$chat_room = null;
		this.chat_space = null;
		this.lastMessageDisplay = null;
		this.setup();
	}

	update_room_data(new_profile) {
		if (!new_profile) return;

		const old_unread_count = this.profile?.unread_incoming || 0;
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
		if (!this.$chat_room || !this.profile) return;

		this.$chat_room.empty();

		const avatar_html = get_avatar_html(
			this.profile.room_type,
			this.profile.opposite_person_email,
			this.profile.room_name,
		);

		const unread_count = this.profile.unread_incoming || 0;

		const display_name =
			this.profile.contact_name && this.profile.contact_name !== this.profile.mobile_no
				? `${this.profile.contact_name}`
				: this.profile.room_name;

		if (!this.lastMessageDisplay) {
			this.lastMessageDisplay = new LastMessageDisplay(this.profile);
		} else {
			this.lastMessageDisplay.updateProfile(this.profile);
		}

		const info_html = `
			<div class='waba-room-info'>
				<div class='waba-room-name'>
					<span class='waba-room-title'>${__(display_name)}</span>
					${unread_count > 0 ? `<div class='waba-unread-badge'>${unread_count > 9 ? "9+" : unread_count}</div>` : ""}
				</div>
				<div class='waba-last-message'>
					${this.lastMessageDisplay.render()}
				</div>
			</div>
		`;

		const date_html = `
			<div class='waba-room-date'>
				${__(get_date_from_now(this.profile.last_date || this.profile.modified, "room"))}
			</div>
		`;

		this.$chat_room.html(avatar_html + info_html + date_html);
	}

	setup() {
		if (!this.profile) {
			console.error("ChatRoom: profile is undefined");
			return;
		}

		this.$chat_room = $(document.createElement("div"));
		this.$chat_room.addClass("waba-chat-room");
		this.refresh_display();
	}

	set_as_read() {
		if (!this.profile) return;

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
		if (!this.lastMessageDisplay || !this.$chat_room) return;

		this.lastMessageDisplay.updateLastMessage(message, date, status, type);
		this.$chat_room.find(".waba-last-message").html(this.lastMessageDisplay.render());
		this.$chat_room.find(".waba-room-date").text(__(get_date_from_now(date, "room")));
	}

	set_as_unread(unreadCount) {
		if (!this.profile || !this.$chat_room) return;

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
		if (this.chat_space && this.chat_space.destroy) {
			this.chat_space.destroy();
		}
		this.chat_space = null;
	}

	render(mode) {
		if (!this.$chat_room || !this.$chat_rooms_container) return;

		if (mode == "append") {
			this.$chat_rooms_container.append(this.$chat_room);
		} else {
			this.$chat_rooms_container.prepend(this.$chat_room);
		}
		this.setup_events();
	}

	move_to_top() {
		if (this.$chat_room && this.$chat_rooms_container) {
			$(this.$chat_room).prependTo(this.$chat_rooms_container);
		}
	}

	setup_events() {
		const me = this;

		if (!this.$chat_room) return;

		this.$chat_room.off("click").on("click", function () {
			if (!me.profile) return;

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
