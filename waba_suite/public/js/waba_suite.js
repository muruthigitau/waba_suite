$(document).on("app_ready", function () {
	frappe.router.on("change", () => {
		const route = frappe.get_route();

		if (route && route[0] === "Form") {
			frappe.ui.form.on(route[1], {
				refresh(frm) {
					frm.page.add_menu_item(__("Send To Whatsapp"), function () {
						const reference_doctype = frm.doctype;
						const reference_name = frm.docname;
						const current_doc = frm.doc;

						function getMobileFromDoc(doc) {
							const mobileFields = [
								"mobile_no",
								"phone",
								"phone_number",
								"mobile",
								"cell_number",
								"whatsapp_number",
								"contact_mobile",
								"mobile_number",
								"primary_mobile",
								"whatsapp_no",
							];

							for (let field of mobileFields) {
								if (doc[field]) {
									return doc[field];
								}
							}
							return null;
						}

						function getLinkedParty(doc) {
							const partyFields = [
								{ field: "customer", doctype: "Customer" },
								{ field: "supplier", doctype: "Supplier" },
								{ field: "lead", doctype: "Lead" },
								{ field: "employee", doctype: "Employee" },
								{ field: "user", doctype: "User" },
								{ field: "contact_person", doctype: "Contact" },
								{ field: "party_name", doctype: null },
								{ field: "customer_name", doctype: "Customer" },
								{ field: "supplier_name", doctype: "Supplier" },
							];

							for (let party of partyFields) {
								if (doc[party.field]) {
									let doctype = party.doctype;
									if (
										!doctype &&
										party.field === "party_name" &&
										doc.party_type
									) {
										doctype = doc.party_type;
									}
									if (doctype) {
										return { doctype: doctype, name: doc[party.field] };
									}
								}
							}
							return null;
						}

						function getMobileFromLinkedParty(party, callback) {
							if (!party || !party.name) {
								callback(null);
								return;
							}

							frappe.call({
								method: "frappe.client.get",
								args: {
									doctype: party.doctype,
									name: party.name,
								},
								callback(r) {
									if (r.message) {
										const mobile = getMobileFromDoc(r.message);
										callback(mobile);
									} else {
										callback(null);
									}
								},
							});
						}

						const partyDoctypeMap = {
							Customer: { mobile_field: "mobile_no" },
							Supplier: { mobile_field: "mobile_no" },
							User: { mobile_field: "mobile_no" },
							Contact: { mobile_field: "mobile_no" },
							"WhatsApp Contact": { mobile_field: "phone" },
							Lead: { mobile_field: "mobile_no" },
							Employee: { mobile_field: "cell_number" },
						};

						let autoMobile = getMobileFromDoc(current_doc);
						let autoPartyType = null;
						let autoParty = null;

						if (!autoMobile) {
							const linkedParty = getLinkedParty(current_doc);
							if (linkedParty) {
								autoPartyType = linkedParty.doctype;
								autoParty = linkedParty.name;
								getMobileFromLinkedParty(linkedParty, function (mobile) {
									if (mobile) {
										autoMobile = mobile;
									}
									openDialog();
								});
							} else {
								openDialog();
							}
						} else {
							openDialog();
						}

						function openDialog() {
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
											if (dialog.get_value("party")) {
												fetch_mobile();
											}
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
										onchange: function () {
											const template = dialog.get_value("template");
											if (template) {
												frappe.call({
													method: "frappe.client.get",
													args: {
														doctype: "WhatsApp Templates",
														name: template,
													},
													callback: function (r) {
														if (
															r.message &&
															r.message.header_type === "DOCUMENT"
														) {
															dialog.set_df_property(
																"print_format",
																"hidden",
																0,
															);
															if (r.message.print_format) {
																dialog.set_value(
																	"print_format",
																	r.message.print_format,
																);
															}
														} else {
															dialog.set_df_property(
																"print_format",
																"hidden",
																1,
															);
															dialog.set_value("print_format", "");
														}
														dialog.refresh();
													},
												});
											} else {
												dialog.set_df_property(
													"print_format",
													"hidden",
													1,
												);
												dialog.set_value("print_format", "");
												dialog.refresh();
											}
										},
									},
									{
										fieldname: "print_format",
										label: "Print Format",
										fieldtype: "Link",
										options: "Print Format",
										reqd: 0,
										hidden: 1,
										get_query: function () {
											return {
												filters: {
													doc_type: reference_doctype,
												},
											};
										},
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

									let args = {
										to: values.mobile_no,
										template: values.template,
										reference_doctype: reference_doctype,
										reference_name: reference_name,
										whatsapp_account: values.whatsapp_account,
									};

									if (values.print_format) {
										args.print_format = values.print_format;
									}

									frappe.call({
										method: "waba_suite.waba_suite.doctype.whatsapp_message.whatsapp_message.send_template",
										args: args,
										freeze: true,
										callback: function (response) {
											if (response.message) {
												frappe.msgprint(
													__("Template sent to: " + values.mobile_no),
												);
												dialog.hide();
												frappe.call({
													method: "frappe.desk.form.utils.add_comment",
													args: {
														reference_doctype: reference_doctype,
														reference_name: reference_name,
														content:
															"WhatsApp Template sent\nTo: " +
															values.mobile_no +
															"\nTemplate: " +
															values.template,
														comment_by: frappe.session.user_fullname,
														comment_email: frappe.session.user,
													},
												});
											}
										},
									});
								},
								no_submit_on_enter: true,
							});

							function fetch_mobile() {
								const partyType = dialog.get_value("party_type");
								const party = dialog.get_value("party");

								if (!partyType || !party) return;

								frappe.call({
									method: "frappe.client.get",
									args: {
										doctype: partyType,
										name: party,
									},
									callback(r) {
										if (!r.message) return;
										let mobile = getMobileFromDoc(r.message);
										dialog.set_value("mobile_no", mobile || "");
										if (!mobile) {
											frappe.msgprint(__("No mobile number found."));
										}
									},
								});
							}

							dialog.show();

							if (autoPartyType) {
								dialog.set_value("party_type", autoPartyType);
								setTimeout(() => {
									if (autoParty) {
										dialog.set_value("party", autoParty);
										setTimeout(() => {
											if (autoMobile) {
												dialog.set_value("mobile_no", autoMobile);
											}
										}, 200);
									}
								}, 200);
							} else if (autoMobile) {
								setTimeout(() => {
									dialog.set_value("mobile_no", autoMobile);
								}, 200);
							}
						}
					});
				},
			});
		}
	});
});
