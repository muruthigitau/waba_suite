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
		this.$app_element.addClass("chat-app");
		this.$chat_container = $(document.createElement("div"));
		this.$chat_container.addClass("chat-container");
		$("body").append(this.$app_element);
		this.is_open = false;

		this.$chat_element = $(document.createElement("div")).addClass("chat-element").hide();

		this.$chat_element.append(`
			<span class="chat-cross-button">
				${frappe.utils.icon("close", "lg")}
			</span>
		`);
		this.$chat_element.append(this.$chat_container);
		this.$chat_element.appendTo(this.$app_element);

		this.chat_bubble = new ChatBubble(this);
		this.chat_bubble.render();

		const userMenuElement = $(".nav-item.dropdown.dropdown-navbar-user.dropdown-mobile.mt-3");
		if (userMenuElement.length > 0) {
			const navbarIconHTML = `
				<div class="nav-item dropdown dropdown-navbar-user dropdown-mobile mt-3 chat-navbar-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 8px !important;">
					<a class="align-center btn-reset flex nav-link sidebar-user-button" style="width: 100%; min-height: 40px; position: relative;" title="WhatsApp Chat">
						<div class="position-relative" style="display: inline-block;">
							<span class="avatar avatar-medium">
								<div class="avatar-frame standard-image" style="background-color: #25D366; color: white;">
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
										<path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.45-4.45-9.9-9.91-9.9zm0 18.23c-1.5 0-2.97-.4-4.26-1.15l-.31-.18-3.11.82.83-3.04-.2-.32c-.81-1.32-1.24-2.84-1.24-4.39 0-4.56 3.71-8.27 8.28-8.27 4.56 0 8.27 3.71 8.27 8.27.01 4.56-3.7 8.26-8.26 8.26zm4.53-6.18c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.24-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.12-1.06-.39-2.02-1.25-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.76-1.85-.2-.49-.41-.43-.56-.43-.15 0-.32-.01-.49-.01-.17 0-.45.06-.68.31-.23.25-.88.86-.88 2.11 0 1.25.91 2.45 1.04 2.62.13.17 1.76 2.7 4.28 3.76.6.25 1.08.4 1.45.51.61.19 1.17.17 1.61.1.49-.06 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29z"/>
									</svg>
								</div>
							</span>
							<span class="badge" id="chat-notification-count" style="position: absolute; top: -5px; right: -5px; background-color: #dc3545; color: white; border-radius: 50%; padding: 2px 5px; font-size: 10px; min-width: 18px; text-align: center;"></span>
						</div>
						<div class="avatar-name-email ml-2 text-small overflow-hidden w-75">
							<span class="d-block text-truncate">WhatsApp Chats</span>
							<span class="d-block text-secondary text-truncate">View Messages</span>
						</div>
					</a>
				</div>
			`;

			userMenuElement.before(navbarIconHTML);
		} else if (this.is_desk === true) {
			const fallbackIconHTML = `
				<div class="nav-item dropdown dropdown-navbar-user dropdown-mobile mt-3 chat-navbar-item">
					<a class="align-center btn-reset flex nav-link sidebar-user-button" style="width: 100%; min-height: 40px; position: relative;" title="WhatsApp Chat">
						<div class="position-relative" style="display: inline-block;">
							<span class="avatar avatar-medium">
								<div class="avatar-frame standard-image" style="background-color: #25D366; color: white;">
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
										<path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.45-4.45-9.9-9.91-9.9zm0 18.23c-1.5 0-2.97-.4-4.26-1.15l-.31-.18-3.11.82.83-3.04-.2-.32c-.81-1.32-1.24-2.84-1.24-4.39 0-4.56 3.71-8.27 8.28-8.27 4.56 0 8.27 3.71 8.27 8.27.01 4.56-3.7 8.26-8.26 8.26zm4.53-6.18c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.24-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.12-1.06-.39-2.02-1.25-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.76-1.85-.2-.49-.41-.43-.56-.43-.15 0-.32-.01-.49-.01-.17 0-.45.06-.68.31-.23.25-.88.86-.88 2.11 0 1.25.91 2.45 1.04 2.62.13.17 1.76 2.7 4.28 3.76.6.25 1.08.4 1.45.51.61.19 1.17.17 1.61.1.49-.06 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29z"/>
									</svg>
								</div>
							</span>
							<span class="badge" id="chat-notification-count" style="position: absolute; top: -5px; right: -5px; background-color: #dc3545; color: white; border-radius: 50%; padding: 2px 5px; font-size: 10px; min-width: 18px; text-align: center;"></span>
						</div>
						<div class="avatar-name-email ml-2 text-small overflow-hidden w-75">
							<span class="d-block text-truncate">WhatsApp Chats</span>
							<span class="d-block text-secondary text-truncate">View Messages</span>
						</div>
					</a>
				</div>
			`;
			$("header.navbar > .container > .navbar-collapse > ul").prepend(fallbackIconHTML);
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
		const chat_app = $(".chat-app");
		const navbar = $(".navbar");
		const modal = $(".modal");
		return (
			!chat_app.is(e.target) &&
			chat_app.has(e.target).length === 0 &&
			!navbar.is(e.target) &&
			navbar.has(e.target).length === 0 &&
			!modal.is(e.target) &&
			modal.has(e.target).length === 0
		);
	}

	setup_events() {
		const me = this;
		$(".chat-navbar-item").on("click", function () {
			me.chat_bubble.change_bubble();
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
