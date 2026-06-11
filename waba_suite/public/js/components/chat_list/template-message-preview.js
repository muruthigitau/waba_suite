export default class TemplateMessagePreview {
	static parseTemplateContent(content) {
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

	static extractBodyFromHtml(html) {
		if (!html) return "";

		const bodyMatch = html.match(/<b>Body:<\/b>\s*([^<]+)/);
		return bodyMatch ? bodyMatch[1] : "";
	}

	static getPreviewText(content) {
		if (!content) return null;

		const jsonTemplate = this.parseTemplateContent(content);

		if (jsonTemplate) {
			const bodyText = jsonTemplate.body_values?.filter((v) => v !== "-").join(" ") || "";
			if (bodyText) {
				return bodyText;
			}
			return `${jsonTemplate.template_name}`;
		}

		const htmlBody = this.extractBodyFromHtml(content);
		if (htmlBody) {
			return htmlBody;
		}

		return null;
	}

	static getIcon() {
		return "📨";
	}

	static renderPreview(content) {
		if (!content) {
			return `${this.getIcon()} ${__("Template Message")}`;
		}

		const previewText = this.getPreviewText(content);
		const icon = this.getIcon();

		if (previewText) {
			return `${icon} ${previewText}`;
		}

		return `${icon} ${__("Template Message")}`;
	}
}
