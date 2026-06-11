import TemplateMessageRenderer from "./template-message-renderer.js";

export default class MessageRenderer {
	constructor(chatSpace) {
		this.chatSpace = chatSpace;
		this.templateRenderer = new TemplateMessageRenderer();
	}

	getRepliedMessage(reply_to_message_id, messages) {
		if (!reply_to_message_id) return null;

		const replied_msg = messages?.find((msg) => msg.name === reply_to_message_id);
		if (!replied_msg) return null;

		let replied_content = this.getRepliedContent(replied_msg);
		let replied_sender = this.getRepliedSender(replied_msg);

		return {
			content: replied_content,
			sender: replied_sender,
			message_id: reply_to_message_id,
			content_type: replied_msg.content_type,
		};
	}

	getRepliedContent(msg) {
		const contentTypes = {
			image: "📷 " + __("Image"),
			video: "🎥 " + __("Video"),
			audio: "🎵 " + __("Audio"),
			document: "📄 " + __("Document"),
			location: "📍 " + __("Location"),
			contact: "👤 " + __("Contact"),
			reaction: "😊 " + __("Reaction"),
			flow: "📋 " + __("Form"),
			button: "🔘 " + __("Button"),
			interactive: "💬 " + __("Interactive Message"),
			template: "📨 " + __("Template Message"),
		};

		if (contentTypes[msg.content_type]) {
			return contentTypes[msg.content_type];
		}

		let content = msg.content || msg.message || "";
		if (content.length > 100) {
			content = content.substring(0, 100) + "...";
		}
		return content;
	}

	getRepliedSender(msg) {
		let sender = msg.sender_user_no || msg.from || "Unknown";

		if (sender === this.chatSpace.profile.user_email) {
			return __("You");
		}
		if (msg.profile_name) return msg.profile_name;
		if (msg.contact_name) return msg.contact_name;
		return sender;
	}

