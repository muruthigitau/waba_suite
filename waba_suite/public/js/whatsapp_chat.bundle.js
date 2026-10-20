import {
	ChatBubble,
	ChatList,
	ChatSpace,
	ChatWelcome,
	get_settings,
	scroll_to_bottom,
} from "./components";

frappe.provide("frappe.Chat");
frappe.provide("frappe.Chat.settings");

frappe.Chat = class {
	constructor() {
		this.setup_app();
	}

	create_app() {
		this.$app_element = $(document.createElement("div"));
		this.$app_element.addClass("waba-chat-app");
		this.$chat_container = $(document.createElement("div"));
		this.$chat_container.addClass("waba-chat-container");
		$("body").append(this.$app_element);
		this.is_open = false;

		this.$chat_element = $(document.createElement("div")).addClass("waba-chat-element").hide();

		this.$chat_element.append(`
            <span class="waba-chat-cross-button" style="display: none;">
                ${frappe.utils.icon("close", "lg")}
            </span>
        `);
		this.$chat_element.append(this.$chat_container);
		this.$chat_element.appendTo(this.$app_element);

		this.chat_bubble = new ChatBubble(this);
		window.wabaChatBubble = this.chat_bubble;
		this.chat_bubble.render();

		const deskDockUser = $(".dock-user");

		if (deskDockUser.length > 0) {
			const dockItemHTML = `
                <button class="dock-item waba-navbar-icon" aria-label="WhatsApp Chat" title="Show Chats" style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; background: none; border: none; width: 100%; padding: 8px 0; cursor: pointer;">
                    <span class="dock-item-icon" style="position: relative; display: inline-flex; align-items: center; justify-content: center;">
                        <img src="/assets/waba_suite/whatsapp.png" alt="WhatsApp" style="width: 24px; height: 24px; object-fit: contain;" />
                        <span class="badge waba-notification-badge" id="waba-chat-notification-count" style="position: absolute; top: -5px; right: -5px; background-color: #dc3545; color: white; border-radius: 50%; padding: 2px 5px; font-size: 10px; min-width: 16px; text-align: center;"></span>
                    </span>
                    <span class="dock-item-label" style="font-size: 11px; margin-top: 4px;">WhatsApp</span>
                </button>
            `;
			deskDockUser.before(dockItemHTML);
		} else if (this.is_desk === true) {
			const navbarIconHTML = `
                <li class='nav-item dropdown dropdown-notifications dropdown-mobile waba-navbar-icon' title="Show Chats" style="display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <img src="/assets/waba_suite/whatsapp.png" alt="WhatsApp" style="width: 24px; height: 24px; object-fit: contain;" />
                    <span class="badge waba-notification-badge" id="waba-chat-notification-count"></span>
                </li>
            `;
			$("header.navbar > .container > .navbar-collapse > ul").prepend(navbarIconHTML);
		}

		this.setup_events();
	}

	async setup_app() {
		try {
			const token = localStorage.getItem("guest_token") || "";
			const res = await get_settings(token);
			this.is_admin = res.is_admin;
			this.is_desk = "desk" in frappe;

			if (res.enable_chat === false || (!this.is_desk && this.is_admin)) {
				return;
			}

			this.create_app();
			await frappe.socketio.init(res.socketio_port);

			frappe.Chat.settings = {};
			frappe.Chat.settings.user = res.user_settings;
			frappe.Chat.settings.unread_count = 0;

			if (res.is_admin) {
				this.chat_list = new ChatList({
					$wrapper: this.$chat_container,
					user: res.user,
					user_email: res.user_email,
					is_admin: res.is_admin,
					parent: this,
				});
				this.chat_list.render();
			} else if (res.is_verified) {
				this.chat_space = new ChatSpace({
					$wrapper: this.$chat_container,
					profile: {
						room_name: res.guest_title,
						room: res.room,
						is_admin: res.is_admin,
						user: res.user,
						user_email: res.user_email,
					},
					chat_list: { parent: this },
				});
			} else {
				this.chat_welcome = new ChatWelcome({
					$wrapper: this.$chat_container,
					profile: {
						name: res.guest_title,
						is_admin: res.is_admin,
						chat_status: res.chat_status,
					},
				});
				this.chat_welcome.render();
			}
		} catch (error) {
			console.error(error);
		}
	}

	show_chat_widget() {
		this.is_open = true;
		this.$chat_element.fadeIn(250);
		if (typeof this.chat_space !== "undefined") {
			scroll_to_bottom(this.chat_space.$chat_space_container);
		}
	}

	hide_chat_widget() {
		this.is_open = false;
		this.$chat_element.fadeOut(300);
	}

	should_close(e) {
		const chat_app = $(".waba-chat-app");
		const navbar = $(".navbar");
		const modal = $(".modal");
		const dock = $("#desk-dock");
		return (
			!chat_app.is(e.target) &&
			chat_app.has(e.target).length === 0 &&
			!navbar.is(e.target) &&
			navbar.has(e.target).length === 0 &&
			!dock.is(e.target) &&
			dock.has(e.target).length === 0 &&
			!modal.is(e.target) &&
			modal.has(e.target).length === 0
		);
	}

	setup_events() {
		const me = this;
		$(document).on("click", ".waba-navbar-icon", function () {
			window.open("/whatsapp", "_blank");
		});

		$(document).mouseup(function (e) {
			if (me.should_close(e) && me.is_open === true) {
				me.chat_bubble.change_bubble();
			}
		});
	}
};

$(function () {
	new frappe.Chat();
});
