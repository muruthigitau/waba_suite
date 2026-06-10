import moment from "moment";

function get_time(time) {
	let current_time;
	if (time) {
		current_time = moment(time);
	} else {
		current_time = moment();
	}
	return current_time.format("h:mm A");
}

function get_date_from_now(dateObj, type) {
	const sameDay = type === "space" ? "[Today]" : "h:mm A";
	const elseDay = type === "space" ? "MMM D, YYYY" : "DD/MM/YYYY";
	const result = moment(dateObj).calendar(null, {
		sameDay: sameDay,
		lastDay: "[Yesterday]",
		lastWeek: elseDay,
		sameElse: elseDay,
	});
	return result;
}

function is_date_change(dateObj, prevObj) {
	const curDate = moment(dateObj).format("DD/MM/YYYY");
	const prevDate = moment(prevObj).format("DD/MM/YYYY");
	return curDate !== prevDate;
}

function scroll_to_bottom($element) {
	$element.animate(
		{
			scrollTop: $element[0].scrollHeight,
		},
		300,
	);
}

function is_image(filename) {
	const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i;
	if (!allowedExtensions.exec(filename)) {
		return false;
	}
	return true;
}

async function get_rooms(email, whatsapp_account) {
	const res = await frappe.call({
		type: "GET",
		method: "waba_suite.api.contacts.get",
		args: {
			email: email,
			whatsapp_account: whatsapp_account,
		},
	});

	let rooms = await res.message;

	rooms = rooms.sort((a, b) => {
		let dateA = null;
		let dateB = null;

		if (a.last_message && a.last_message.creation) {
			dateA = new Date(a.last_message.creation);
		} else if (a.modified) {
			dateA = new Date(a.modified);
		} else {
			dateA = new Date(0);
		}

		if (b.last_message && b.last_message.creation) {
			dateB = new Date(b.last_message.creation);
		} else if (b.modified) {
			dateB = new Date(b.modified);
		} else {
			dateB = new Date(0);
		}

		return dateB - dateA;
	});

	return rooms;
}

async function get_messages(room, user_no, whatsapp_account) {
	const res = await frappe.call({
		method: "waba_suite.api.message.get_all",
		args: {
			room: room,
			user_no: user_no,
			whatsapp_account: whatsapp_account,
		},
	});
	return await res.message;
}

async function send_message(
	content,
	user,
	room,
	user_no,
	attachment,
	messageId,
	whatsapp_account,
	reply_to_message_id = null,
	content_type = "text",
) {
	try {
		await frappe.call({
			method: "waba_suite.api.message.send",
			args: {
				content: content,
				user: user,
				room: room,
				user_no: user_no,
				attachment: attachment,
				message_id: messageId,
				whatsapp_account: whatsapp_account,
				reply_to_message_id: reply_to_message_id,
				content_type: content_type,
			},
		});
	} catch (error) {
		frappe.msgprint({
			title: __("Error"),
			message: __("Something went wrong. Please refresh and try again."),
		});
	}
}

async function get_settings(token) {
	const res = await frappe.call({
		type: "GET",
		method: "waba_suite.api.config.settings",
		args: {
			token: token,
		},
	});
	return await res.message;
}

async function mark_message_read(room, whatsapp_account) {
	try {
		await frappe.call({
			method: "waba_suite.api.message.mark_as_read",
			args: {
				room: room,
				whatsapp_account: whatsapp_account,
			},
		});
	} catch (error) {}
}

async function create_guest({ email, full_name, message }) {
	const res = await frappe.call({
		method: "chat.api.user.get_guest_room",
		args: {
			email: email,
			full_name: full_name,
			message: message,
		},
	});
	return await res.message;
}

async function create_private_room(contact_name, mobile_no, email, whatsapp_account) {
	await frappe.call({
		method: "waba_suite.api.contacts.create",
		args: {
			contact_name: contact_name,
			mobile_no: mobile_no,
			email: email,
			whatsapp_account: whatsapp_account,
		},
	});
}

async function set_user_settings(settings) {
	await frappe.call({
		method: "chat.api.config.user_settings",
		args: {
			settings: settings,
		},
	});
}

