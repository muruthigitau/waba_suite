import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { Bell, Volume2, X } from "lucide-react";
import React, { useEffect, useState } from "react";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [enableMessageTone, setEnableMessageTone] = useState(true);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [loading, setLoading] = useState(false);

  const { data: settingsData } = useFrappeGetCall<{ message: any }>(
    "waba_suite.api.config.get_user_settings",
    {},
    isOpen ? undefined : { enabled: false },
  );

  const { call: updateSettingsCall } = useFrappePostCall(
    "waba_suite.api.config.get_user_settings",
  );

  useEffect(() => {
    if (settingsData?.message) {
      setEnableMessageTone(settingsData.message.enable_message_tone ?? true);
      setEnableNotifications(settingsData.message.enable_notifications ?? true);
    }
  }, [settingsData]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateSettingsCall({
        settings: {
          enable_message_tone: enableMessageTone,
          enable_notifications: enableNotifications,
        },
      });
      onClose();
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[#202c33] rounded-lg shadow-xl w-[400px] max-w-full">
        <div className="flex items-center justify-between p-4 border-b border-[#2a3942]">
          <h3 className="text-lg font-semibold text-white">My Settings</h3>
          <button onClick={onClose} className="p-1 hover:bg-[#2a3942] rounded">
            <X className="w-5 h-5 text-[#aebac1]" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="w-5 h-5 text-[#aebac1]" />
              <div>
                <div className="text-sm font-medium text-white">
                  Enable Message Tone
                </div>
                <div className="text-xs text-[#8696a0]">
                  Play sound when messages are sent/received
                </div>
              </div>
            </div>
            <button
              onClick={() => setEnableMessageTone(!enableMessageTone)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                enableMessageTone ? "bg-[#25D366]" : "bg-[#2a3942]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  enableMessageTone ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-[#aebac1]" />
              <div>
                <div className="text-sm font-medium text-white">
                  Enable Notifications
                </div>
                <div className="text-xs text-[#8696a0]">
                  Show browser notifications for new messages
                </div>
              </div>
            </div>
            <button
              onClick={() => setEnableNotifications(!enableNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                enableNotifications ? "bg-[#25D366]" : "bg-[#2a3942]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  enableNotifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-[#2a3942] flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#aebac1] hover:bg-[#2a3942] rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-sm bg-[#25D366] text-white rounded-lg hover:bg-[#20b859] transition disabled:opacity-50"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
