import ChatSpace from "./chat_space";
import {
	get_avatar_html,
	get_date_from_now,
	get_time,
	mark_message_read,
	set_notification_count,
} from "./chat_utils";

export default class ChatRoom {
	constructor(opts) {
		this.$wrapper = opts.$wrapper;
		this.$chat_rooms_container = opts.$chat_rooms_container;
		this.chat_list = opts.chat_list;
		this.profile = opts.element;
		this.setup();
		if (!this.profile.is_read) {
			set_notification_count("increment");
		}
	}

	setup() {
		this.$chat_room = $(document.createElement("div"));
		this.$chat_room.addClass("waba-chat-room");

		this.avatar_html = get_avatar_html(
			this.profile.room_type,
			this.profile.opposite_person_email,
			this.profile.room_name,
		);

		let last_message = this.sanitize_last_message(this.profile.last_message);

		const info_html = `
      <div class='waba-room-info'>
        <div class='waba-room-name'>
          ${__(this.profile.room_name)}
          ${!this.profile.is_read ? `<div class='waba-unread-badge'></div>` : ""}
        </div>
        <div class='waba-last-message'>${__(last_message)}</div>
      </div>
    `;
		const date_html = `
      <div class='waba-room-date'>
        ${__(get_date_from_now(this.profile.last_date, "room"))}
      </div>
    `;
		let inner_html = "";

		inner_html += this.avatar_html + info_html + date_html;

		this.$chat_room.html(inner_html);
	}

	sanitize_last_message(message) {
		let sanitize_last_message = $("<div>").text(message).html();
		if (sanitize_last_message) {
			if (sanitize_last_message.length > 30) {
				sanitize_last_message = sanitize_last_message.substring(0, 30) + "...";
			}
		}
		return sanitize_last_message;
	}

	set_as_read() {
		this.profile.is_read = 1;
		this.$chat_room.find(".waba-unread-badge").remove();
		set_notification_count("decrement");
	}

	set_last_message(message, date) {
		const sanitized_message = this.sanitize_last_message(message);
		this.$chat_room.find(".waba-last-message").html(__(sanitized_message));
		this.$chat_room.find(".waba-room-date").text(__(get_time(date)));
	}

	set_as_unread() {
		if (this.profile.is_read) {
			set_notification_count("increment");
		}
		this.profile.is_read = 0;
		const $nameDiv = this.$chat_room.find(".waba-room-name");
		if (!$nameDiv.find(".waba-unread-badge").length) {
			$nameDiv.append(`<div class='waba-unread-badge'></div>`);
		}
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
		this.$chat_room.on("click", () => {
			if (typeof this.chat_space !== "undefined") {
				this.chat_space.destroy_socket_events();
			}
			this.chat_space = new ChatSpace({
				$wrapper: this.$wrapper,
				chat_list: this.chat_list,
				profile: this.profile,
			});
			if (this.profile.is_read === 0) {
				mark_message_read(this.profile.room);
				this.set_as_read();
			}
		});
	}
}
