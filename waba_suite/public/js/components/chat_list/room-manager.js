import ChatRoom from "../chat_room";
import { RoomSorter } from "./room-sorter.js";

export class RoomManager {
	constructor(chatList, $container) {
		this.chatList = chatList;
		this.$container = $container;
		this.rooms = new Map();
		this.totalUnreadCount = 0;
	}

	updateRooms(roomsData, userEmail, isAdmin, whatsappAccount) {
		const sortedRooms = RoomSorter.sortByLastMessage(roomsData);
		const newRooms = new Map();
		let newTotalUnread = 0;

		for (const roomData of sortedRooms) {
			if (!roomData?.name) continue;

			const unreadCount = roomData.unread_incoming || 0;
			newTotalUnread += unreadCount;

			const profile = {
				user: this.chatList.user,
				user_email: roomData.mobile_no,
				last_message: roomData.last_message,
				last_date: roomData.last_date || roomData.modified,
				is_admin: isAdmin,
				room: roomData.name,
				is_read: roomData.is_read || 0,
				room_name: roomData.contact_name || roomData.mobile_no,
				room_type: roomData.type || "Direct",
				opposite_person_email: roomData.mobile_no,
				whatsapp_account: whatsappAccount,
				unread_incoming: unreadCount,
				contact_name: roomData.contact_name,
				mobile_no: roomData.mobile_no,
			};

			let chatRoom;
			if (this.rooms.has(profile.room)) {
				const existing = this.rooms.get(profile.room);
				if (existing.chatRoom.update_room_data) {
					existing.chatRoom.update_room_data(profile);
					chatRoom = existing.chatRoom;
				} else {
					chatRoom = this.createChatRoom(profile);
				}
			} else {
				chatRoom = this.createChatRoom(profile);
			}

			newRooms.set(profile.room, { profile, chatRoom });
		}

		this.rooms = newRooms;
		this.totalUnreadCount = newTotalUnread;
		return newTotalUnread;
	}

	createChatRoom(profile) {
		return new ChatRoom({
			$wrapper: this.chatList.$wrapper,
			$chat_rooms_container: this.$container,
			chat_list: this.chatList,
			element: profile,
		});
	}

	addRoom(profile) {
		if (!profile) return null;

		profile.whatsapp_account = this.chatList.whatsapp_account;
		const chatRoom = this.createChatRoom(profile);
		const roomEntry = { profile, chatRoom };

		// Insert at correct position based on date
		const newRoomDate = RoomSorter.getLastMessageDate(profile);
		let insertPosition = this.getInsertPosition(newRoomDate);

		const roomsArray = Array.from(this.rooms.entries());
		roomsArray.splice(insertPosition, 0, [profile.room, roomEntry]);
		this.rooms = new Map(roomsArray);

		if (profile.unread_incoming) {
			this.totalUnreadCount += profile.unread_incoming;
		}

		return chatRoom;
	}

	getInsertPosition(newRoomDate) {
		let position = this.rooms.size;
		let index = 0;
		for (const [_, room] of this.rooms) {
			const existingDate = RoomSorter.getLastMessageDate(room.profile);
			if (newRoomDate > existingDate) {
				position = index;
				break;
			}
			index++;
			position = this.rooms.size;
		}
		return position;
	}

	moveRoomToTop(roomId) {
		const room = this.rooms.get(roomId);
		if (!room) return;

		this.rooms.delete(roomId);
		const newMap = new Map();
		newMap.set(roomId, room);
		for (const [id, r] of this.rooms) {
			newMap.set(id, r);
		}
		this.rooms = newMap;

		if (room.chatRoom.$chat_room) {
			this.$container.prepend(room.chatRoom.$chat_room);
		}
	}

	getRoom(roomId) {
		return this.rooms.get(roomId);
	}

	getAllRooms() {
		return Array.from(this.rooms.values());
	}

	filterRooms(searchQuery) {
		for (const room of this.rooms.values()) {
			const shouldShow = room.profile.room_name.toLowerCase().includes(searchQuery);
			room.chatRoom.$chat_room?.toggle(shouldShow);
		}
	}

	updateUnreadCount(roomId, newUnreadCount) {
		const room = this.rooms.get(roomId);
		if (!room) return;

		const oldUnread = room.profile.unread_incoming || 0;
		this.totalUnreadCount = this.totalUnreadCount - oldUnread + newUnreadCount;
		room.profile.unread_incoming = newUnreadCount;
		return this.totalUnreadCount;
	}

	setActiveRoom(roomId) {
		for (const [id, room] of this.rooms) {
			room.chatRoom.$chat_room?.toggleClass("waba-chat-room-active", id === roomId);
		}
	}

	clearActiveRoom() {
		for (const room of this.rooms.values()) {
			room.chatRoom.$chat_room?.removeClass("waba-chat-room-active");
		}
	}

	renderAll() {
		this.$container.empty();
		for (const room of this.rooms.values()) {
			room.chatRoom.render("append");
		}
	}
}
