export default class EmojiPicker {
	constructor(onEmojiSelect) {
		this.onEmojiSelect = onEmojiSelect;
		this.$element = null;
		this.categories = [];
		this.activeCategory = null;
		this.isScrolling = false;
		this.emojiData = null;
	}

	async init() {
		await this.loadEmojis();
		this.render();
		this.attachEvents();
	}

	async loadEmojis() {
		try {
			const response = await fetch("/assets/waba_suite/emojis.json");
			this.emojiData = await response.json();
			this.buildCategories();
		} catch (error) {
			console.error("Failed to load emojis:", error);
		}
	}

	buildCategories() {
		if (!this.emojiData) return;

		this.categories = [];
		const categoryKeys = Object.keys(this.emojiData).filter((key) => key !== "Reactions");

		for (const category of categoryKeys) {
			const emojis = this.emojiData[category];
			if (emojis && emojis.length) {
				this.categories.push({
					name: category,
					emojis: emojis,
				});
			}
		}
	}

	render() {
		this.$element = $(`
			<div class="waba-emoji-full-picker" style="
				position: absolute;
				bottom: 60px;
				left: 10px;
				width: 340px;
				background: var(--wa-bg-sidebar, #fff);
				border-radius: 16px;
				box-shadow: 0 4px 20px rgba(0,0,0,0.2);
				border: 1px solid var(--wa-border);
				z-index: 1200;
				overflow: hidden;
			">
				<div class="waba-emoji-categories" style="
					display: flex;
					flex-wrap: wrap;
					gap: 6px;
					padding: 10px;
					border-bottom: 1px solid var(--wa-border);
					background: var(--wa-bg-sidebar, #fff);
				">
					${this.categories
						.map(
							(cat) => `
						<button class="waba-category-btn" data-category="${cat.name}" style="
							padding: 4px 10px;
							background: transparent;
							color: var(--wa-text-secondary);
							border: none;
							border-radius: 20px;
							cursor: pointer;
							font-size: 11px;
							transition: all 0.2s;
						">${cat.name}</button>
					`,
						)
						.join("")}
				</div>
				<div class="waba-emoji-list" style="
					max-height: 240px;
					overflow-y: auto;
					padding: 10px;
				">
					${this.renderEmojiList()}
				</div>
			</div>
		`);
	}

	renderEmojiList() {
		let html = "";
		for (const category of this.categories) {
			html += `
				<div class="waba-emoji-category-section" data-category-id="${category.name}" style="margin-bottom: 16px;">
					<div style="
						font-size: 12px;
						font-weight: 600;
						color: var(--wa-text-secondary);
						padding: 4px 2px;
						margin-bottom: 8px;
						position: sticky;
						top: 0;
						background: var(--wa-bg-sidebar, #fff);
						z-index: 5;
					">${category.name}</div>
					<div class="waba-emoji-grid" style="
						display: flex;
						flex-wrap: wrap;
						gap: 6px;
					">
						${category.emojis
							.map(
								(emoji) => `
							<div class="waba-emoji-item" data-emoji="${emoji}" style="
								font-size: 24px;
								cursor: pointer;
								padding: 4px;
								text-align: center;
								border-radius: 8px;
								transition: all 0.2s;
								width: calc((100% - 36px) / 7);
								box-sizing: border-box;
							">${emoji}</div>
						`,
							)
							.join("")}
					</div>
				</div>
			`;
		}
		return html;
	}

	attachEvents() {
		const $list = this.$element.find(".waba-emoji-list");
		const $buttons = this.$element.find(".waba-category-btn");
		const self = this;

		$list.on("scroll", function () {
			if (self.isScrolling) return;

			const scrollTop = $(this).scrollTop();
			const sections = self.$element.find(".waba-emoji-category-section");

			let currentCategory = null;
			for (let i = 0; i < sections.length; i++) {
				const $section = $(sections[i]);
				const sectionTop = $section[0].offsetTop;

				if (sectionTop - 40 <= scrollTop) {
					currentCategory = $section.data("category-id");
				} else {
					break;
				}
			}

			if (currentCategory && currentCategory !== self.activeCategory) {
				self.activeCategory = currentCategory;
				$buttons.css({
					background: "transparent",
					color: "var(--wa-text-secondary)",
				});
				const $activeBtn = self.$element.find(
					`.waba-category-btn[data-category="${currentCategory}"]`,
				);
				$activeBtn.css({
					background: "var(--wa-primary)",
					color: "white",
				});
			}
		});

		$buttons.on("click", function (e) {
			e.stopPropagation();
			const category = $(this).data("category");
			self.activeCategory = category;

			$buttons.css({
				background: "transparent",
				color: "var(--wa-text-secondary)",
			});
			$(this).css({
				background: "var(--wa-primary)",
				color: "white",
			});

			const $targetSection = self.$element.find(
				`.waba-emoji-category-section[data-category-id="${category}"]`,
			);
			if ($targetSection.length) {
				self.isScrolling = true;
				const scrollPosition = $targetSection[0].offsetTop;
				$list.animate(
					{
						scrollTop: scrollPosition,
					},
					200,
					() => {
						self.isScrolling = false;
					},
				);
			}
		});

		this.$element
			.find(".waba-emoji-item")
			.on("mouseenter", function () {
				$(this).css("background", "var(--wa-hover, #f5f6f6)");
			})
			.on("mouseleave", function () {
				$(this).css("background", "");
			})
			.on("click", (e) => {
				e.stopPropagation();
				const emoji = $(e.currentTarget).data("emoji");
				if (self.onEmojiSelect) {
					self.onEmojiSelect(emoji);
				}
				self.hide();
			});
	}

	show() {
		if (!this.$element) return;
		const $chatActions = $(".waba-chat-actions");
		if ($chatActions.length) {
			$chatActions.append(this.$element);
		}
	}

	hide() {
		if (this.$element) {
			this.$element.remove();
		}
	}

	destroy() {
		this.hide();
	}
}
