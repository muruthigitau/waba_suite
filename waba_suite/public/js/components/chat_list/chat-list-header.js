export class ChatListHeader {
	constructor(chatList) {
		this.chatList = chatList;
		this.$element = null;
	}

	render() {
		if (this.$element && this.$element.parent().length) {
			return this.$element;
		}

		const html = `
			<div class='waba-chat-list-header'>
				<h3>${__("Chats")}</h3>
				<div class='waba-chat-list-icons'>
					${this.createIconButton("expand", "Open in Full Page", "waba-fullscreen-btn")}
					${this.createIconButton("settings", "Settings", "waba-user-settings")}
					${this.createIconButton("add", "New Chat", "waba-add-room")}
					${this.createIconButton("close", "Close", "waba-chat-close-button")}
				</div>
			</div>
		`;
		this.$element = $(html);
		return this.$element;
	}

	createIconButton(iconName, title, className) {
		return `
			<div class='waba-list-icon ${className}' title='${__(title)}'>
				${frappe.utils.icon(iconName, "md")}
			</div>
		`;
	}

	renderAccountInfo(hasMultipleAccounts, accountDisplayName, whatsappAccount) {
		if (!whatsappAccount) return null;

		const html = `
			<div class='waba-account-header'>
				<div class='waba-account-info'>
					<span class='waba-account-icon'>📱</span>
					<div>
						<div class='waba-account-name'>${__(accountDisplayName || whatsappAccount)}</div>
						<div class='waba-account-status'>${__("Active WhatsApp Account")}</div>
					</div>
				</div>
				${hasMultipleAccounts ? this.renderSwitchButton() : ""}
			</div>
		`;
		return $(html);
	}

	renderSwitchButton() {
		return `
			<div class='waba-switch-account'>
				${frappe.utils.icon("refresh", "sm")}
				<span>${__("Switch")}</span>
			</div>
		`;
	}
}
