import ChatAccountSwitcher from "./chat_account_switcher";
import ChatAddRoom from "./chat_add_room";
import ChatRoom from "./chat_room";
import ChatUserSettings from "./chat_user_settings";
import { get_rooms, mark_message_read, set_notification_count } from "./chat_utils";

export default class ChatList {
	constructor(opts) {
		this.$wrapper = opts.$wrapper;
		this.user = opts.user;
		this.user_email = opts.user_email;
		this.is_admin = opts.is_admin;
		this.whatsapp_account = opts.whatsapp_account;
		this.account_display_name = opts.account_display_name || "";
		this.has_multiple_accounts = false;
		this.chat_rooms = [];
		this.parent = opts.parent || null;
		this.setup();
	}

	setup() {
		this.$chat_list = $(document.createElement("div"));
		this.$chat_list.addClass("waba-chat-list");
		this.render();
		this.setup_search();
		this.setup_socketio();
		this.initialize_data();
	}

	async initialize_data() {
		this.setup_header();
		await this.fetch_and_setup_rooms();
	}

	setup_header() {
		this.$chat_list.find(".waba-account-header, .waba-chat-list-header").remove();

		const chat_list_header_html = `
			<div class='waba-chat-list-header'>
				<h3>${__("Chats")}</h3>
				<div class='waba-chat-list-icons'>
					<div class='waba-list-icon waba-fullscreen-btn' title='${__("Open in Full Page")}'>
						${frappe.utils.icon("expand", "md")}
					</div>
					<div class='waba-list-icon waba-user-settings' title='${__("Settings")}'>
						${frappe.utils.icon("settings", "md")}
					</div>
					<div class='waba-list-icon waba-add-room' title='${__("New Chat")}'>
						${frappe.utils.icon("add", "md")}
					</div>
					<div class='waba-list-icon waba-chat-close-button' title='${__("Close")}'>
						${frappe.utils.icon("close", "md")}
					</div>
				</div>
			</div>
		`;

		this.$chat_list.prepend(chat_list_header_html);

		const accountDisplayHtml = this.whatsapp_account
			? `
			<div class='waba-account-header'>
				<div class='waba-account-info'>
					<span class='waba-account-icon'>📱</span>
					<div>
						<div class='waba-account-name'>${__(this.account_display_name || this.whatsapp_account)}</div>
						<div class='waba-account-status'>${__("Active WhatsApp Account")}</div>
					</div>
				</div>
				${
					this.has_multiple_accounts
						? `
					<div class='waba-switch-account'>
						${frappe.utils.icon("refresh", "sm")}
						<span>${__("Switch")}</span>
					</div>
				`
						: ""
				}
			</div>
		`
			: "";

		if (accountDisplayHtml) {
			this.$chat_list.find(".waba-chat-list-header").after(accountDisplayHtml);
		}
		this.setup_events();
	}

	setup_search() {
		if (this.$chat_list.find(".waba-chat-search").length) return;
		const chat_list_search_html = `
			<div class='waba-chat-search'>
				<div class='waba-search-input-group'>
					<span class='waba-search-icon'>${frappe.utils.icon("search", "sm")}</span>
					<input class='form-control waba-chat-search-box' type='search' placeholder='${__("Search or start new chat")}'>  
				</div>
			</div>
		`;
		this.$chat_list.append(chat_list_search_html);
	}

	async fetch_and_setup_rooms() {
		try {
			const accData = await frappe.call({
				method: "waba_suite.api.accounts.get_user_accounts_with_default",
				async: true,
			});

			const accounts = accData.message.accounts || [];
			this.has_multiple_accounts = accounts.length > 1;

			if (!this.whatsapp_account) {
				const activeAccount = accData.message.default_account || accounts[0];
				if (activeAccount) {
					this.whatsapp_account = activeAccount.name;
					this.account_display_name = activeAccount.account_name;
				}
			}

			this.setup_header();

			const res = await get_rooms(this.user_email, this.whatsapp_account);
			this.rooms = res || [];
			this.setup_rooms();
			this.render_messages();
		} catch (error) {
			console.error("Error fetching rooms:", error);
		}
	}

	setup_rooms() {
		if (!this.$chat_rooms_container) {
			this.$chat_rooms_container = $(document.createElement("div"));
			this.$chat_rooms_container.addClass("waba-chat-rooms-container");
			this.$chat_list.append(this.$chat_rooms_container);
		}

		this.$chat_rooms_container.empty();
		this.chat_rooms = [];

		this.rooms.forEach((element) => {
			let profile = {
				user: this.user,
				user_email: element.mobile_no,
				last_message: element.last_message,
				last_date: element.last_date || element.modified,
				is_admin: this.is_admin,
				room: element.name,
				is_read: element.is_read,
				room_name: element.contact_name || element.mobile_no,
				room_type: element.type || "Direct",
				opposite_person_email: element.mobile_no,
				whatsapp_account: this.whatsapp_account,
			};

			this.chat_rooms.push([
				profile.room,
				new ChatRoom({
					$wrapper: this.$wrapper,
					$chat_rooms_container: this.$chat_rooms_container,
					chat_list: this,
					element: profile,
				}),
			]);
		});
	}

	filter_rooms(query) {
		for (const room of this.chat_rooms) {
			const txt = room[1].profile.room_name.toLowerCase();
			if (txt.includes(query)) {
				room[1].$chat_room.show();
			} else {
				room[1].$chat_room.hide();
			}
		}
	}

