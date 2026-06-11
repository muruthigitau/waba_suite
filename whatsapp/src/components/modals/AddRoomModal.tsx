import { useFrappePostCall } from "frappe-react-sdk";
import { Loader2, X } from "lucide-react";
import React, { useState } from "react";

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappAccount: string;
  onSuccess?: () => void;
}

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  isOpen,
  onClose,
  whatsappAccount,
  onSuccess,
}) => {
  const [contactName, setContactName] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const { call: createRoomCall } = useFrappePostCall(
    "waba_suite.api.contacts.create",
  );

  const handleSubmit = async () => {
    if (!contactName.trim() || !mobileNo.trim() || !email.trim()) return;

    setLoading(true);
    try {
      await createRoomCall({
        contact_name: contactName,
        mobile_no: mobileNo,
        email: email,
        whatsapp_account: whatsappAccount,
      });
      setContactName("");
      setMobileNo("");
      setEmail("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to create room:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[#202c33] rounded-lg shadow-xl w-[450px] max-w-full">
        <div className="flex items-center justify-between p-4 border-b border-[#2a3942]">
          <h3 className="text-lg font-semibold text-white">New Chat Room</h3>
          <button onClick={onClose} className="p-1 hover:bg-[#2a3942] rounded">
            <X className="w-5 h-5 text-[#aebac1]" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#aebac1] mb-1">
              Contact Name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Enter contact name"
              className="w-full px-3 py-2 bg-[#2a3942] rounded-lg text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#aebac1] mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={mobileNo}
              onChange={(e) => setMobileNo(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-3 py-2 bg-[#2a3942] rounded-lg text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
            />
            <p className="text-xs text-[#8696a0] mt-1">
              Mobile number with country code
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#aebac1] mb-1">
              Assign User
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 bg-[#2a3942] rounded-lg text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
            />
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
            onClick={handleSubmit}
            disabled={
              loading ||
              !contactName.trim() ||
              !mobileNo.trim() ||
              !email.trim()
            }
            className="px-4 py-2 text-sm bg-[#25D366] text-white rounded-lg hover:bg-[#20b859] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Create Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
