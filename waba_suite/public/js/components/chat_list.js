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
		this.refresh_interval = null;
		this.is_refreshing = false;
		this.active_room_id = null;
		this.total_unread_count = 0;
		this.setup();
	}

	setup() {
		this.$chat_list = $(document.createElement("div"));
		this.$chat_list.addClass("waba-chat-list");
		this.render();
		this.setup_search();
		this.setup_socketio();
		this.initialize_data();
		this.start_auto_refresh();
	}

	start_auto_refresh() {
		if (this.refresh_interval) {
			clearInterval(this.refresh_interval);
		}
		this.refresh_interval = setInterval(() => {
			if (this.$chat_list && this.$chat_list.is(":visible") && this.whatsapp_account) {
				this.refresh_rooms();
			}
		}, 5000);
	}

	stop_auto_refresh() {
		if (this.refresh_interval) {
			clearInterval(this.refresh_interval);
			this.refresh_interval = null;
		}
	}

	getLastMessageDate(room) {
		if (!room) return new Date(0);
		if (room.last_message && room.last_message.creation) {
			return new Date(room.last_message.creation);
		}
		if (room.modified) {
			return new Date(room.modified);
		}
		return new Date(0);
	}

	async refresh_rooms() {
		if (this.is_refreshing || !this.whatsapp_account) {
			return;
		}

		this.is_refreshing = true;

		try {
			const current_search = this.$chat_list.find(".waba-chat-search-box").val() || "";

			const res = await get_rooms(this.user_email, this.whatsapp_account);

			if (res && Array.isArray(res)) {
				const new_rooms_sorted = [...res].sort((a, b) => {
					const dateA = this.getLastMessageDate(a);
					const dateB = this.getLastMessageDate(b);
					return dateB - dateA;
				});

				const current_rooms_sorted = [...(this.rooms || [])].sort((a, b) => {
					const dateA = this.getLastMessageDate(a);
					const dateB = this.getLastMessageDate(b);
					return dateB - dateA;
				});

				if (JSON.stringify(new_rooms_sorted) !== JSON.stringify(current_rooms_sorted)) {
					this.rooms = res;

					const sorted_rooms_for_display = [...res].sort((a, b) => {
						const dateA = this.getLastMessageDate(a);
						const dateB = this.getLastMessageDate(b);
						return dateB - dateA;
					});

					const existing_rooms = new Map(this.chat_rooms);
					const new_chat_rooms = [];
					let new_total_unread = 0;

					for (const element of sorted_rooms_for_display) {
						if (!element || !element.name) continue;

						const unread_count = element.unread_incoming || 0;
						new_total_unread += unread_count;

						let profile = {
							user: this.user,
							user_email: element.mobile_no,
							last_message: element.last_message,
							last_date: element.last_date || element.modified,
							is_admin: this.is_admin,
							room: element.name,
							is_read: element.is_read || 0,
							room_name: element.contact_name || element.mobile_no,
							room_type: element.type || "Direct",
							opposite_person_email: element.mobile_no,
							whatsapp_account: this.whatsapp_account,
							unread_incoming: unread_count,
							contact_name: element.contact_name,
							mobile_no: element.mobile_no,
						};

						if (existing_rooms.has(profile.room)) {
							const existing_room = existing_rooms.get(profile.room);
							if (
								existing_room &&
								existing_room[1] &&
								existing_room[1].update_room_data
							) {
								existing_room[1].update_room_data(profile);
								new_chat_rooms.push([profile.room, existing_room[1]]);
							} else {
								const new_room = new ChatRoom({
									$wrapper: this.$wrapper,
									$chat_rooms_container: this.$chat_rooms_container,
									chat_list: this,
									element: profile,
								});
								new_chat_rooms.push([profile.room, new_room]);
							}
						} else {
							const new_room = new ChatRoom({
								$wrapper: this.$wrapper,
								$chat_rooms_container: this.$chat_rooms_container,
								chat_list: this,
								element: profile,
							});
							new_chat_rooms.push([profile.room, new_room]);
						}
					}

					this.chat_rooms = new_chat_rooms;
					this.total_unread_count = new_total_unread;
					set_notification_count(this.total_unread_count);

					if (this.$chat_rooms_container) {
						this.$chat_rooms_container.empty();
						this.render_messages();
					}

					if (current_search) {
						this.filter_rooms(current_search.toLowerCase());
					}

					if (this.active_room_id) {
						const active_room = this.chat_rooms.find(
							(room) => room && room[0] === this.active_room_id,
						);
						if (active_room && active_room[1] && active_room[1].$chat_room) {
							active_room[1].$chat_room.addClass("waba-chat-room-active");
						}
					}
				}
			}
		} catch (error) {
			console.error("Error refreshing rooms:", error);
		} finally {
			this.is_refreshing = false;
		}
	}

	async initialize_data() {
		this.setup_header();
		await this.fetch_and_setup_rooms();
	}

	setup_header() {
		if (!this.$chat_list) return;

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
		if (!this.$chat_list) return;
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

			let totalUnread = 0;

			if (!this.whatsapp_account) {
				const activeAccount = accData.message.default_account || accounts[0];
				if (activeAccount) {
					this.whatsapp_account = activeAccount.name;
					this.account_display_name = activeAccount.account_name;
					totalUnread = activeAccount.unread_count || 0;
				}
			} else {
				const currentAcc = accounts.find((acc) => acc.name === this.whatsapp_account);
				if (currentAcc) {
					totalUnread = currentAcc.unread_count || 0;
				} else {
					for (const acc of accounts) {
						totalUnread += acc.unread_count || 0;
					}
				}
			}

			this.total_unread_count = totalUnread;
			set_notification_count(this.total_unread_count);

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
		this.total_unread_count = 0;

		if (!this.rooms || !Array.isArray(this.rooms)) {
			return;
		}

		const sorted_rooms = [...this.rooms].sort((a, b) => {
			const dateA = this.getLastMessageDate(a);
			const dateB = this.getLastMessageDate(b);
			return dateB - dateA;
		});

		for (const element of sorted_rooms) {
			if (!element || !element.name) continue;

			const unread_count = element.unread_incoming || 0;
			this.total_unread_count += unread_count;

			let profile = {
				user: this.user,
				user_email: element.mobile_no,
				last_message: element.last_message,
				last_date: element.last_date || element.modified,
				is_admin: this.is_admin,
				room: element.name,
				is_read: element.is_read || 0,
				room_name: element.contact_name || element.mobile_no,
				room_type: element.type || "Direct",
				opposite_person_email: element.mobile_no,
				whatsapp_account: this.whatsapp_account,
				unread_incoming: unread_count,
				contact_name: element.contact_name,
				mobile_no: element.mobile_no,
			};

			const new_room = new ChatRoom({
				$wrapper: this.$wrapper,
				$chat_rooms_container: this.$chat_rooms_container,
				chat_list: this,
				element: profile,
			});

			this.chat_rooms.push([profile.room, new_room]);
		}

		set_notification_count(this.total_unread_count);
	}

	filter_rooms(query) {
		if (!this.chat_rooms) return;
		for (const room of this.chat_rooms) {
			if (room && room[1] && room[1].$chat_room && room[1].profile) {
				const txt = room[1].profile.room_name.toLowerCase();
				if (txt.includes(query)) {
					room[1].$chat_room.show();
				} else {
					room[1].$chat_room.hide();
				}
			}
		}
	}

	create_new_room(profile) {
		if (!profile) return;

		profile.whatsapp_account = this.whatsapp_account;

		const new_room = new ChatRoom({
			$wrapper: this.$wrapper,
			$chat_rooms_container: this.$chat_rooms_container,
			chat_list: this,
			element: profile,
		});

		const new_room_date = this.getLastMessageDate(profile);
		let insert_position = 0;

		for (let i = 0; i < this.chat_rooms.length; i++) {
			if (!this.chat_rooms[i] || !this.chat_rooms[i][1]) continue;
			const existing_date = this.getLastMessageDate(this.chat_rooms[i][1].profile);
			if (new_room_date > existing_date) {
				insert_position = i;
				break;
			}
			insert_position = this.chat_rooms.length;
		}

		this.chat_rooms.splice(insert_position, 0, [profile.room, new_room]);
		new_room.render(insert_position === 0 ? "prepend" : "append");

		if (profile.unread_incoming) {
			this.total_unread_count += profile.unread_incoming;
			set_notification_count(this.total_unread_count);
		}
	}

	setup_events() {
		const me = this;
		if (!this.$chat_list) return;

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
						onAccountChange: async (newAccount, displayName, unreadCount) => {
							me.whatsapp_account = newAccount;
							me.account_display_name = displayName;
							me.total_unread_count = unreadCount || 0;
							set_notification_count(me.total_unread_count);
							await me.refreshWithNewAccount(newAccount);
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
		if (this.$chat_rooms_container) {
			this.$chat_rooms_container.empty();
		}
		await this.fetch_and_setup_rooms();
	}

	render_messages() {
		if (!this.$chat_rooms_container) return;
		this.$chat_rooms_container.empty();
		for (const element of this.chat_rooms) {
			if (element && element[1] && element[1].render) {
				element[1].render("append");
			}
		}
	}

	render() {
		if (!this.$wrapper) return;
		this.$wrapper.html(this.$chat_list);
		this.setup_events();
	}

	move_room_to_top(chat_room_item) {
		if (!chat_room_item || !chat_room_item[0]) return;

		const roomIndex = this.chat_rooms.findIndex(
			(item) => item && item[0] === chat_room_item[0],
		);
		if (roomIndex > -1) {
			this.chat_rooms.splice(roomIndex, 1);
			this.chat_rooms.unshift(chat_room_item);

			if (this.$chat_rooms_container && chat_room_item[1] && chat_room_item[1].$chat_room) {
				this.$chat_rooms_container.prepend(chat_room_item[1].$chat_room);
			}
		}
	}

	set_active_room(roomId) {
		this.active_room_id = roomId;

		if (!this.chat_rooms) return;

		for (const room of this.chat_rooms) {
			if (room && room[1] && room[1].$chat_room) {
				if (room[0] === roomId) {
					room[1].$chat_room.addClass("waba-chat-room-active");
				} else {
					room[1].$chat_room.removeClass("waba-chat-room-active");
				}
			}
		}
	}

	clear_active_room() {
		this.active_room_id = null;
		if (!this.chat_rooms) return;

		for (const room of this.chat_rooms) {
			if (room && room[1] && room[1].$chat_room) {
				room[1].$chat_room.removeClass("waba-chat-room-active");
			}
		}
	}

	update_unread_count(change, roomId = null, newUnreadCount = null) {
		if (roomId !== null && newUnreadCount !== null) {
			const room = this.chat_rooms.find((r) => r && r[0] === roomId);
			if (room && room[1] && room[1].profile) {
				const oldUnread = room[1].profile.unread_incoming || 0;
				this.total_unread_count = this.total_unread_count - oldUnread + newUnreadCount;
				room[1].profile.unread_incoming = newUnreadCount;
			}
		} else if (change === "increment") {
			this.total_unread_count += 1;
		} else if (change === "decrement") {
			this.total_unread_count = Math.max(0, this.total_unread_count - 1);
		}

		set_notification_count(this.total_unread_count);
	}

	setup_socketio() {
		const me = this;

		frappe.realtime.on("latest_chat_updates", function (res) {
			if (!me.whatsapp_account || res.whatsapp_account !== me.whatsapp_account) return;

			let chat_room_item = me.chat_rooms
				? me.chat_rooms.find((element) => element && element[0] === res.room)
				: null;

			if (!chat_room_item && res.room) {
				frappe.call({
					method: "waba_suite.api.contacts.get",
					args: {
						email: me.user_email,
						whatsapp_account: me.whatsapp_account,
					},
					callback: function (response) {
						if (response.message && me.refresh_rooms) {
							me.refresh_rooms();
						}
					},
				});
				return;
			}

			if (!chat_room_item || !chat_room_item[1]) return;

			frappe.utils.play_sound("chat-message-receive");
			const message =
				res.content && res.content.length > 24
					? res.content.substring(0, 24) + "..."
					: res.content || "";

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
					"open-chat": () => {
						if (!$(".waba-chat-element").is(":visible"))
							$(".waba-navbar-icon").click();
						setTimeout(() => chat_room_item[1].$chat_room.click(), 100);
					},
				},
			);

			if (chat_room_item[1].set_last_message) {
				chat_room_item[1].set_last_message(message, res.creation, res.status, res.type);
			}

			if (chat_room_item[1].move_to_top) {
				chat_room_item[1].move_to_top();
			}

			me.move_room_to_top(chat_room_item);

			if (me.active_room_id === res.room) {
				if (res.room) {
					mark_message_read(res.room, me.whatsapp_account);
					if (
						chat_room_item[1].profile &&
						chat_room_item[1].profile.unread_incoming > 0
					) {
						const oldUnread = chat_room_item[1].profile.unread_incoming;
						me.total_unread_count = Math.max(0, me.total_unread_count - oldUnread);
						chat_room_item[1].profile.unread_incoming = 0;
						set_notification_count(me.total_unread_count);
						chat_room_item[1].set_as_read();
					}
				}
			} else {
				if (chat_room_item[1].profile && chat_room_item[1].profile.is_read === 1) {
					const newUnreadCount = (chat_room_item[1].profile.unread_incoming || 0) + 1;
					chat_room_item[1].profile.is_read = 0;
					chat_room_item[1].profile.unread_incoming = newUnreadCount;
					me.total_unread_count += 1;
					set_notification_count(me.total_unread_count);

					const $badge = chat_room_item[1].$chat_room
						? chat_room_item[1].$chat_room.find(".waba-unread-badge")
						: null;
					const displayCount = newUnreadCount > 9 ? "9+" : newUnreadCount;
					if ($badge && $badge.length) {
						$badge.text(displayCount);
					} else if (chat_room_item[1].$chat_room) {
						chat_room_item[1].$chat_room
							.find(".waba-room-name")
							.append(`<div class='waba-unread-badge'>${displayCount}</div>`);
					}
				}
			}
		});

		frappe.realtime.on("new_room_creation", function (res) {
			if (!me.whatsapp_account || res.whatsapp_account !== me.whatsapp_account) return;
			frappe.utils.play_sound("chat-notification");
			if (res) {
				res.user = me.user;
				me.create_new_room(res);
			}
		});

		frappe.realtime.on("private_room_creation", function (res) {
			if (!me.whatsapp_account || res.whatsapp_account !== me.whatsapp_account) return;
			if (
				!$(".waba-chat-element").is(":visible") &&
				frappe.Chat.settings &&
				frappe.Chat.settings.user &&
				frappe.Chat.settings.user.enable_notifications === 1
			) {
				frappe.utils.play_sound("chat-notification");
			}

			if (res.members && res.members.includes(me.user_email)) {
				if (res.room_type === "Direct") {
					const is_me =
						res.member_names &&
						res.member_names[0] &&
						res.member_names[0]["email"] == me.user_email;
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
