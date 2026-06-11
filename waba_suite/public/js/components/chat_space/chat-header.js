import { get_avatar_html } from "../chat_utils.js";

export default class ChatHeader {
	constructor(chatSpace) {
		this.chatSpace = chatSpace;
		this.$element = null;
	}

	render() {
		const profile = this.chatSpace.profile;

		let avatar_html = "";
		if (profile.profile_picture) {
			avatar_html = `<img src="${profile.profile_picture}" alt="${profile.room_name || ""}" style="width: 100%; height: 100%; object-fit: cover;" />`;
		} else {
			avatar_html = get_avatar_html(
				profile.room_type,
				profile.opposite_person_email,
				profile.room_name,
			);
		}

		let primary_name = profile.room_name;
		let secondary_info = "";

		if (profile.contact_name && profile.contact_name !== profile.user_email) {
			primary_name = profile.contact_name;
			secondary_info = profile.user_email;
		}

		const isLongName = primary_name.length > 25;

		const html = `
            <div style='display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid var(--wa-border); gap: 8px; background: var(--wa-bg-header, transparent); min-height: 48px; box-sizing: border-box;'>
                <div style='display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;'>
                    <span class='waba-chat-back-button' title='${__("Go Back")}' style='cursor: pointer; display: flex; align-items: center; padding: 4px; border-radius: 4px; flex-shrink: 0;'>
                        ${frappe.utils.icon("left")}
                    </span>
                    
                    <div style='flex-shrink: 0; display: flex; align-items: center; width: 32px; height: 32px; border-radius: 50%; overflow: hidden;'>
                        <style>
                            div[style*="width: 32px; height: 32px"] img,
                            div[style*="width: 32px; height: 32px"] svg,
                            div[style*="width: 32px; height: 32px"] .avatar,
                            div[style*="width: 32px; height: 32px"] .avatar-frame {
                                width: 32px !important;
                                height: 32px !important;
                                min-width: 32px !important;
                                min-height: 32px !important;
                                font-size: 12px !important;
                                display: flex !important;
                                align-items: center !important;
                                justify-content: center !important;
                            }
                        </style>
                        ${avatar_html}
                    </div>
                    
                    <div style='display: flex; flex-direction: column; justify-content: center; min-width: 0; flex: 1; line-height: 1.2; padding: 2px 0;'>
                        <div style='display: flex; align-items: flex-start; gap: 4px; width: 100%; min-width: 0;'>
                            <div style='flex: 1; min-width: 0; word-break: break-word; white-space: normal;'>
                                <span style='
                                    font-weight: 600; 
                                    font-size: ${isLongName ? "13px" : "14px"}; 
                                    color: var(--wa-text-primary);
                                    display: inline-block;
                                '>
                                    ${__(primary_name)}
                                </span>
                            </div>
                            <div style='width: 6px; height: 6px; background-color: var(--wa-success, #25D366); border-radius: 50%; flex-shrink: 0; margin-top: 5px;'></div>
                        </div>
                        ${
							secondary_info
								? `
                            <div style='
                                font-size: 11px; 
                                color: var(--wa-text-secondary); 
                                overflow: hidden; 
                                text-overflow: ellipsis; 
                                white-space: nowrap;
                                margin-top: 1px;
                            '>
                                ${secondary_info}
                            </div>
                        `
								: ""
						}
                    </div>
                </div>

                <div style='display: flex; align-items: center; gap: 4px; flex-shrink: 0;'>
                    <div class='waba-fullscreen-chat-btn' title='${__("Open in Full Page")}' style='cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center;'>
                        ${frappe.utils.icon("expand", "xs")}
                    </div>
                    <div class='waba-chat-close-button' title='${__("Close")}' style='cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center;'>
                        ${frappe.utils.icon("close", "sm")}
                    </div>
                </div>
            </div>
        `;
		this.$element = $(html);
		return this.$element;
	}
}
