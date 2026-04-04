// Copyright (c) 2024, Frappe Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on('WhatsApp Chatbot Flow', {
    refresh: function(frm) {
        // Update grid column visibility on form load
        frm.trigger('update_steps_grid_columns');
    },

    update_steps_grid_columns: function(frm) {
        // Get the grid for steps child table
        let grid = frm.fields_dict.steps.grid;
        if (!grid) return;

        // Refresh grid to apply visibility
        grid.refresh();
    }
});

// Handle child table field visibility in grid view
frappe.ui.form.on('WhatsApp Flow Step', {
    // Trigger on form render (when row is opened for editing)
    form_render: function(frm, cdt, cdn) {
        update_step_field_visibility(frm, cdt, cdn);
    },

    // Trigger when message_type changes
    message_type: function(frm, cdt, cdn) {
        update_step_field_visibility(frm, cdt, cdn);
    },

    // Trigger when input_type changes
    input_type: function(frm, cdt, cdn) {
        update_step_field_visibility(frm, cdt, cdn);
    },

    // Trigger when retry_on_invalid changes
    retry_on_invalid: function(frm, cdt, cdn) {
        update_step_field_visibility(frm, cdt, cdn);
    }
});

/**
 * Update field visibility based on depends_on conditions for WhatsApp Flow Step
 */
function update_step_field_visibility(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let grid_row = frm.fields_dict.steps.grid.grid_rows_by_docname[cdn];

    if (!grid_row) return;

    // Template field - depends on message_type == 'Template'
    let show_template = row.message_type === 'Template';
    grid_row.toggle_display('template', show_template);

    // Options field - depends on input_type == 'Select'
    let show_options = row.input_type === 'Select';
    grid_row.toggle_display('options', show_options);

    // Buttons field - depends on input_type == 'Button'
    let show_buttons = row.input_type === 'Button';
    grid_row.toggle_display('buttons', show_buttons);

    // WhatsApp Flow related fields - depends on input_type == 'WhatsApp Flow'
    let show_flow_fields = row.input_type === 'WhatsApp Flow';
    grid_row.toggle_display('whatsapp_flow', show_flow_fields);
    grid_row.toggle_display('flow_cta', show_flow_fields);
    grid_row.toggle_display('flow_screen', show_flow_fields);
    grid_row.toggle_display('flow_field_mapping', show_flow_fields);

    // Max retries - depends on retry_on_invalid
    let show_max_retries = row.retry_on_invalid ? true : false;
    grid_row.toggle_display('max_retries', show_max_retries);
}
