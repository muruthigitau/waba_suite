import { get_messages, scroll_to_bottom } from "../chat_utils.js";
import ChatActions from "./chat-actions.js";
import ChatHeader from "./chat-header.js";
import MessageRenderer from "./message-renderer.js";
import MessagesContainer from "./messages-container.js";
import RealtimeHandler from "./realtime-handler.js";

export default class ChatSpace {
	constructor(opts) {
		this.chat_list = opts.chat_list;
		this.$wrapper = opts.$wrapper;
		this.profile = opts.profile;
		this.refresh_interval = null;
		this.is_refreshing = false;
		this.last_message_count = 0;
		this.setup();
	}

	async setup() {
		this.$chat_space = $(document.createElement("div")).addClass("waba-chat-space");

		this.header = new ChatHeader(this);
		this.messagesContainer = new MessagesContainer(this);
		this.chatActions = new ChatActions(this);
		this.messageRenderer = new MessageRenderer(this);
		this.realtimeHandler = new RealtimeHandler(this);

		await this.render();
		this.realtimeHandler.setup();
		this.startAutoRefresh();
	}

	async render() {
		this.$chat_space.empty();
		this.$chat_space.append(this.header.render());
		this.$chat_space.append(this.messagesContainer.render());
		this.$chat_space.append(this.chatActions.render());
		this.$wrapper.html(this.$chat_space);

		const MessageActions = (await import("./message-actions.js")).default;
		this.messageActions = new MessageActions(this, this.chatActions);
		this.messagesContainer.setupMessageClickHandler(this.messageActions);

		await this.fetchAndSetupMessages();
		this.setupEvents();
		scroll_to_bottom(this.messagesContainer.getContainer());
	}

	dismissAllPopups() {
		if (this.messageActions) {
			this.messageActions.dismissAllPopups();
		} else {
			$(".waba-msg-action-popup").remove();
			$(".waba-small-emoji-picker-popup").remove();
			$(".waba-emoji-full-picker").remove();
		}
	}

	async fetchAndSetupMessages() {
		try {
			const res = await get_messages(
				this.profile.room,
				this.profile.user_email,
				this.profile.whatsapp_account,
			);
			this.last_message_count = res ? res.length : 0;
			this.messagesContainer.setMessages(res);
			await this.markAllUnreadAsRead();
		} catch (error) {
			frappe.msgprint({
				title: __("Error"),
				message: __("Something went wrong. Please refresh and try again."),
			});
		}
	}

	async markAllUnreadAsRead() {
		try {
			const result = await frappe.call({
				method: "waba_suite.api.message.mark_multiple_as_read",
				args: {
					whatsapp_contact: this.profile.room,
					whatsapp_account: this.profile.whatsapp_account,
				},
			});

			if (result.message?.status === "success") {
				this.messagesContainer.updateReadStatus();
			}
		} catch (error) {}
	}

	setupEvents() {
		$(document).on("click", ".waba-chat-back-button", () => {
			this.stopAutoRefresh();
			this.realtimeHandler.destroy();
			if (this.chat_list?.render_messages) this.chat_list.render_messages();
			if (this.chat_list?.render) this.chat_list.render();
		});

		$(document).on("click", ".waba-fullscreen-chat-btn", () => {
			window.open("/whatsapp", "_blank");
		});

		$(document).on("click", ".waba-chat-close-button", (e) => {
			e.stopPropagation();
			if (window.wabaChatBubble) window.wabaChatBubble.change_bubble();
		});

		$(document).on("click", (e) => {
			if (
				!$(e.target).closest(
					".waba-msg-action-popup, .waba-message-received, .waba-message-sent, .waba-small-emoji-picker-popup, .waba-emoji-full-picker, .waba-emoji-button",
				).length
			) {
				this.dismissAllPopups();
			}
		});
	}

	async refreshSpace() {
		if (this.is_refreshing) return;
		this.is_refreshing = true;

		try {
			const container = this.messagesContainer.getContainer();
			const current_scroll_position = container.scrollTop();
			const was_at_bottom =
				container[0].scrollHeight - current_scroll_position <= container.height() + 50;

			const messages = await get_messages(
				this.profile.room,
				this.profile.user_email,
				this.profile.whatsapp_account,
			);

			if (messages?.length > 0 && messages.length !== this.last_message_count) {
				const old_scroll_height = container[0].scrollHeight;
				this.messagesContainer.setMessages(messages);
				const new_scroll_height = container[0].scrollHeight;

				if (was_at_bottom) {
					scroll_to_bottom(container);
				} else if (messages.length > this.last_message_count) {
					container.scrollTop(
						current_scroll_position + (new_scroll_height - old_scroll_height),
					);
				}

				this.last_message_count = messages.length;
				await this.markAllUnreadAsRead();
			}
		} catch (error) {
		} finally {
			this.is_refreshing = false;
		}
	}

	startAutoRefresh() {
		this.refresh_interval = setInterval(() => this.refreshSpace(), 5000);
	}

	stopAutoRefresh() {
		if (this.refresh_interval) {
			clearInterval(this.refresh_interval);
			this.refresh_interval = null;
		}
	}

	destroy() {
		this.stopAutoRefresh();
		this.realtimeHandler.destroy();
		this.$chat_space?.remove();
	}
}
