$(document).on("app_ready", function () {
	frappe.router.on("change", () => {
		const route = frappe.get_route();

		if (route && route[0] === "Form") {
			frappe.ui.form.on(route[1], {
				refresh(frm) {
					frm.page.add_menu_item(__("Send To Whatsapp"), function () {
						const reference_doctype = frm.doctype;
						const reference_name = frm.docname;

						const partyDoctypeMap = {
							Customer: { mobile_field: "mobile_no" },
							Supplier: { mobile_field: "mobile_no" },
							User: { mobile_field: "mobile_no" },
							Contact: { mobile_field: "mobile_no" },
							"WhatsApp Contact": { mobile_field: "phone" },
							Lead: { mobile_field: "mobile_no" },
							Employee: { mobile_field: "cell_number" },
						};

						const dialog = new frappe.ui.Dialog({
							primary_action_label: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#25D366" style="display: inline-block; margin-right: 6px; vertical-align: middle;">
								<path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.45-4.45-9.9-9.91-9.9zm0 18.23c-1.5 0-2.97-.4-4.26-1.15l-.31-.18-3.11.82.83-3.04-.2-.32c-.81-1.32-1.24-2.84-1.24-4.39 0-4.56 3.71-8.27 8.28-8.27 4.56 0 8.27 3.71 8.27 8.27.01 4.56-3.7 8.26-8.26 8.26zm4.53-6.18c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.24-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.12-1.06-.39-2.02-1.25-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.76-1.85-.2-.49-.41-.43-.56-.43-.15 0-.32-.01-.49-.01-.17 0-.45.06-.68.31-.23.25-.88.86-.88 2.11 0 1.25.91 2.45 1.04 2.62.13.17 1.76 2.7 4.28 3.76.6.25 1.08.4 1.45.51.61.19 1.17.17 1.61.1.49-.06 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29z"/>
							</svg>
							<span style="vertical-align: middle;">Send WhatsApp</span>`,
							title: "Send WhatsApp Message",
							fields: [
								{
									fieldname: "party_type",
									label: "Send To Type",
									fieldtype: "Select",
									reqd: 0,
									options: Object.keys(partyDoctypeMap).join("\n"),
									change() {
										dialog.set_value("party", "");
										dialog.set_value("mobile_no", "");
									},
								},
								{
									fieldtype: "Column Break",
								},
								{
									fieldname: "party",
									label: "Send To",
									fieldtype: "Dynamic Link",
									options: "party_type",
									reqd: 0,
									change() {
										fetch_mobile();
									},
								},
								{
									fieldtype: "Section Break",
									label: "Template Details",
								},
								{
									fieldname: "whatsapp_account",
									label: "WhatsApp Account",
									fieldtype: "Link",
									options: "WhatsApp Account",
									reqd: 1,
								},
								{
									fieldname: "template",
									label: "WhatsApp Template",
									fieldtype: "Link",
									options: "WhatsApp Templates",
									reqd: 1,
								},
								{
									fieldname: "mobile_no",
									label: "Mobile No",
									fieldtype: "Data",
									reqd: 1,
									read_only: 0,
								},
							],
							primary_action_label: "Send WhatsApp",
							primary_action(values) {
								if (!values) return;

								frappe.call({
									method: "waba_suite.waba_suite.doctype.whatsapp_message.whatsapp_message.send_template",
									args: {
										to: values.mobile_no,
										template: values.template,
										reference_doctype,
										reference_name,
										whatsapp_account: values.whatsapp_account,
									},
									freeze: true,
									callback: () => {
										frappe.msgprint(
											__("Template sent to: " + values.mobile_no),
										);

										dialog.hide();

										frappe.call({
											method: "frappe.desk.form.utils.add_comment",
											args: {
												reference_doctype,
												reference_name,
												content:
													"WhatsApp Template sent\nTo: " +
													values.mobile_no +
													"\nTemplate: " +
													values.template,
												comment_by: frappe.session.user_fullname,
												comment_email: frappe.session.user,
											},
										});
									},
								});
							},
							no_submit_on_enter: true,
						});

						function fetch_mobile() {
							const partyType = dialog.get_value("party_type");
							const party = dialog.get_value("party");

							if (!partyType || !party) return;

							const config = partyDoctypeMap[partyType];

							frappe.call({
								method: "frappe.client.get",
								args: {
									doctype: partyType,
									name: party,
								},
								callback(r) {
									if (!r.message) return;

									const doc = r.message;

									let mobile =
										doc[config.mobile_field] ||
										doc.mobile_no ||
										doc.phone ||
										doc.phone_number ||
										doc.mobile ||
										doc.cell_number ||
										"";

									dialog.set_value("mobile_no", mobile || "");

									if (!mobile) {
										frappe.msgprint(__("No mobile number found."));
									}
								},
							});
						}

						dialog.show();
					});
				},
			});
		}
	});
});
