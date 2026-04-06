// Copyright (c) 2022, Shridhar Patil and contributors
// For license information, please see license.txt

frappe.ui.form.on("WhatsApp Message", {
	onload: function (frm) {
		frappe.db
			.get_value("WhatsApp Account", frm.doc.whatsapp_account, "allow_auto_read_receipt")
			.then((value) => {
				if (
					value &&
					frm.doc.type === "Incoming" &&
					frm.doc.status !== "marked as read" &&
					frm.doc.message_id
				) {
					send_read_receipt(frm);
				}
			});
	},
	refresh: function (frm) {
		if (frm.doc.type == "Incoming") {
			frm.add_custom_button(__("Reply"), function () {
				frappe.new_doc("WhatsApp Message", { to: frm.doc.from });
			});
		}

		if (
			frm.doc.type === "Outgoing" &&
			(frm.doc.status === "draft" || frm.doc.status === "failed")
		) {
			frm.add_custom_button(__("Send Message"), function () {
				frappe
					.call({
						method: "manual_send",
						doc: frm.doc,
						freeze: true,
						freeze_message: __("Sending Message"),
					})
					.then((r) => {
						if (!r.exc) frm.reload_doc();
					});
			}).addClass("btn-primary");
		}

		add_mark_as_read(frm);
	},
});

function add_mark_as_read(frm) {
	if (frm.doc.type === "Outgoing" || frm.doc.status == "marked as read" || !frm.doc.message_id)
		return;

	frappe.db
		.get_value("WhatsApp Account", frm.doc.whatsapp_account, "allow_auto_read_receipt")
		.then((value) => {
			if (value) return;

			frm.add_custom_button(__("Mark as read"), function () {
				send_read_receipt(frm);
			});
		});
}

function send_read_receipt(frm) {
	frappe.call({
		doc: frm.doc,
		method: "send_read_receipt",
		callback: function (r) {
			if (r && r.message) {
				frappe.msgprint(__("Marked as read"));
			}
		},
	});
}