	getMessageStatusIcon(status, type) {
		if (type !== "Outgoing") return "";

		const statusMap = {
			draft: `<svg class="waba-msg-status waba-status-draft" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
			sent: `<svg class="waba-msg-status waba-status-sent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" stroke-width="2"><path d="M20 6L9 17L4 12"/></svg>`,
			delivered: `<svg class="waba-msg-status waba-status-delivered" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#8696A0" stroke-width="2"><path d="M20 6L9 17L4 12"/><path d="M26 6L15 17L10 12"/></svg>`,
			read: `<svg class="waba-msg-status waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2"><path d="M20 6L9 17L4 12"/><path d="M26 6L15 17L10 12"/></svg>`,
			failed: `<svg class="waba-msg-status waba-status-failed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
			marked_as_read: `<svg class="waba-msg-status waba-status-read" width="24" height="16" viewBox="0 0 32 24" fill="none" stroke="#25D366" stroke-width="2"><path d="M20 6L9 17L4 12"/><path d="M26 6L15 17L10 12"/></svg>`,
		};

		return statusMap[status] || statusMap["sent"];
	}

	getTemplateContent(message) {
		if (message.is_template || message.use_template === 1) {
			if (message.message && message.message !== "null" && message.message !== null) {
				return message.message;
			}
			if (message.content && message.content !== "null" && message.content !== null) {
				return message.content;
			}
			if (message.template_data) {
				return message.template_data;
			}
		}
		return null;
	}

	makeMessage(
		content,
		time,
		type,
		name,
		caption,
		status,
		messageType,
		messageId,
		repliedMessage,
		replyToMessageId,
		contentType = "text",
		attach = null,
		locationData = null,
		contactData = null,
		buttonData = null,
		interactiveData = null,
		reactions = null,
		isTemplate = false,
		templateName = null,
		messageObj = null,
	) {
		const message_class = type === "recipient" ? "waba-message-sent" : "waba-message-received";
		const bubble_class =
			type === "recipient" ? "waba-message-bubble-sent" : "waba-message-bubble-received";

		const $recipient_element = $(document.createElement("div")).addClass(message_class);

		if (messageId) $recipient_element.attr("data-message-id", messageId);
		if (replyToMessageId) $recipient_element.attr("data-reply-to", replyToMessageId);

		const $message_element = $(document.createElement("div")).addClass(bubble_class);
		$message_element.css("position", "relative");

		if (repliedMessage) {
			$message_element.append(this.makeReplyIndicator(repliedMessage));
		}

		const $name_element = $(document.createElement("div"))
			.addClass("waba-message-name")
			.text(name);

		let templateContent = null;
		if (
			isTemplate ||
			contentType === "template" ||
			(messageObj && (messageObj.is_template || messageObj.use_template === 1))
		) {
			templateContent = this.getTemplateContent(
				messageObj || {
					content,
					is_template: isTemplate,
					use_template: isTemplate ? 1 : 0,
				},
			);
		}

		const $sanitized_content = this.makeContent(
			content,
			contentType,
			attach,
			caption,
			locationData,
			contactData,
			buttonData,
			interactiveData,
			type,
			isTemplate,
			templateName,
			templateContent,
		);

		if (type === "sender" && this.chatSpace.profile.room_type === "Group") {
			$message_element.append($name_element);
		}
		$message_element.append($sanitized_content);

		const statusIcon = this.getMessageStatusIcon(status, messageType);
		$message_element.append(`
			<div class="waba-message-meta" style="display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 3px;">
				<span style="font-size: 11px; color: var(--wa-text-light);">${__(time)}</span>
				${statusIcon}
			</div>
		`);

		const reactionsHtml = this.buildReactionBubblesHtml(reactions, type);
		if (reactionsHtml) {
			$message_element.append(reactionsHtml);
		}

		$recipient_element.append($message_element);

		if (reactions?.length > 0) {
			$recipient_element.css("margin-bottom", "14px");
		}

		return $recipient_element;
	}

	makeReplyIndicator(repliedMessage) {
		let replyContent = repliedMessage.content;

		if (repliedMessage.content_type !== "text") {
			const typeIcons = {
				image: "📷 " + __("Image"),
				video: "🎥 " + __("Video"),
				audio: "🎵 " + __("Audio"),
				document: "📄 " + __("Document"),
				location: "📍 " + __("Location"),
				contact: "👤 " + __("Contact"),
				reaction: "😊 " + __("Reaction"),
				flow: "📋 " + __("Form"),
				button: "🔘 " + __("Button"),
				interactive: "💬 " + __("Interactive Message"),
				template: "📨 " + __("Template Message"),
			};
			replyContent = typeIcons[repliedMessage.content_type] || replyContent;
		}

		return $(`
			<div class="waba-reply-indicator" style="background: var(--wa-bg-search); border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; border-left: 3px solid var(--wa-primary); font-size: 12px;">
				<div style="font-weight: 600; color: var(--wa-primary); margin-bottom: 2px; font-size: 11px;">${__("Replying to {0}", [repliedMessage.sender])}</div>
				<div style="color: var(--wa-text-secondary); word-break: break-word; font-size: 12px;">${replyContent}</div>
			</div>
		`);
	}

	makeContent(
		content,
		contentType,
		attach,
		caption,
		locationData,
		contactData,
		buttonData,
		interactiveData,
		type,
		isTemplate = false,
		templateName = null,
		templateContent = null,
	) {
		const $content = $(document.createElement("div"));

		if (isTemplate || contentType === "template") {
			let templateData = templateContent || content;

			if (!templateData || templateData === "null" || templateData === null) {
				$content.html(`
					<div class="waba-template-placeholder" style="padding: 12px; background: var(--wa-bg-sidebar); border-radius: 8px;">
						<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
							<span style="font-size: 20px;">📨</span>
							<span style="font-weight: 600;">${__("Template Message")}</span>
						</div>
						<div style="font-size: 12px; color: var(--wa-text-secondary);">${templateName ? __("Template: {0}", [templateName]) : __("Loading...")}</div>
					</div>
				`);
			} else {
				try {
					const templateElement = this.templateRenderer.render(templateData);
					$content.html(templateElement.outerHTML);
				} catch (error) {
					console.error("Failed to render template:", error);
					$content.html(`
						<div class="waba-template-error" style="padding: 12px; background: var(--wa-bg-sidebar); border-radius: 8px; color: #FF3B30;">
							${__("Failed to load template")}
						</div>
					`);
				}
			}
			return $content;
		}

		switch (contentType) {
			case "image":
				$content.html(`
					<img src='${attach || content}' class='waba-chat-image' style='max-width: 250px; max-height: 250px; border-radius: 12px; cursor: pointer;' onclick='window.open("${attach || content}", "_blank")'>
					${caption ? `<div class='waba-message-caption'>${__(caption)}</div>` : ""}
				`);
				break;
			case "video":
				$content.html(`
					<video controls style='max-width: 250px; max-height: 250px; border-radius: 12px;'>
						<source src='${attach || content}' type='video/mp4'>
					</video>
					${caption ? `<div class='waba-message-caption'>${__(caption)}</div>` : ""}
				`);
				break;
			case "audio":
				$content.html(`
					<audio controls style='width: 200px;'>
						<source src='${attach || content}'>
					</audio>
					${caption ? `<div class='waba-message-caption'>${__(caption)}</div>` : ""}
				`);
				break;
			case "document":
				const fileName = content?.split("/").pop() || __("Document");
				$content.html(`
					<div class='waba-file-message' style='display: flex; align-items: center; gap: 10px;'>
						<span style='font-size: 24px;'>📄</span>
						<div style='flex: 1;'>
							<div style='font-weight: 500; margin-bottom: 2px;'>${__(fileName)}</div>
							<a href='${attach || content}' target='_blank' style='color: var(--wa-primary); text-decoration: none; font-size: 12px;'>${__("Download")}</a>
						</div>
					</div>
					${caption ? `<div class='waba-message-caption'>${__(caption)}</div>` : ""}
				`);
				break;
			case "location":
				$content.html(this.renderLocationMessage(locationData || content));
				break;
			case "contact":
				$content.html(this.renderContactMessage(contactData || content));
				break;
			case "button":
				$content.html(
					`<div>${content || ""}</div>${this.renderButtonMessage(buttonData || content)}`,
				);
				break;
			case "interactive":
				$content.html(this.renderInteractiveMessage(interactiveData || content));
				break;
			default:
				if (content?.startsWith("/files/")) {
					const fileName = content.split("/").pop();
					if (this.isImageFile(fileName)) {
						$content.html(
							`<img src='${content}' class='waba-chat-image' style='max-width: 250px; max-height: 250px; border-radius: 12px; cursor: pointer;' onclick='window.open("${content}", "_blank")'>`,
						);
					} else {
						const fileIcon = this.getFileIcon(fileName);
						$content.html(`
							<div class='waba-file-message' style='display: flex; align-items: center; gap: 10px;'>
								<span style='font-size: 24px;'>${fileIcon}</span>
								<div style='flex: 1;'>
									<div style='font-weight: 500; margin-bottom: 2px;'>${__(fileName)}</div>
									<a href='${content}' target='_blank' style='color: var(--wa-primary); text-decoration: none; font-size: 12px;'>${__("Download")}</a>
								</div>
							</div>
						`);
					}
				} else {
					$content.text(content || "");
				}
				break;
		}

		return $content;
	}

	renderLocationMessage(locationData) {
		if (!locationData) return `<div>${__("Location shared")}</div>`;
		try {
			const location =
				typeof locationData === "string" ? JSON.parse(locationData) : locationData;
			const mapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
			return `
				<div class='waba-location-message' style='display: flex; align-items: flex-start; gap: 12px;'>
					<span style='font-size: 24px;'>📍</span>
					<div style='flex: 1;'>
						<div style='font-weight: 500; margin-bottom: 4px;'>${__("Location")}</div>
						<div style='font-size: 12px; color: var(--wa-text-secondary); margin-bottom: 8px;'>${location.name || ""}</div>
						<a href='${mapsUrl}' target='_blank' style='color: var(--wa-primary); text-decoration: none; font-size: 12px;'>${__("View on Map")}</a>
					</div>
				</div>
			`;
		} catch (e) {
			return `<div>${__("Location shared")}</div>`;
		}
	}

	renderContactMessage(contactData) {
		if (!contactData) return `<div>${__("Contact shared")}</div>`;
		try {
			const contact =
				typeof contactData === "string" ? JSON.parse(contactData) : contactData;
			return `
				<div class='waba-contact-message' style='display: flex; align-items: flex-start; gap: 12px;'>
					<span style='font-size: 24px;'>👤</span>
					<div style='flex: 1;'>
						<div style='font-weight: 500; margin-bottom: 4px;'>${contact.name || ""}</div>
						${contact.phones ? contact.phones.map((phone) => `<div style='font-size: 12px; color: var(--wa-text-secondary); margin-bottom: 4px;'>${phone.phone} ${phone.type ? `(${phone.type})` : ""}</div>`).join("") : ""}
						${contact.emails ? contact.emails.map((email) => `<div style='font-size: 12px; color: var(--wa-text-secondary);'>${email.email} ${email.type ? `(${email.type})` : ""}</div>`).join("") : ""}
					</div>
				</div>
			`;
		} catch (e) {
			return `<div>${__("Contact shared")}</div>`;
		}
	}

	renderButtonMessage(buttonData) {
		if (!buttonData) return null;
		try {
			const buttons = typeof buttonData === "string" ? JSON.parse(buttonData) : buttonData;
			return `
				<div class='waba-buttons-message' style='margin-top: 8px;'>
					${buttons
						.map(
							(button) => `
						<button class='waba-interactive-button' data-button-id='${button.id}' style='display: block; width: 100%; margin-top: 8px; padding: 8px 12px; background: var(--wa-primary-light); border: none; border-radius: 8px; color: var(--wa-primary); font-weight: 500; cursor: pointer; text-align: center;'>${button.text}</button>
					`,
						)
						.join("")}
				</div>
			`;
		} catch (e) {
			return null;
		}
	}

	renderInteractiveMessage(interactiveData) {
		if (!interactiveData) return null;
		try {
			const interactive =
				typeof interactiveData === "string"
					? JSON.parse(interactiveData)
					: interactiveData;
			let html = `<div class='waba-interactive-message'>`;
			if (interactive.header)
				html += `<div style='font-weight: 600; margin-bottom: 8px;'>${interactive.header}</div>`;
			if (interactive.body)
				html += `<div style='margin-bottom: 12px;'>${interactive.body}</div>`;
			if (interactive.footer)
				html += `<div style='font-size: 11px; color: var(--wa-text-light); margin-bottom: 12px;'>${interactive.footer}</div>`;
			if (interactive.buttons?.length) {
				html += `<div class='waba-interactive-buttons' style='margin-top: 8px;'>
					${interactive.buttons.map((button) => `<button class='waba-interactive-button' data-button-id='${button.id}' style='display: block; width: 100%; margin-top: 8px; padding: 8px 12px; background: var(--wa-primary-light); border: none; border-radius: 8px; color: var(--wa-primary); font-weight: 500; cursor: pointer; text-align: center;'>${button.text}</button>`).join("")}
				</div>`;
			}
			html += `</div>`;
			return html;
		} catch (e) {
			return null;
		}
	}

	buildReactionBubblesHtml(reactions, type) {
		if (!reactions?.length) return "";

		const isSent = type === "recipient";
		let bubblesHtml = "";

		reactions.forEach((reaction) => {
			if (reaction?.emoji) {
				const emoji = reaction.emoji;
				const count = reaction.count || 1;
				bubblesHtml += `
					<div class="waba-reaction-bubble" style="position: absolute; bottom: -12px; ${isSent ? "left: 8px;" : "right: 8px;"} background: var(--wa-bg-sidebar, #fff); border: 1px solid rgba(0,0,0,0.09); border-radius: 20px; padding: 1px 6px 1px 4px; display: inline-flex; align-items: center; gap: 2px; box-shadow: 0 1px 4px rgba(0,0,0,0.13); font-size: 14px; z-index: 3; cursor: default; white-space: nowrap; min-width: 28px; justify-content: center;">
						<span class="waba-reaction-bubble-emoji">${emoji}</span>
						<span class="waba-reaction-bubble-count" data-count="${count}" style="font-size: 11px; color: var(--wa-text-secondary, #667781); line-height: 1;">${count > 1 ? count : ""}</span>
					</div>
				`;
			}
		});

		return bubblesHtml;
	}

	isImageFile(filename) {
		const ext = filename.split(".").pop().toLowerCase();
		return ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext);
	}

	getFileIcon(filename) {
		const ext = filename.split(".").pop().toLowerCase();
		const icons = {
			pdf: "📄",
			doc: "📘",
			docx: "📘",
			xls: "📊",
			xlsx: "📊",
			ppt: "📽️",
			pptx: "📽️",
			zip: "🗜️",
			rar: "🗜️",
			txt: "📝",
			mp3: "🎵",
			mp4: "🎬",
			avi: "🎬",
			mov: "🎬",
		};
		return icons[ext] || "📎";
	}
}
