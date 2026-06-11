export default class TemplateMessageRenderer {
	constructor() {
		this.modal = null;
	}

	parseTemplateContent(content) {
		if (!content) return null;

		try {
			const parsed = JSON.parse(content);
			if (parsed.template_name) {
				return parsed;
			}
		} catch (e) {
			return null;
		}
		return null;
	}

	isHtmlContent(content) {
		return /<[a-z][\s\S]*>/i.test(content);
	}

	extractDocumentFromHtml(html) {
		const urlMatch = html.match(/http[^<]+\.(pdf|jpg|jpeg|png|gif|webp)/i);
		const nameMatch = html.match(/<b>Document:<\/b>\s*([^<]+)/);
		if (urlMatch) {
			return {
				url: urlMatch[0],
				name: nameMatch ? nameMatch[1].trim() : urlMatch[0].split("/").pop() || "Document",
			};
		}
		return null;
	}

	extractImageFromHtml(html) {
		const urlMatch = html.match(/http[^<]+\.(jpg|jpeg|png|gif|webp)/i);
		return urlMatch ? urlMatch[0] : null;
	}

	extractButtonsFromHtml(html) {
		const buttons = [];
		const buttonMatches = html.match(/<a href='([^']+)'>([^<]+)<\/a>/g);
		if (buttonMatches) {
			for (const match of buttonMatches) {
				const urlMatch = match.match(/href='([^']+)'/);
				const textMatch = match.match(/>([^<]+)</);
				if (urlMatch && textMatch) {
					buttons.push({
						url: urlMatch[1],
						text: textMatch[1],
					});
				}
			}
		}
		return buttons;
	}

	extractBodyFromHtml(html) {
		const bodyMatch = html.match(/<b>Body:<\/b>\s*([^<]+)/);
		return bodyMatch ? bodyMatch[1] : "";
	}

	extractTitleFromHtml(html) {
		const titleMatch = html.match(
			/<div[^>]*font-size:14px;font-weight:600[^>]*>([^<]+)<\/div>/,
		);
		return titleMatch ? titleMatch[1] : "";
	}

	createModal(content, isImage = false, isPdf = false) {
		const existingModal = document.querySelector(".waba-template-modal");
		if (existingModal) {
			existingModal.remove();
		}

		const modal = document.createElement("div");
		modal.className = "waba-template-modal";
		modal.style.cssText = `
			position: fixed;
			inset: 0;
			z-index: 9999;
			background: rgba(0, 0, 0, 0.95);
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
		`;

		const contentWrapper = document.createElement("div");
		contentWrapper.style.cssText = `
			position: relative;
			max-width: 90vw;
			max-height: 90vh;
		`;

		const actionsDiv = document.createElement("div");
		actionsDiv.style.cssText = `
			position: absolute;
			top: 1rem;
			right: 1rem;
			display: flex;
			gap: 0.5rem;
			z-index: 10;
		`;

		const downloadBtn = document.createElement("a");
		downloadBtn.href = content;
		downloadBtn.download = "";
		downloadBtn.innerHTML = `
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
				<polyline points="7 10 12 15 17 10"/>
				<line x1="12" y1="15" x2="12" y2="3"/>
			</svg>
		`;
		downloadBtn.style.cssText = `
			padding: 0.5rem;
			background: rgba(0, 0, 0, 0.5);
			border-radius: 9999px;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
		`;

		const closeBtn = document.createElement("button");
		closeBtn.innerHTML = `
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		`;
		closeBtn.style.cssText = `
			padding: 0.5rem;
			background: rgba(0, 0, 0, 0.5);
			border-radius: 9999px;
			cursor: pointer;
			border: none;
			display: flex;
			align-items: center;
			justify-content: center;
		`;

		actionsDiv.appendChild(downloadBtn);
		actionsDiv.appendChild(closeBtn);

		if (isImage) {
			const img = document.createElement("img");
			img.src = content;
			img.style.cssText = `
				max-width: 90vw;
				max-height: 90vh;
				object-fit: contain;
			`;
			contentWrapper.appendChild(img);
		} else if (isPdf) {
			const iframe = document.createElement("iframe");
			iframe.src = `${content}#toolbar=0`;
			iframe.style.cssText = `
				width: 90vw;
				height: 90vh;
				border: none;
				background: white;
			`;
			contentWrapper.appendChild(iframe);
		}

		contentWrapper.appendChild(actionsDiv);
		modal.appendChild(contentWrapper);

		const closeModal = () => {
			modal.remove();
		};

		closeBtn.onclick = closeModal;
		modal.onclick = (e) => {
			if (e.target === modal) closeModal();
		};

		document.body.appendChild(modal);
	}

	renderJsonTemplate(template) {
		const container = document.createElement("div");
		container.className = "waba-template-container";
		container.style.cssText = "space-y-3";

		const bodyText = template.body_values?.filter((v) => v !== "-").join(" ") || "";
		const isImage = template.header?.type === "IMAGE";
		const isDocument = template.header?.type === "DOCUMENT";

		if (isImage && template.header?.url) {
			const imageContainer = this.createImageContainer(template.header.url);
			container.appendChild(imageContainer);
		}

		if (isDocument && template.header?.url) {
			const documentContainer = this.createDocumentContainer(
				template.header.url,
				template.header.filename,
			);
			container.appendChild(documentContainer);
		}

		if (bodyText) {
			const bodyDiv = document.createElement("div");
			bodyDiv.className = "waba-template-body";
			bodyDiv.style.cssText =
				"font-size: 13px; color: var(--wa-text-primary); margin-bottom: 12px;";
			bodyDiv.textContent = bodyText;
			container.appendChild(bodyDiv);
		}

		if (template.buttons && template.buttons.length) {
			const buttonsContainer = this.createButtonsContainer(template.buttons);
			container.appendChild(buttonsContainer);
		}

		return container;
	}

	createImageContainer(imageUrl) {
		const container = document.createElement("div");
		container.style.cssText = "margin-bottom: 12px;";

		const imgWrapper = document.createElement("div");
		imgWrapper.style.cssText = `
			position: relative;
			border-radius: 8px;
			overflow: hidden;
			cursor: pointer;
			background: #2a3942;
		`;

		const img = document.createElement("img");
		img.src = imageUrl;
		img.style.cssText = `
			width: 100%;
			max-height: 300px;
			object-fit: contain;
			border-radius: 8px;
		`;

		img.onload = () => {
			img.style.opacity = "1";
		};

		imgWrapper.appendChild(img);
		imgWrapper.onclick = () => this.createModal(imageUrl, true, false);
		container.appendChild(imgWrapper);

		return container;
	}

	createDocumentContainer(docUrl, filename) {
		const container = document.createElement("div");
		container.style.cssText = "margin-bottom: 12px;";

		const docWrapper = document.createElement("div");
		docWrapper.style.cssText = "background: #2a3942; border-radius: 8px; overflow: hidden;";

		const iframe = document.createElement("iframe");
		iframe.src = `${docUrl}#toolbar=0`;
		iframe.style.cssText = "width: 100%; height: 300px; border: none;";
		docWrapper.appendChild(iframe);

		const infoBar = document.createElement("div");
		infoBar.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 8px;
			background: #2a3942;
		`;

		const fileInfo = document.createElement("div");
		fileInfo.style.cssText = "display: flex; align-items: center; gap: 8px;";
		fileInfo.innerHTML = `
			<span style="font-size: 18px;">📄</span>
			<span style="font-size: 13px; color: white; max-width: 180px; overflow: hidden; text-overflow: ellipsis;">${filename || "Document"}</span>
		`;

		const actions = document.createElement("div");
		actions.style.cssText = "display: flex; gap: 8px;";

		const fullscreenBtn = document.createElement("button");
		fullscreenBtn.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
				<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
			</svg>
		`;
		fullscreenBtn.style.cssText = `
			padding: 4px 8px;
			background: #3b4a54;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		`;
		fullscreenBtn.onclick = () => this.createModal(docUrl, false, true);

		const downloadBtn = document.createElement("a");
		downloadBtn.href = docUrl;
		downloadBtn.download = "";
		downloadBtn.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
				<polyline points="7 10 12 15 17 10"/>
				<line x1="12" y1="15" x2="12" y2="3"/>
			</svg>
		`;
		downloadBtn.style.cssText = `
			padding: 4px 8px;
			background: #3b4a54;
			border-radius: 4px;
			display: inline-flex;
			text-decoration: none;
			cursor: pointer;
		`;

		actions.appendChild(fullscreenBtn);
		actions.appendChild(downloadBtn);
		infoBar.appendChild(fileInfo);
		infoBar.appendChild(actions);

		container.appendChild(docWrapper);
		container.appendChild(infoBar);

		return container;
	}

	createButtonsContainer(buttons) {
		const container = document.createElement("div");
		container.style.cssText = "margin-top: 12px;";

		for (const button of buttons) {
			let buttonElement;

			if (button.button_type === "Visit Website") {
				let cleanUrl = button.url || "";
				if (cleanUrl.includes("{{1}}")) {
					cleanUrl = cleanUrl.replace("{{1}}", "");
				}
				buttonElement = document.createElement("a");
				buttonElement.href = cleanUrl;
				buttonElement.target = "_blank";
				buttonElement.rel = "noopener noreferrer";
				buttonElement.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
						<polyline points="15 3 21 3 21 9"/>
						<line x1="10" y1="14" x2="21" y2="3"/>
					</svg>
					${button.button_label}
				`;
			} else if (button.button_type === "Call Phone") {
				buttonElement = document.createElement("a");
				buttonElement.href = `tel:${button.phone_number}`;
				buttonElement.innerHTML = `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
						<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.574 2.81.7A2 2 0 0 1 22 16.92z"/>
					</svg>
					${button.button_label}
				`;
			} else {
				buttonElement = document.createElement("button");
				buttonElement.disabled = true;
				buttonElement.textContent =
					button.button_type === "Flow"
						? `${button.button_label} (Flow)`
						: button.button_label;
			}

			buttonElement.style.cssText = `
				display: flex;
				align-items: center;
				justify-content: center;
				width: 100%;
				padding: 10px 16px;
				margin-bottom: 8px;
				background: #25D366;
				color: white;
				border: none;
				border-radius: 8px;
				font-size: 13px;
				font-weight: 500;
				text-decoration: none;
				cursor: pointer;
				transition: background 0.2s;
			`;

			if (!buttonElement.disabled) {
				buttonElement.onmouseenter = () => {
					buttonElement.style.background = "#20b859";
				};
				buttonElement.onmouseleave = () => {
					buttonElement.style.background = "#25D366";
				};
			} else {
				buttonElement.style.background = "#2a3942";
				buttonElement.style.color = "#aebac1";
				buttonElement.style.cursor = "not-allowed";
			}

			container.appendChild(buttonElement);
		}

		return container;
	}

	renderHtmlTemplate(htmlContent) {
		const container = document.createElement("div");
		container.className = "waba-template-container";
		container.style.cssText = "space-y-3";

		const title = this.extractTitleFromHtml(htmlContent);
		const body = this.extractBodyFromHtml(htmlContent);
		const imageUrl = this.extractImageFromHtml(htmlContent);
		const documentData = this.extractDocumentFromHtml(htmlContent);
		const buttons = this.extractButtonsFromHtml(htmlContent);

		if (title) {
			const titleDiv = document.createElement("div");
			titleDiv.style.cssText = `
				font-size: 13px;
				font-weight: 600;
				color: #25D366;
				border-bottom: 1px solid #2a3942;
				padding-bottom: 8px;
				margin-bottom: 12px;
			`;
			titleDiv.textContent = title;
			container.appendChild(titleDiv);
		}

		if (imageUrl) {
			const imageContainer = this.createImageContainer(imageUrl);
			container.appendChild(imageContainer);
		}

		if (documentData) {
			const documentContainer = this.createDocumentContainer(
				documentData.url,
				documentData.name,
			);
			container.appendChild(documentContainer);
		}

		if (body) {
			const bodyDiv = document.createElement("div");
			bodyDiv.style.cssText =
				"font-size: 13px; color: var(--wa-text-primary); margin-bottom: 12px;";
			bodyDiv.textContent = body;
			container.appendChild(bodyDiv);
		}

		if (buttons && buttons.length) {
			const buttonsContainer = this.createHtmlButtonsContainer(buttons);
			container.appendChild(buttonsContainer);
		}

		return container;
	}

	createHtmlButtonsContainer(buttons) {
		const container = document.createElement("div");
		container.style.cssText = "margin-top: 12px;";

		for (const button of buttons) {
			let cleanUrl = button.url;
			if (cleanUrl.includes("{{1}}")) {
				cleanUrl = cleanUrl.replace("{{1}}", "");
			}

			const buttonElement = document.createElement("a");
			buttonElement.href = cleanUrl;
			buttonElement.target = "_blank";
			buttonElement.rel = "noopener noreferrer";
			buttonElement.innerHTML = `
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
					<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
					<polyline points="15 3 21 3 21 9"/>
					<line x1="10" y1="14" x2="21" y2="3"/>
				</svg>
				${button.text}
			`;
			buttonElement.style.cssText = `
				display: flex;
				align-items: center;
				justify-content: center;
				width: 100%;
				padding: 10px 16px;
				margin-bottom: 8px;
				background: #25D366;
				color: white;
				border: none;
				border-radius: 8px;
				font-size: 13px;
				font-weight: 500;
				text-decoration: none;
				cursor: pointer;
				transition: background 0.2s;
			`;

			buttonElement.onmouseenter = () => {
				buttonElement.style.background = "#20b859";
			};
			buttonElement.onmouseleave = () => {
				buttonElement.style.background = "#25D366";
			};

			container.appendChild(buttonElement);
		}

		return container;
	}

	render(content) {
		if (!content) {
			const p = document.createElement("p");
			p.style.cssText = "font-size: 13px; line-height: 1.5; word-break: break-word;";
			p.textContent = "";
			return p;
		}

		const jsonTemplate = this.parseTemplateContent(content);
		const isHtml = !jsonTemplate && this.isHtmlContent(content);

		if (jsonTemplate) {
			return this.renderJsonTemplate(jsonTemplate);
		}

		if (isHtml) {
			return this.renderHtmlTemplate(content);
		}

		const p = document.createElement("p");
		p.style.cssText =
			"font-size: 13px; line-height: 1.5; word-break: break-word; white-space: pre-wrap;";
		p.textContent = content;
		return p;
	}
}
