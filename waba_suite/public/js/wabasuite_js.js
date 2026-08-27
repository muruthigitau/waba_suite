/**
 * WABA JS - Compact WhatsApp Integration Module
 *
 * Provides "Send To Whatsapp" menu item on Frappe forms with
 * preview capability before sending template messages.
 *
 * Key dependencies:
 *   - frappe: ERPNext framework
 *   - waba_suite.api.template_preview.preview_template: Preview and send API
 */

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
              const fields = [
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
              for (let f of fields) if (doc[f]) return doc[f];
              return null;
            }

            function getLinkedParty(doc) {
              const map = [
                { field: "customer", dt: "Customer" },
                { field: "supplier", dt: "Supplier" },
                { field: "lead", dt: "Lead" },
                { field: "employee", dt: "Employee" },
                { field: "user", dt: "User" },
                { field: "contact_person", dt: "Contact" },
                { field: "party_name", dt: null },
                { field: "customer_name", dt: "Customer" },
                { field: "supplier_name", dt: "Supplier" },
              ];
              for (let p of map) {
                if (doc[p.field]) {
                  let dt = p.dt;
                  if (!dt && p.field === "party_name" && doc.party_type)
                    dt = doc.party_type;
                  if (dt) return { doctype: dt, name: doc[p.field] };
                }
              }
              return null;
            }

            function getMobileFromLinkedParty(party, cb) {
              if (!party || !party.name) {
                cb(null);
                return;
              }
              frappe.call({
                method: "frappe.client.get",
                args: { doctype: party.doctype, name: party.name },
                callback(r) {
                  cb(r.message ? getMobileFromDoc(r.message) : null);
                },
              });
            }

            const partyMap = {
              Customer: {},
              Supplier: {},
              User: {},
              Contact: {},
              "WhatsApp Contact": {},
              Lead: {},
              Employee: {},
            };
            let autoMobile = getMobileFromDoc(current_doc);
            let autoPartyType = null,
              autoParty = null;

            if (!autoMobile) {
              const linked = getLinkedParty(current_doc);
              if (linked) {
                autoPartyType = linked.doctype;
                autoParty = linked.name;
                getMobileFromLinkedParty(linked, function (m) {
                  if (m) autoMobile = m;
                  openDialog();
                });
              } else openDialog();
            } else openDialog();

            function openDialog() {
              const dialog = new frappe.ui.Dialog({
                title: __("Send WhatsApp Message"),
                fields: [
                  {
                    fieldname: "party_type",
                    label: __("Type"),
                    fieldtype: "Select",
                    reqd: 0,
                    options: Object.keys(partyMap).join("\n"),
                    change() {
                      dialog.set_value("party", "");
                      dialog.set_value("mobile_no", "");
                    },
                  },
                  { fieldtype: "Column Break" },
                  {
                    fieldname: "party",
                    label: __("Party"),
                    fieldtype: "Dynamic Link",
                    options: "party_type",
                    reqd: 0,
                    change() {
                      if (dialog.get_value("party")) fetchMobile();
                    },
                  },
                  { fieldtype: "Section Break", label: __("Template") },
                  {
                    fieldname: "whatsapp_account",
                    label: __("WhatsApp Account"),
                    fieldtype: "Link",
                    options: "WhatsApp Account",
                    reqd: 1,
                    // Only offer active accounts when picking a WhatsApp Account.
                    get_query: () => ({
                      filters: { status: "Active" },
                    }),
                  },
                  {
                    fieldname: "template",
                    label: __("Template"),
                    fieldtype: "Link",
                    options: "WhatsApp Templates",
                    reqd: 1,
                    // Only offer templates that are meant for the current doctype.
                    get_query: () => ({
                      filters: { for_doctype: reference_doctype },
                    }),
                  },
                  {
                    fieldname: "print_format",
                    label: __("Print Format"),
                    fieldtype: "Link",
                    options: "Print Format",
                    reqd: 0,
                    hidden: 1,
                  },
                  {
                    fieldname: "mobile_no",
                    label: __("Mobile No"),
                    fieldtype: "Data",
                    reqd: 1,
                  },
                ],
                primary_action_label: __("Preview & Send"),
                primary_action(v) {
                  if (v) {
                    dialog.hide();
                    showPreview(v);
                  }
                },
              });

              function fetchMobile() {
                const pt = dialog.get_value("party_type"),
                  p = dialog.get_value("party");
                if (!pt || !p) return;
                frappe.call({
                  method: "frappe.client.get",
                  args: { doctype: pt, name: p },
                  callback(r) {
                    if (!r.message) return;
                    const m = getMobileFromDoc(r.message);
                    dialog.set_value("mobile_no", m || "");
                    if (!m) frappe.msgprint(__("No mobile number found."));
                  },
                });
              }

              dialog.show();
              // Auto-select the WhatsApp Account when there is exactly one active
              // account — saves a manual pick and prevents ambiguity.
              frappe.db
                .get_list("WhatsApp Account", {
                  filters: { status: "Active" },
                  fields: ["name"],
                  limit: 2,
                })
                .then((accounts) => {
                  if (accounts && accounts.length === 1) {
                    dialog.set_value("whatsapp_account", accounts[0].name);
                  }
                });
              if (autoPartyType) {
                dialog.set_value("party_type", autoPartyType);
                setTimeout(() => {
                  if (autoParty) dialog.set_value("party", autoParty);
                  setTimeout(() => {
                    if (autoMobile) dialog.set_value("mobile_no", autoMobile);
                  }, 200);
                }, 200);
              } else if (autoMobile)
                setTimeout(() => dialog.set_value("mobile_no", autoMobile), 200);
            }

            function showPreview(values) {
              frappe.call({
                method: "waba_suite.api.template_preview.preview_template",
                args: {
                  template: values.template,
                  reference_doctype,
                  reference_name,
                  whatsapp_account: values.whatsapp_account,
                  print_format: values.print_format || "",
                },
                freeze: true,
                freeze_message: __("Generating preview..."),
                callback(r) {
                  if (!r.message) return;
                  const p = r.message;
                  const varData = (p.variables || []).map((v) => ({
                    idx: v.index,
                    type: v.type,
                    label: v.label,
                    value: v.value,
                  }));

                  let msgHtml = `<div style="background:#f0f4f8;border:1px solid #d1d8dd;border-radius:6px;padding:16px;font-size:13px;line-height:1.6;white-space:pre-wrap;max-height:250px;overflow-y:auto;margin:8px 0;">`;
                  if (p.template_name)
                    msgHtml += `<div style="color:#25D366;font-weight:600;font-size:11px;text-transform:uppercase;margin-bottom:8px;">📄 ${p.template_name}</div>`;
                  if (p.filled_header)
                    msgHtml += `<div style="color:#1a6535;font-weight:600;margin-bottom:6px;">${frappe.utils.escape_html(p.filled_header)}</div>`;
                  if (p.filled_body)
                    msgHtml += `<div>${frappe.utils.escape_html(p.filled_body)}</div>`;
                  if (p.filled_footer)
                    msgHtml += `<div style="color:#8696a0;font-size:11px;margin-top:4px;">${frappe.utils.escape_html(p.filled_footer)}</div>`;
                  if (p.file_url)
                    msgHtml += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #d1d8dd;color:#1a6535;">📎 ${(p.filename || p.file_url.split("/").pop())}</div>`;
                  msgHtml += `</div>`;

                  const dlg = new frappe.ui.Dialog({
                    title: __("WhatsApp Template Preview"),
                    size: "extra-large",
                    fields: [
                      {
                        fieldtype: "HTML",
                        fieldname: "msg_preview",
                        options: msgHtml,
                      },
                      {
                        fieldtype: "Section Break",
                        label: __(
                          "Edit Variables (changes are saved for next time)"
                        ),
                      },
                      {
                        fieldname: "vars_table",
                        fieldtype: "Table",
                        fields: [
                          {
                            fieldname: "idx",
                            label: __("#"),
                            fieldtype: "Int",
                            read_only: 1,
                            columns: 1,
                            in_list_view: 1,
                          },
                          {
                            fieldname: "type",
                            label: __("Section"),
                            fieldtype: "Data",
                            read_only: 1,
                            columns: 1,
                            in_list_view: 1,
                          },
                          {
                            fieldname: "label",
                            label: __("Field"),
                            fieldtype: "Data",
                            read_only: 1,
                            columns: 2,
                            in_list_view: 1,
                          },
                          {
                            fieldname: "value",
                            label: __("Value"),
                            fieldtype: "Data",
                            columns: 3,
                            in_list_view: 1,
                          },
                        ],
                        data: varData,
                        read_only: 0,
                      },
                    ],
                    primary_action_label: __("Send Now"),
                    primary_action() {
                      const table = dlg.get_values().vars_table || [];
                      const overrides = {};
                      table.forEach((r) => {
                        if (r.idx !== undefined) overrides[r.idx] = r.value;
                      });

                      frappe.call({
                        method:
                          "waba_suite.api.template_preview.preview_template",
                        args: {
                          template: values.template,
                          reference_doctype,
                          reference_name,
                          whatsapp_account: values.whatsapp_account,
                          print_format: values.print_format || "",
                          send: true,
                          to: values.mobile_no,
                          variable_overrides: JSON.stringify(overrides),
                        },
                        freeze: true,
                        freeze_message: __("Sending..."),
                        callback(resp) {
                          if (
                            resp.message &&
                            resp.message.status === "sent"
                          ) {
                            frappe.msgprint(
                              __("Template sent to: " + values.mobile_no)
                            );
                            dlg.hide();
                            frappe.call({
                              method: "frappe.desk.form.utils.add_comment",
                              args: {
                                reference_doctype,
                                reference_name,
                                content:
                                  __("WhatsApp Template sent\nTo: ") +
                                  values.mobile_no +
                                  __("\nTemplate: ") +
                                  values.template,
                                comment_by: frappe.session.user_fullname,
                                comment_email: frappe.session.user,
                              },
                            });
                          } else
                            frappe.msgprint(
                              __("Failed to send. Check Error Log.")
                            );
                        },
                      });
                    },
                  });
                  dlg.show();
                },
              });
            }
          });
        },
      });
    }
  });
});