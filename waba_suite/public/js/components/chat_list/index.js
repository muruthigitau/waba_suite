import ChatAccountSwitcher from "../chat_account_switcher.js";
import ChatAddRoom from "../chat_add_room.js";
import ChatUserSettings from "../chat_user_settings.js";
import { get_rooms, set_notification_count } from "../chat_utils.js";
import { ChatListHeader } from "./chat-list-header.js";
import { ChatSearch } from "./chat-search.js";
import { RealtimeHandler } from "./realtime-handler.js";
import { RoomManager } from "./room-manager.js";

export default class ChatList {
	constructor(opts) {
		this.$wrapper = opts.$wrapper;
		this.user = opts.user;
		this.user_email = opts.user_email;
		this.is_admin = opts.is_admin;
		this.whatsapp_account = opts.whatsapp_account;
		this.account_display_name = opts.account_display_name || "";
		this.parent = opts.parent || null;
		this.active_room_id = null;
		this.total_unread_count = 0;
		this.has_multiple_accounts = false;
		this.is_refreshing = false;
		this.refresh_interval = null;

		this.$chat_list = null;
		this.$chat_rooms_container = null;
		this.roomManager = null;
		this.header = null;
		this.search = null;
		this.realtimeHandler = null;

		this.isSetup = false;

		this.setup();
	}

	async setup() {
		if (this.isSetup) return;

		this.$chat_list = $(document.createElement("div")).addClass("waba-chat-list");
		this.$chat_rooms_container = $(document.createElement("div")).addClass(
			"waba-chat-rooms-container",
		);

		this.roomManager = new RoomManager(this, this.$chat_rooms_container);
		this.header = new ChatListHeader(this);
		this.search = new ChatSearch((query) => this.filterRooms(query));
		this.realtimeHandler = new RealtimeHandler(this, this.roomManager);

		await this.render();
		this.setupRealtime();
		this.startAutoRefresh();

		this.isSetup = true;
	}

	async render() {
		this.$chat_list.empty();

		this.$chat_list.append(this.header.render());
		this.$chat_list.append(this.search.render());
		this.$chat_list.append(this.$chat_rooms_container);
		this.$wrapper.html(this.$chat_list);

		await this.renderAccountHeader();
		this.attachGlobalEvents();
		await this.initializeData();
	}

	async renderAccountHeader() {
		const existingHeader = this.$chat_list.find(".waba-account-header");
		if (existingHeader.length) {
			existingHeader.remove();
		}

		const $accountHeader = this.header.renderAccountInfo(
			this.has_multiple_accounts,
			this.account_display_name,
			this.whatsapp_account,
		);
		if ($accountHeader) {
			this.$chat_list.find(".waba-chat-list-header").after($accountHeader);
		}
	}

	async initializeData() {
		await this.fetchAccountsAndRooms();
	}

