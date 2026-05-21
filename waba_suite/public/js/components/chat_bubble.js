export default class ChatBubble {
	constructor(parent) {
		this.parent = parent;
		this.setup();
	}

	setup() {
		this.$chat_bubble = $(document.createElement("div"));
		this.open_title = this.parent.is_admin ? __("Show Chats") : __("Chat With Us");
		this.closed_title = __("Close Chat");

		const bubble_visible = this.parent.is_desk === true ? "d-none" : "";

		this.open_inner_html = `
      <div class='waba-chat-bubble ${bubble_visible}'>
        <span class='waba-chat-message-icon'>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.45-5.37-9.9-9.91-9.9zm0 18.23c-1.5 0-2.97-.4-4.26-1.15l-.31-.18-3.11.82.83-3.04-.2-.32c-.81-1.32-1.24-2.84-1.24-4.39 0-4.56 3.71-8.27 8.28-8.27 4.56 0 8.27 3.71 8.27 8.27.01 4.56-3.7 8.26-8.26 8.26z"/>
          </svg>
        </span>
        <span>${this.open_title}</span>
      </div>
    `;

		this.closed_inner_html = `
      <div class='waba-chat-bubble waba-chat-bubble-closed ${bubble_visible}'>
        <span class='waba-cross-icon'>
          ${frappe.utils.icon("close-alt", "md")}
        </span>
      </div>
    `;

		this.$chat_bubble
			.attr({ title: this.open_title, id: "waba-chat-bubble" })
			.html(this.open_inner_html);
	}

	render() {
		this.parent.$app_element.append(this.$chat_bubble);
		this.setup_events();
	}

	change_bubble() {
		this.parent.is_open = !this.parent.is_open;
		if (this.parent.is_open === false) {
			this.$chat_bubble.attr({ title: this.open_title }).html(this.open_inner_html);
			this.parent.hide_chat_widget();
		} else {
			this.$chat_bubble.attr({ title: this.closed_title }).html(this.closed_inner_html);
			this.parent.show_chat_widget();
		}
	}

	setup_events() {
		const me = this;
		$("#waba-chat-bubble, .waba-chat-cross-button").on("click", () => {
			me.change_bubble();
		});
	}
}
