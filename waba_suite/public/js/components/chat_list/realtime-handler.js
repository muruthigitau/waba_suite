import { account_name } from "../chat_utils.js";

export class RealtimeHandler {
	constructor(chatList, roomManager) {
		this.chatList = chatList;
		this.roomManager = roomManager;
	}

	setup() {
		frappe.realtime.on("latest_chat_updates", this.handleLatestChat.bind(this));
		frappe.realtime.on("new_room_creation", this.handleNewRoom.bind(this));
		frappe.realtime.on("private_room_creation", this.handlePrivateRoom.bind(this));
	}

	handleLatestChat(res) {
		if (!this.shouldProcess(res)) return;

		const room = this.roomManager.getRoom(res.room);
		if (!room) {
			this.refreshRooms();
			return;
		}

		this.playNotificationSound();
		this.showAlert(res, room);
		this.updateRoom(res, room);
	}

	handleNewRoom(res) {
		if (!this.shouldProcess(res)) return;
		this.playNotificationSound();
		if (res) {
			res.user = this.chatList.user;
			this.roomManager.addRoom(res);
		}
	}

	handlePrivateRoom(res) {
		if (!this.shouldProcess(res)) return;

		if (this.shouldShowNotification()) {
			this.playNotificationSound();
		}

		if (res.members?.includes(this.chatList.user_email)) {
			this.processPrivateRoom(res);
		}
	}

	shouldProcess(res) {
		return (
			this.chatList.whatsapp_account &&
			res.whatsapp_account === this.chatList.whatsapp_account
		);
	}

	shouldShowNotification() {
		return (
			!$(".waba-chat-element").is(":visible") &&
			frappe.Chat.settings?.user?.enable_notifications === 1
		);
	}

	playNotificationSound() {
		frappe.utils.play_sound("chat-message-receive");
	}

	showAlert(res, room) {
		const message = this.truncateMessage(res.content);
		frappe.show_alert(
			{
				message: `<a href="#" data-action="open-chat" style="text-decoration: none; color: inherit;">
					<strong>${res.contact_name || ""}</strong><br>
					<span style="opacity: 0.9;">${message}</span>
				</a>`,
				indicator: "green",
			},
			5,
			{
				"open-chat": () => this.openChatAndFocus(room),
			},
		);
	}

	truncateMessage(content) {
		return content?.length > 24 ? content.substring(0, 24) + "..." : content || "";
	}

	openChatAndFocus(room) {
		if (!$(".waba-chat-element").is(":visible")) {
			$(".waba-navbar-icon").click();
		}
		setTimeout(() => room.chatRoom.$chat_room?.click(), 100);
	}

	updateRoom(res, room) {
		if (room.chatRoom.set_last_message) {
			room.chatRoom.set_last_message(message, res.creation, res.status, res.type);
		}

		room.chatRoom.move_to_top?.();
		this.roomManager.moveRoomToTop(res.room);

		if (this.chatList.active_room_id === res.room) {
			this.markCurrentRoomAsRead(res.room, room);
		} else if (room.profile.is_read === 1) {
			this.incrementUnreadCount(res.room, room);
		}
	}

	markCurrentRoomAsRead(roomId, room) {
		mark_message_read(roomId, this.chatList.whatsapp_account);
		if (room.profile.unread_incoming > 0) {
			const oldUnread = room.profile.unread_incoming;
			this.chatList.total_unread_count = Math.max(
				0,
				this.chatList.total_unread_count - oldUnread,
			);
			room.profile.unread_incoming = 0;
			set_notification_count(this.chatList.total_unread_count);
			room.chatRoom.set_as_read?.();
		}
	}

	incrementUnreadCount(roomId, room) {
		const newUnreadCount = (room.profile.unread_incoming || 0) + 1;
		room.profile.is_read = 0;
		room.profile.unread_incoming = newUnreadCount;
		this.chatList.total_unread_count += 1;
		set_notification_count(this.chatList.total_unread_count);
		this.updateUnreadBadge(room, newUnreadCount);
	}

	updateUnreadBadge(room, count) {
		const displayCount = count > 9 ? "9+" : count;
		const $badge = room.chatRoom.$chat_room?.find(".waba-unread-badge");

		if ($badge?.length) {
			$badge.text(displayCount);
		} else if (room.chatRoom.$chat_room) {
			room.chatRoom.$chat_room
				.find(".waba-room-name")
				.append(`<div class='waba-unread-badge'>${displayCount}</div>`);
		}
	}

	refreshRooms() {
		frappe.call({
			method: "waba_suite.api.contacts.get",
			args: {
				email: this.chatList.user_email,
				whatsapp_account: account_name(this.chatList.whatsapp_account),
			},
			callback: (response) => {
				if (response.message && this.chatList.refresh_rooms) {
					this.chatList.refresh_rooms();
				}
			},
		});
	}

	processPrivateRoom(res) {
		if (res.room_type === "Direct") {
			const isMe = res.member_names?.[0]?.email === this.chatList.user_email;
			res.room_name = isMe ? res.member_names[1]?.name : res.member_names[0]?.name;
			res.opposite_person_email = isMe
				? res.member_names[1]?.email
				: res.member_names[0]?.email;
		}
		res.user = this.chatList.user;
		res.is_admin = this.chatList.is_admin;
		res.user_email = this.chatList.user_email;
		res.whatsapp_account = this.chatList.whatsapp_account;
		this.roomManager.addRoom(res);
	}
}
