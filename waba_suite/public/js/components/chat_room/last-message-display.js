export default class LastMessageDisplay {
	constructor(profile) {
		this.profile = profile;
	}

	updateProfile(profile) {
		this.profile = profile;
	}

	updateLastMessage(message, date, status, type) {
		if (this.profile) {
			this.profile.last_message = message;
			this.profile.last_date = date;
			if (status) this.profile.last_message_status = status;
			if (type) this.profile.last_message_type = type;
		}
	}

	getMessageStatusIcon(messageType, status) {
		if (messageType !== "Outgoing") {
			return "";
		}

		const statusMap = {
			draft: `<svg class="waba-status-icon waba-status-draft" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="8" x2="12" y2="12"/>
				<line x1="12" y1="16" x2="12.01" y2="16"/>
			</svg>`,
			sent: `<svg class="waba-status-icon waba-status-sent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2">
				<path d="M20 6L9 17L4 12"/>
			</svg>`,
			delivered: `<svg class="waba-status-icon waba-status-delivered" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#8696A0" stroke-width="2">
				<path d="M20 6L9 17L4 12"/>
				<path d="M26 6L15 17L10 12"/>
			</svg>`,
			read: `<svg class="waba-status-icon waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2">
				<path d="M20 6L9 17L4 12"/>
				<path d="M26 6L15 17L10 12"/>
			</svg>`,
			failed: `<svg class="waba-status-icon waba-status-failed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2">
				<circle cx="12" cy="12" r="10"/>
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>`,
			marked_as_read: `<svg class="waba-status-icon waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2">
				<path d="M20 6L9 17L4 12"/>
				<path d="M26 6L15 17L10 12"/>
			</svg>`,
		};

		return statusMap[status] || statusMap["sent"];
	}

	getTemplateNameFromContent(content) {
		if (!content) return null;

		try {
			const parsed = JSON.parse(content);
			if (parsed.template_name) {
				return parsed.template_name;
			}
		} catch (e) {
			const nameMatch = content.match(
				/<div[^>]*font-size:14px;font-weight:600[^>]*>([^<]+)<\/div>/,
			);
			if (nameMatch) {
				return nameMatch[1];
			}
		}
		return null;
	}

	getTemplateBodyText(content) {
		if (!content) return null;

		try {
			const parsed = JSON.parse(content);
			if (parsed.body_values && parsed.body_values.length) {
				const bodyText = parsed.body_values.filter((v) => v !== "-").join(" ");
				if (bodyText) {
					return bodyText;
				}
			}
		} catch (e) {
			const bodyMatch = content.match(/<b>Body:<\/b>\s*([^<]+)/);
			if (bodyMatch) {
				const parts = bodyMatch[1].split("|").map((p) => p.trim());
				const meaningfulText = parts.filter((p) => p !== "-").join(" ");
				if (meaningfulText) {
					return meaningfulText;
				}
			}
		}
		return null;
	}

	getTemplatePreview(content) {
		if (!content) return __("Template Message");

		const templateName = this.getTemplateNameFromContent(content);
		const bodyText = this.getTemplateBodyText(content);

		if (bodyText) {
			const preview = bodyText.length > 35 ? bodyText.substring(0, 35) + "..." : bodyText;
			return `📨 ${preview}`;
		}

		if (templateName) {
			const shortName =
				templateName.length > 25 ? templateName.substring(0, 25) + "..." : templateName;
			return `📨 ${shortName}`;
		}

		return "📨 " + __("Template Message");
	}

	getMessageDisplayText(messageData) {
		if (!messageData) {
			return {
				text: "",
				isTemplate: false,
				contentType: "text",
				status: "sent",
				type: "Outgoing",
			};
		}

		let messageContent = "";
		let isTemplate = false;
		let contentType = "text";
		let status = "sent";
		let type = "Outgoing";

		if (typeof messageData === "object") {
			messageContent =
				messageData.message || messageData.content || messageData.attach || "";
			isTemplate = messageData.use_template === 1 || messageData.is_template || false;
			contentType = messageData.content_type || "text";
			status = messageData.status || "sent";
			type = messageData.type || "Outgoing";
		} else {
			messageContent = messageData;
			isTemplate =
				messageContent &&
				(messageContent.includes("template_name") || messageContent.includes("Template:"));
		}

		let displayText = "";

		if (isTemplate) {
			displayText = this.getTemplatePreview(messageContent);
		} else if (contentType === "image") {
			displayText = "📷 " + __("Image");
		} else if (contentType === "video") {
			displayText = "🎥 " + __("Video");
		} else if (contentType === "audio") {
			displayText = "🎵 " + __("Audio");
		} else if (contentType === "document") {
			displayText = "📄 " + __("Document");
		} else if (contentType === "location") {
			displayText = "📍 " + __("Location");
		} else if (contentType === "contact") {
			displayText = "👤 " + __("Contact");
		} else if (contentType === "reaction") {
			displayText = "😊 " + __("Reaction");
		} else if (contentType === "flow") {
			displayText = "📋 " + __("Form");
		} else if (contentType === "button") {
			displayText = "🔘 " + __("Button");
		} else if (contentType === "interactive") {
			displayText = "💬 " + __("Interactive Message");
		} else {
			if (typeof messageContent === "string") {
				const tempDiv = document.createElement("div");
				tempDiv.innerHTML = messageContent;
				displayText = tempDiv.textContent || tempDiv.innerText || messageContent;
			} else {
				displayText = String(messageContent);
			}
		}

		if (displayText && displayText.length > 35) {
			displayText = displayText.substring(0, 35) + "...";
		}

		return {
			text: displayText || __("No messages yet"),
			status: status,
			type: type,
			isTemplate: isTemplate,
			contentType: contentType,
		};
	}

	render() {
		if (!this.profile) {
			return `<span>${__("No messages yet")}</span>`;
		}

		const lastMessage = this.profile.last_message;
		const messageInfo = this.getMessageDisplayText(lastMessage);
		const statusIcon = this.getMessageStatusIcon(messageInfo.type, messageInfo.status);

		return `
			${statusIcon}
			<span>${messageInfo.text}</span>
		`;
	}
}
