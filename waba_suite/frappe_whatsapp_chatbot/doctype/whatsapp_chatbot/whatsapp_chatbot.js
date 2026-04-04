// Copyright (c) 2024, Shridhar Patil and contributors
// For license information, please see license.txt

frappe.ui.form.on('WhatsApp Chatbot', {
    populate_hours_btn: function(frm) {
        frappe.call({
            method: 'populate_default_business_hours',
            doc: frm.doc,
            callback: function(r) {
                if (r.message) {
                    frappe.msgprint(r.message.message || 'Default business hours populated');
                    frm.reload_doc();
                }
            }
        });
    }
});
