frappe.ui.form.on("Bulk WhatsApp Message", {
	refresh: function (frm) {
		// Add progress bar
		if (frm.doc.docstatus === 1 && frm.doc.status != "Draft") {
			frm.add_custom_button(__("Check Progress"), function () {
				frappe.call({
					method: "waba_suite.utils.bulk_messaging.get_progress",
					args: {
						name: frm.doc.name,
					},
					callback: function (r) {
						if (r.message) {
							const progress = r.message;
							const percent = Math.min(100, Math.round(progress.percent || 0));
							const counts = {
								sent: progress.sent || 0,
								delivered: progress.delivered || 0,
								read: progress.read || 0,
								queued: progress.queued || 0,
								pending: progress.pending || 0,
								failed: progress.failed || 0,
								total: progress.total || 0,
							};
							const html = `
                                <div class="progress" style="height: 20px;">
                                    <div class="progress-bar bg-success" role="progressbar"
                                        style="width: ${percent}%;"
                                        aria-valuenow="${percent}"
                                        aria-valuemin="0"
                                        aria-valuemax="100">
                                        ${percent}%
                                    </div>
                                </div>
                                <div class="mt-2">
                                    <span class="badge badge-success">Sent: ${counts.sent}</span>
                                    <span class="badge badge-info ml-2">Delivered: ${counts.delivered}</span>
                                    <span class="badge badge-primary ml-2">Read: ${counts.read}</span>
                                    <span class="badge badge-warning ml-2">Queued: ${counts.queued}</span>
                                    <span class="badge badge-secondary ml-2">Pending: ${counts.pending}</span>
                                    <span class="badge badge-danger ml-2">Failed: ${counts.failed}</span>
                                    <span class="badge badge-dark ml-2">Total: ${counts.total}</span>
                                </div>
                            `;

							frappe.msgprint({
								title: __("Message Progress"),
								indicator: "blue",
								message: html,
							});
						}
					},
				});
			});

			// Add retry button
			frm.add_custom_button(__("Retry Failed Messages"), function () {
				frappe.call({
					method: "waba_suite.utils.bulk_messaging.retry_failed",
					args: {
						name: frm.doc.name,
					},
					callback: function (r) {
						if (r.message) {
							frm.reload_doc();
						}
					},
				});
			}).addClass("btn-danger");
		}
	},
	validate: function (frm) {
		if (
			frm.doc.recipient_type == "Individual" &&
			(!frm.doc.recipients || frm.doc.recipients.length === 0)
		) {
			frappe.throw(__("Please add at least one recipient"));
			return false;
		}

		if (frm.doc.recipient_type == "Recipient List" && !frm.doc.recipient_list) {
			frappe.throw(__("Please select a recipient list"));
			return false;
		}

		if (frm.doc.use_template && !frm.doc.template) {
			frappe.throw(__("Please select a template"));
			return false;
		}

		if (!frm.doc.use_template && !frm.doc.message_content) {
			frappe.throw(__("Please enter message content"));
			return false;
		}

		return true;
	},
});
