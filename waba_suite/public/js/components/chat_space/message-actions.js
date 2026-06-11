export default class MessageActions {
	constructor(chatSpace, chatActions) {
		this.chatSpace = chatSpace;
		this.chatActions = chatActions;
	}

	showMessageActionPopup($row, messageId, messageContent) {
		this.dismissAllPopups();

		const isSent = $row.hasClass("waba-message-sent");
		const $bubble = $row
			.find(".waba-message-bubble-sent, .waba-message-bubble-received")
			.first();

		const fileTypes = ["image", "video", "audio", "document"];
		const isFile =
			fileTypes.includes(messageContent?.content_type) ||
			messageContent?.content?.startsWith("/files/") ||
			messageContent?.attach;
		const fileUrl = messageContent?.attach || messageContent?.content;

		let fileActionsHtml = "";
		if (isFile && fileUrl) {
			const showView = messageContent?.content_type !== "audio";
			fileActionsHtml = `
                ${
					showView
						? `
                <a href="${fileUrl}" target="_blank" class="waba-action-view" style="
                    padding: 10px 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 13px;
                    color: var(--wa-text-primary, #111b21);
                    text-decoration: none;
                    transition: background 0.1s;
                    border-bottom: 1px solid var(--wa-border);
                ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    ${__("View")}
                </a>
                `
						: ""
				}
                <a href="${fileUrl}" download class="waba-action-download" style="
                    padding: 10px 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 13px;
                    color: var(--wa-text-primary, #111b21);
                    text-decoration: none;
                    transition: background 0.1s;
                    border-bottom: 1px solid var(--wa-border);
                ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    ${__("Download")}
                </a>
            `;
		}

		const popup = $(`
            <div class="waba-msg-action-popup" style="
                position: absolute;
                ${isSent ? "right: 0;" : "left: 0;"}
                bottom: calc(100% + 8px);
                z-index: 300;
                display: flex;
                flex-direction: column;
                align-items: ${isSent ? "flex-end" : "flex-start"};
                gap: 6px;
                pointer-events: auto;
            ">
                <div class="waba-action-buttons" style="
                    background: var(--wa-bg-sidebar, #fff);
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    overflow: hidden;
                    min-width: 140px;
                    border: 1px solid var(--wa-border);
                ">
                    ${fileActionsHtml}
                    <div class="waba-action-react" style="
                        padding: 10px 16px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 13px;
                        color: var(--wa-text-primary, #111b21);
                        transition: background 0.1s;
                        border-bottom: 1px solid var(--wa-border);
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                            <line x1="9" y1="9" x2="9.01" y2="9"/>
                            <line x1="15" y1="9" x2="15.01" y2="9"/>
                        </svg>
                        ${__("React")}
                    </div>
                    <div class="waba-action-reply" style="
                        padding: 10px 16px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 13px;
                        color: var(--wa-text-primary, #111b21);
                        transition: background 0.1s;
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 17 4 12 9 7"/>
                            <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                        </svg>
                        ${__("Reply")}
                    </div>
                </div>
            </div>
        `);

		const self = this;
		let currentMessageId = messageId;

		popup
			.find(
				".waba-action-view, .waba-action-download, .waba-action-react, .waba-action-reply",
			)
			.on("mouseenter", function () {
				$(this).css("background", "var(--wa-hover, #f5f6f6)");
			})
			.on("mouseleave", function () {
				$(this).css("background", "");
			});

		popup.find(".waba-action-view, .waba-action-download").on("click", function () {
			self.dismissAllPopups();
		});

		popup.find(".waba-action-react").on("click", function (e) {
			e.stopPropagation();
			self.dismissAllPopups();
			self.chatActions.showSmallEmojiPicker((emoji) => {
				self.addReactionToMessage(currentMessageId, emoji);
			});
		});

		popup.find(".waba-action-reply").on("click", function (e) {
			e.stopPropagation();
			const fullMessage = self.chatSpace.messagesContainer.messages?.find(
				(msg) => msg.name === currentMessageId,
			);
			if (fullMessage) {
				self.chatActions.reply_to_message = fullMessage;
				self.chatActions.showReplyPreview(fullMessage);
				self.chatSpace.$chat_space.find(".waba-type-message").focus();
			}
			self.dismissAllPopups();
		});

		$bubble.css("position", "relative").append(popup);
	}

	addReactionToMessage(messageId, emoji) {
		const $messageRow = $(
			`.waba-message-received[data-message-id="${messageId}"], .waba-message-sent[data-message-id="${messageId}"]`,
		);
		const $messageElement = $messageRow.find(
			".waba-message-bubble-sent, .waba-message-bubble-received",
		);

		let $reactionsContainer = $messageElement.find(".waba-reactions-container");

		if ($reactionsContainer.length === 0) {
			$reactionsContainer = $(`<div class="waba-reactions-container" style="
                position: absolute;
                bottom: -16px;
                ${$messageRow.hasClass("waba-message-sent") ? "left: 8px;" : "right: 8px;"}
                display: flex;
                gap: 4px;
                z-index: 2;
            "></div>`);
			$messageElement.css("position", "relative").append($reactionsContainer);
		}

		const existingReaction = $reactionsContainer.find(`.waba-reaction[data-emoji="${emoji}"]`);

		if (existingReaction.length) {
			const $count = existingReaction.find(".waba-reaction-count");
			let count = parseInt($count.text()) || 1;
			count++;
			$count.text(count > 1 ? count : "");

			if (this.chatActions.sendReactionToMessage) {
				this.chatActions.sendReactionToMessage(messageId, emoji);
			}
		} else {
			const reactionHtml = `
                <div class="waba-reaction" data-emoji="${emoji}" style="
                    background: var(--wa-bg-sidebar, #fff);
                    border: 1px solid rgba(0,0,0,0.09);
                    border-radius: 20px;
                    padding: 2px 6px 2px 4px;
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    font-size: 14px;
                    cursor: pointer;
                    transition: transform 0.1s;
                ">
                    <span class="waba-reaction-emoji">${emoji}</span>
                    <span class="waba-reaction-count" style="font-size: 11px; color: var(--wa-text-secondary);"></span>
                </div>
            `;
			$reactionsContainer.append(reactionHtml);

			const $newReaction = $reactionsContainer.find(`.waba-reaction[data-emoji="${emoji}"]`);
			$newReaction.on("mouseenter", function () {
				$(this).css("transform", "scale(1.05)");
			});
			$newReaction.on("mouseleave", function () {
				$(this).css("transform", "scale(1)");
			});

			if (this.chatActions.sendReactionToMessage) {
				this.chatActions.sendReactionToMessage(messageId, emoji);
			}
		}
	}

	dismissAllPopups() {
		$(".waba-msg-action-popup").remove();
		$(".waba-small-emoji-picker-popup").remove();
		if (this.chatActions.emojiPickerInstance) {
			this.chatActions.emojiPickerInstance.destroy();
		}
	}
}