	async fetchAccountsAndRooms() {
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
					this.total_unread_count = activeAccount.unread_count || 0;
				}
			} else {
				const currentAcc = accounts.find((acc) => acc.name === this.whatsapp_account);
				this.total_unread_count =
					currentAcc?.unread_count ||
					accounts.reduce((sum, acc) => sum + (acc.unread_count || 0), 0);
			}

			set_notification_count(this.total_unread_count);
			await this.renderAccountHeader();
			await this.fetchAndSetupRooms();
		} catch (error) {
			console.error("Failed to fetch accounts:", error);
		}
	}

	async fetchAndSetupRooms() {
		try {
			const res = await get_rooms(this.user_email, this.whatsapp_account);
			if (res && Array.isArray(res)) {
				this.total_unread_count = this.roomManager.updateRooms(
					res,
					this.user_email,
					this.is_admin,
					this.whatsapp_account,
				);
				set_notification_count(this.total_unread_count);
				this.roomManager.renderAll();
			}
		} catch (error) {
			console.error("Failed to fetch rooms:", error);
		}
	}

	async refreshRooms() {
		if (this.is_refreshing || !this.whatsapp_account) return;

		this.is_refreshing = true;
		try {
			const currentSearch = this.search.getValue();
			const res = await get_rooms(this.user_email, this.whatsapp_account);

			if (res && Array.isArray(res)) {
				const oldRoomsJson = JSON.stringify(Array.from(this.roomManager.rooms.keys()));
				const newRoomsJson = JSON.stringify(res.map((r) => r.name).sort());

				if (oldRoomsJson !== newRoomsJson) {
					this.total_unread_count = this.roomManager.updateRooms(
						res,
						this.user_email,
						this.is_admin,
						this.whatsapp_account,
					);
					set_notification_count(this.total_unread_count);
					this.roomManager.renderAll();

					if (currentSearch) {
						this.filterRooms(currentSearch);
					}

					if (this.active_room_id) {
						this.setActiveRoom(this.active_room_id);
					}
				}
			}
		} catch (error) {
			console.error("Failed to refresh rooms:", error);
		} finally {
			this.is_refreshing = false;
		}
	}

	filterRooms(query) {
		this.roomManager.filterRooms(query);
	}

	setActiveRoom(roomId) {
		this.active_room_id = roomId;
		this.roomManager.setActiveRoom(roomId);
	}

	clearActiveRoom() {
		this.active_room_id = null;
		this.roomManager.clearActiveRoom();
	}

	moveRoomToTop(chatRoomItem) {
		if (chatRoomItem?.[0]) {
			this.roomManager.moveRoomToTop(chatRoomItem[0]);
		}
	}

	updateUnreadCount(change, roomId = null, newUnreadCount = null) {
		if (roomId !== null && newUnreadCount !== null) {
			this.total_unread_count = this.roomManager.updateUnreadCount(roomId, newUnreadCount);
		} else if (change === "increment") {
			this.total_unread_count += 1;
		} else if (change === "decrement") {
			this.total_unread_count = Math.max(0, this.total_unread_count - 1);
		}
		set_notification_count(this.total_unread_count);
	}

	attachGlobalEvents() {
		const $list = this.$chat_list;

		$list
			.off("click", ".waba-add-room")
			.on("click", ".waba-add-room", () => this.showAddRoomModal());
		$list
			.off("click", ".waba-user-settings")
			.on("click", ".waba-user-settings", () => this.showUserSettings());
		$list
			.off("click", ".waba-fullscreen-btn")
			.on("click", ".waba-fullscreen-btn", () => this.openFullscreen());
		$list
			.off("click", ".waba-switch-account")
			.on("click", ".waba-switch-account", () => this.showAccountSwitcher());
		$list
			.off("click", ".waba-chat-close-button")
			.on("click", ".waba-chat-close-button", (e) => this.closeChat(e));
	}

	showAddRoomModal() {
		if (!this.chat_add_room_modal) {
			this.chat_add_room_modal = new ChatAddRoom({
				user: this.user,
				user_email: this.user_email,
				whatsapp_account: this.whatsapp_account,
			});
		}
		this.chat_add_room_modal.show();
	}

	showUserSettings() {
		if (!this.chat_user_settings) {
			this.chat_user_settings = new ChatUserSettings();
		}
		this.chat_user_settings.show();
	}

	openFullscreen() {
		window.open("/whatsapp", "_blank");
	}

	showAccountSwitcher() {
		if (!this.chat_account_switcher) {
			this.chat_account_switcher = new ChatAccountSwitcher({
				currentAccount: this.whatsapp_account,
				onAccountChange: async (newAccount, displayName, unreadCount) => {
					await this.switchAccount(newAccount, displayName, unreadCount);
				},
			});
		}
		this.chat_account_switcher.show();
	}

	async switchAccount(newAccount, displayName, unreadCount) {
		this.whatsapp_account = newAccount;
		this.account_display_name = displayName;
		this.total_unread_count = unreadCount || 0;
		set_notification_count(this.total_unread_count);
		await this.fetchAndSetupRooms();
	}

	closeChat(e) {
		e.stopPropagation();
		if (window.wabaChatBubble) {
			window.wabaChatBubble.change_bubble();
		}
	}

	setupRealtime() {
		this.realtimeHandler.setup();
	}

	startAutoRefresh() {
		if (this.refresh_interval) clearInterval(this.refresh_interval);
		this.refresh_interval = setInterval(() => {
			if (this.$chat_list?.is(":visible") && this.whatsapp_account) {
				this.refreshRooms();
			}
		}, 5000);
	}

	stopAutoRefresh() {
		if (this.refresh_interval) {
			clearInterval(this.refresh_interval);
			this.refresh_interval = null;
		}
	}

	destroy() {
		this.stopAutoRefresh();
		this.$chat_list?.remove();
		this.isSetup = false;
	}
}
