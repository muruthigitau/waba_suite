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
		if (bodyMatch) {
			const parts = bodyMatch[1].split("|").map((p) => p.trim());
			return parts.filter((p) => p !== "-").join(" ");
		}
		return "";
	}

	static extractTemplateNameFromHtml(html) {
		if (!html) return "";

		const nameMatch = html.match(
			/<div[^>]*font-size:14px;font-weight:600[^>]*>([^<]+)<\/div>/,
		);
		return nameMatch ? nameMatch[1] : "";
	}

	static getPreviewText(content) {
		if (!content) return null;

		const jsonTemplate = this.parseTemplateContent(content);

		if (jsonTemplate) {
			const bodyText = jsonTemplate.body_values?.filter((v) => v !== "-").join(" ") || "";
			if (bodyText) {
				return bodyText;
			}
			return jsonTemplate.template_name;
		}

		const bodyText = this.extractBodyFromHtml(content);
		if (bodyText) {
			return bodyText;
		}

		const templateName = this.extractTemplateNameFromHtml(content);
		if (templateName) {
			return templateName;
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
			const shortText =
				previewText.length > 35 ? previewText.substring(0, 35) + "..." : previewText;
			return `${icon} ${shortText}`;
		}

		return `${icon} ${__("Template Message")}`;
	}
}
