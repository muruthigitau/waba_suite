export class ChatSearch {
	constructor(onSearch) {
		this.onSearch = onSearch;
		this.$element = null;
	}

	render() {
		if (this.$element && this.$element.parent().length) {
			return this.$element;
		}

		const html = `
			<div class='waba-chat-search'>
				<div class='waba-search-input-group'>
					<span class='waba-search-icon'>${frappe.utils.icon("search", "sm")}</span>
					<input class='form-control waba-chat-search-box' type='search' 
					       placeholder='${__("Search or start new chat")}'>  
				</div>
			</div>
		`;
		this.$element = $(html);
		this.attachEvents();
		return this.$element;
	}

	attachEvents() {
		this.$element
			.find(".waba-chat-search-box")
			.off("input")
			.on("input", (e) => {
				this.onSearch($(e.target).val().toLowerCase());
			});
	}

	getValue() {
		return this.$element?.find(".waba-chat-search-box").val() || "";
	}
}
