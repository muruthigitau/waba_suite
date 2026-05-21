export default class ChatAccountSwitcher {
	constructor(opts) {
		this.currentAccount = opts.currentAccount;
		this.onAccountChange = opts.onAccountChange;
		this.setup();
	}

	async setup() {
		this.accountDialog = new frappe.ui.Dialog({
			title: __("Switch WhatsApp Account"),
			fields: [
				{
					fieldname: "account_selector",
					fieldtype: "HTML",
					options: `<div class="text-center" style="padding: 20px;">${__("Loading accounts...")}</div>`,
				},
			],
			primary_action_label: __("Switch Account"),
			primary_action: async () => {
				const selectedAccount = this.accountDialog.$wrapper
					.find('input[name="account_radio"]:checked')
					.val();

				if (!selectedAccount) {
					frappe.msgprint(__("Please select an account"));
					return;
				}

				if (selectedAccount === this.currentAccount) {
					this.accountDialog.hide();
					return;
				}

				frappe.dom.freeze(__("Switching..."));
				try {
					const res = await frappe.call({
						method: "waba_suite.api.accounts.switch_account",
						args: { account_name: selectedAccount },
					});

					if (res.message && res.message.success) {
						this.currentAccount = selectedAccount;
						this.onAccountChange(selectedAccount, res.message.account.account_name);
						this.accountDialog.hide();
					}
				} finally {
					frappe.dom.unfreeze();
				}
			},
		});
	}

	async show() {
		this.accountDialog.show();
		const data = await frappe.call("waba_suite.api.accounts.get_user_accounts_with_default");
		const accounts = data.message.accounts || [];

		let html = `<div class='waba-account-switcher-list' style='max-height: 400px; overflow-y: auto;'>`;

		if (accounts.length === 0) {
			html = `<div class="alert alert-warning">${__("No active WhatsApp accounts assigned to you.")}</div>`;
		} else {
			accounts.forEach((acc) => {
				const isCurrent = acc.name === this.currentAccount;
				html += `
          <div class="waba-account-row" style="border: 1px solid var(--border-color); border-radius: 10px; margin-bottom: 8px; transition: all 0.2s;">
            <label style="display: flex; align-items: center; padding: 12px 14px; margin: 0; cursor: pointer; width: 100%;">
              <input type="radio" name="account_radio" class="waba-account-radio" value="${acc.name}" ${isCurrent ? "checked" : ""}>
              <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 14px;">${acc.account_name}</div>
                <div style="font-size: 11px; color: var(--text-muted);">ID: ${acc.phone_id}</div>
              </div>
              ${acc.is_default ? `<span class="badge" style="background: #25D366; color: #fff; font-size: 10px; margin-left: 10px; padding: 2px 8px; border-radius: 20px;">${__("Default")}</span>` : ""}
            </label>
          </div>
        `;
			});
		}

		html += `</div>`;
		this.accountDialog.get_field("account_selector").$wrapper.html(html);
	}
}
