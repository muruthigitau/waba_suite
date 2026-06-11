export class RoomSorter {
	static getLastMessageDate(room) {
		if (!room) return new Date(0);
		if (room.last_message?.creation) return new Date(room.last_message.creation);
		if (room.modified) return new Date(room.modified);
		return new Date(0);
	}

	static sortByLastMessage(rooms) {
		if (!Array.isArray(rooms)) return [];
		return [...rooms].sort((a, b) => {
			const dateA = this.getLastMessageDate(a);
			const dateB = this.getLastMessageDate(b);
			return dateB - dateA;
		});
	}
}
