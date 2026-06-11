export class RoomProfile {
	constructor(roomData, userEmail, whatsappAccount, isAdmin) {
		this.user = roomData.user;
		this.user_email = roomData.mobile_no;
		this.last_message = roomData.last_message;
		this.last_date = roomData.last_date || roomData.modified;
		this.is_admin = isAdmin;
		this.room = roomData.name;
		this.is_read = roomData.is_read || 0;
		this.room_name = roomData.contact_name || roomData.mobile_no;
		this.room_type = roomData.type || "Direct";
		this.opposite_person_email = roomData.mobile_no;
		this.whatsapp_account = whatsappAccount;
		this.unread_incoming = roomData.unread_incoming || 0;
		this.contact_name = roomData.contact_name;
		this.mobile_no = roomData.mobile_no;
	}
}