function get_avatar_html(room_type, user_email, room_name) {
	let avatar_html;
	if (room_type === "Direct" && "desk" in frappe) {
		avatar_html = frappe.avatar(user_email, "avatar-medium");
		avatar_html = $(avatar_html).addClass("waba-chat-avatar").prop("outerHTML");
	} else {
		avatar_html = `<div class="waba-chat-avatar">${room_name.charAt(0).toUpperCase()}</div>`;
	}
	return avatar_html;
}

function set_notification_count(value) {
	if (typeof value === "number") {
		frappe.Chat.settings.unread_count = value;
		if (value === 0) {
			$("#waba-chat-notification-count").text("");
			$("#waba-chat-notification-count").hide();
		} else {
			const displayCount = value > 99 ? "99+" : value;
			$("#waba-chat-notification-count").text(displayCount);
			$("#waba-chat-notification-count").show();
		}
	} else if (value === "increment") {
		const new_count = (frappe.Chat.settings.unread_count || 0) + 1;
		frappe.Chat.settings.unread_count = new_count;
		const displayCount = new_count > 99 ? "99+" : new_count;
		$("#waba-chat-notification-count").text(displayCount);
		$("#waba-chat-notification-count").show();
	} else if (value === "decrement") {
		const new_count = Math.max(0, (frappe.Chat.settings.unread_count || 0) - 1);
		frappe.Chat.settings.unread_count = new_count;
		if (new_count === 0) {
			$("#waba-chat-notification-count").text("");
			$("#waba-chat-notification-count").hide();
		} else {
			const displayCount = new_count > 99 ? "99+" : new_count;
			$("#waba-chat-notification-count").text(displayCount);
		}
	}
}

async function get_active_account() {
	const res = await frappe.call({
		method: "waba_suite.api.accounts.get_active_account",
		args: {},
	});
	return res.message;
}
function get_message_display_text(last_message) {
	if (!last_message) {
		return {
			text: "",
			status: "",
			type: "",
			date: null,
			is_template: false,
			content_type: "text",
		};
	}

	let messageObj = last_message;
	if (typeof last_message === "string") {
		try {
			messageObj = JSON.parse(last_message);
		} catch (e) {
			messageObj = {
				message: last_message,
				type: "Incoming",
				status: "sent",
				content_type: "text",
				is_template: false,
			};
		}
	}

	let display_text = "";

	if (messageObj.is_template) {
		display_text = "📨 Template Message";
	} else if (messageObj.content_type === "image") {
		display_text = "📷 Image";
	} else if (messageObj.content_type === "video") {
		display_text = "🎥 Video";
	} else if (messageObj.content_type === "audio") {
		display_text = "🎵 Audio";
	} else if (messageObj.content_type === "document") {
		display_text = "📄 Document";
	} else if (messageObj.content_type === "location") {
		display_text = "📍 Location";
	} else if (messageObj.content_type === "contact") {
		display_text = "👤 Contact";
	} else if (messageObj.content_type === "reaction") {
		display_text = "😊 Reaction";
	} else if (messageObj.content_type === "flow") {
		display_text = "📋 Form";
	} else if (messageObj.content_type === "button") {
		display_text = "🔘 Button";
	} else if (messageObj.content_type === "interactive") {
		display_text = "💬 Interactive Message";
	} else {
		let raw_message = messageObj.message || messageObj.content || "";
		if (raw_message && raw_message.includes("<")) {
			const tempDiv = document.createElement("div");
			tempDiv.innerHTML = raw_message;
			display_text = tempDiv.textContent || tempDiv.innerText || "";
		} else {
			display_text = raw_message;
		}
	}

	return {
		text: display_text,
		status: messageObj.status || "sent",
		type: messageObj.type || "Incoming",
		date: messageObj.creation,
		is_template: messageObj.is_template || false,
		content_type: messageObj.content_type || "text",
	};
}
export {
	create_guest,
	create_private_room,
	get_active_account,
	get_avatar_html,
	get_date_from_now,
	get_message_display_text,
	get_messages,
	get_rooms,
	get_settings,
	get_time,
	is_date_change,
	is_image,
	mark_message_read,
	scroll_to_bottom,
	send_message,
	set_notification_count,
	set_user_settings,
};
