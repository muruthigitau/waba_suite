export default class ChatBubble {
	constructor(parent) {
		this.parent = parent;
		this.setup();
	}

	setup() {
		this.$chat_bubble = $(document.createElement("a"));
	}

	render() {
		this.parent.$app_element.append(this.$chat_bubble);
		this.setup_events();
	}

	change_bubble() {
		this.parent.is_open = !this.parent.is_open;

		if (!this.parent.is_open) {
			this.$chat_bubble.html(this.open_inner_html);
			this.parent.hide_chat_widget();
		} else {
			this.$chat_bubble.html(this.closed_inner_html);
			this.parent.show_chat_widget();
		}
	}

	setup_events() {
		this.$chat_bubble.off("click").on("click", (e) => {
			e.preventDefault();
			this.change_bubble();
		});
	}
}