	create_new_room(profile) {
		profile.whatsapp_account = this.whatsapp_account;
		const new_room = new ChatRoom({
			$wrapper: this.$wrapper,
			$chat_rooms_container: this.$chat_rooms_container,
			chat_list: this,
			element: profile,
		});
		this.chat_rooms.unshift([profile.room, new_room]);
		new_room.render("prepend");
	}

	setup_events() {
		const me = this;
		const $list = this.$chat_list;

		$list
			.find(".waba-chat-search-box")
			.off("input")
			.on("input", function () {
				me.filter_rooms($(this).val().toLowerCase());
			});

		$list
			.find(".waba-add-room")
			.off("click")
			.on("click", function () {
				if (!me.chat_add_room_modal) {
					me.chat_add_room_modal = new ChatAddRoom({
						user: me.user,
						user_email: me.user_email,
						whatsapp_account: me.whatsapp_account,
					});
				}
				me.chat_add_room_modal.show();
			});

		$list
			.find(".waba-user-settings")
			.off("click")
			.on("click", function () {
				if (!me.chat_user_settings) {
					me.chat_user_settings = new ChatUserSettings();
				}
				me.chat_user_settings.show();
			});

		$list
			.find(".waba-fullscreen-btn")
			.off("click")
			.on("click", function () {
				window.open("/whatsapp", "_blank");
			});

		$list
			.find(".waba-switch-account")
			.off("click")
			.on("click", function () {
				if (!me.chat_account_switcher) {
					me.chat_account_switcher = new ChatAccountSwitcher({
						currentAccount: me.whatsapp_account,
						onAccountChange: (newAccount, displayName) => {
							me.whatsapp_account = newAccount;
							me.account_display_name = displayName;
							me.refreshWithNewAccount(newAccount);
						},
					});
				}
				me.chat_account_switcher.show();
			});

		$list
			.find(".waba-chat-close-button")
			.off("click")
			.on("click", function (e) {
				e.stopPropagation();
				if (window.wabaChatBubble) {
					window.wabaChatBubble.change_bubble();
				}
			});
	}

	async refreshWithNewAccount(accountName) {
		this.whatsapp_account = accountName;
		this.$chat_rooms_container?.empty();
		await this.fetch_and_setup_rooms();
	}

	render_messages() {
		if (!this.$chat_rooms_container) return;
		this.$chat_rooms_container.empty();
		this.chat_rooms.forEach((element) => element[1].render("append"));
	}

	render() {
		this.$wrapper.html(this.$chat_list);
		this.setup_events();
	}

	move_room_to_top(chat_room_item) {
		this.chat_rooms = [
			chat_room_item,
			...this.chat_rooms.filter((item) => item !== chat_room_item),
		];
	}

	setup_socketio() {
		const me = this;
		frappe.realtime.on("latest_chat_updates", function (res) {
			if (res.whatsapp_account !== me.whatsapp_account) return;

			const chat_room_item = me.chat_rooms.find((element) => element[0] === res.room);
			if (!chat_room_item) return;

			frappe.utils.play_sound("chat-message-receive");
			const message =
				res.content.length > 24 ? res.content.substring(0, 24) + "..." : res.content;

			frappe.show_alert(
				{
					message: `<a href="#" data-action="open-chat" style="text-decoration: none; color: inherit;">
						<strong>${res.contact_name}</strong><br>
						<span style="opacity: 0.9;">${message}</span>
					</a>`,
					indicator: "green",
				},
				5,
				{
					"open-chat": () => {
						if (!$(".waba-chat-element").is(":visible"))
							$(".waba-navbar-icon").click();
						setTimeout(() => chat_room_item[1].$chat_room.click(), 100);
					},
				},
			);

			chat_room_item[1].set_last_message(message, res.creation);

			if ($(".waba-chat-list").is(":visible")) {
				chat_room_item[1].set_as_unread();
				chat_room_item[1].move_to_top();
				me.move_room_to_top(chat_room_item);
			} else if ($(".waba-chat-space").is(":visible")) {
				mark_message_read(res.room);
			} else {
				if (chat_room_item[1].profile.is_read === 1) {
					set_notification_count("increment");
					chat_room_item[1].profile.is_read = 0;
				}
			}
		});

		frappe.realtime.on("new_room_creation", function (res) {
			if (res.whatsapp_account !== me.whatsapp_account) return;
			frappe.utils.play_sound("chat-notification");
			res.user = me.user;
			me.create_new_room(res);
		});

		frappe.realtime.on("private_room_creation", function (res) {
			if (res.whatsapp_account !== me.whatsapp_account) return;
			if (
				!$(".waba-chat-element").is(":visible") &&
				frappe.Chat.settings.user.enable_notifications === 1
			) {
				frappe.utils.play_sound("chat-notification");
			}

			if (res.members && res.members.includes(me.user_email)) {
				if (res.room_type === "Direct") {
					const is_me = res.member_names[0]["email"] == me.user_email;
					res.room_name = is_me
						? res.member_names[1]["name"]
						: res.member_names[0]["name"];
					res.opposite_person_email = is_me
						? res.member_names[1]["email"]
						: res.member_names[0]["email"];
				}
				res.user = me.user;
				res.is_admin = me.is_admin;
				res.user_email = me.user_email;
				res.whatsapp_account = me.whatsapp_account;
				me.create_new_room(res);
			}
		});
	}
}
