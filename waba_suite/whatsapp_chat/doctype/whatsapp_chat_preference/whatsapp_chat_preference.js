frappe.ui.form.on("WhatsApp Chat Preference", {
    refresh(frm) {
        if (!frm.doc.user_contact_key && frm.doc.user && frm.doc.whatsapp_contact) {
            frm.set_value("user_contact_key", `${frm.doc.user}_${frm.doc.whatsapp_contact}`);
        }
    },
});