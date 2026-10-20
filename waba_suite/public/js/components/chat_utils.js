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

/**
 * Resolve a WhatsApp Account to its name string for frappe API calls.
 *
 * API endpoints filter on the account name (e.g. "WhatsApp Settings" account
 * doc), not the account document/object. Some call sites receive the full
 * account object (from accounts.* APIs), so normalise before sending.
 *
 * @param {object|string|undefined|null} account - Account name or object.
 * @returns {string} The account name, or "" if nothing usable is given.
 */
function account_name(account) {
	if (account && typeof account === "object") {
		return account.name || "";
	}
	return account || "";
}

async function get_rooms(email, whatsapp_account) {
	const res = await frappe.call({
		type: "GET",
		method: "waba_suite.api.contacts.get",
		args: {
			email: email,
			whatsapp_account: account_name(whatsapp_account),
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

function get_avatar_html(room_type, email, name, profile_picture = null) {
	if (profile_picture && profile_picture !== "null" && profile_picture !== "") {
		return `
            <div class='waba-avatar' style="
                width: 40px;
                height: 40px;
                border-radius: 50%;
                overflow: hidden;
                flex-shrink: 0;
            ">
                <img src="${profile_picture}" alt="${__(name)}" style="
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                " onerror="this.onerror=null; this.parentElement.innerHTML=this.getFallbackAvatar('${room_type}', '${email}', '${name}')">
            </div>
        `;
	}

	let initial = name ? name.charAt(0).toUpperCase() : "?";
	if (room_type === "Group") {
		initial = "👥";
	}

	const colors = ["#25D366", "#075E54", "#128C7E", "#34B7F1", "#1DA1F2", "#E1306C"];
	const colorIndex = (email?.length || 0) % colors.length;

	return `
        <div class='waba-avatar' style="
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: ${colors[colorIndex]};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 600;
            color: white;
            flex-shrink: 0;
        ">
            ${initial}
        </div>
    `;
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

export {
	account_name,
	create_guest,
	create_private_room,
	get_active_account,
	get_avatar_html,
	get_date_from_now,
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
