import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useChat } from "../../contexts/ChatContext";
import { chatAPI } from "../../services/frappe-sdk";

interface AccountSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentAccount, switchAccount } = useChat();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await chatAPI.getUserAccounts();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("Failed to load accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (accountName: string) => {
    await switchAccount(accountName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Switch WhatsApp Account</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading accounts...
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active WhatsApp accounts assigned to you.
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.name}
                  onClick={() => handleSwitch(account.name)}
                  className={`border rounded-lg p-3 cursor-pointer transition ${
                    currentAccount === account.name
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">
                        {account.account_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {account.phone_id}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {account.unread_count > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {account.unread_count} unread
                        </span>
                      )}
                      {account.is_default && (
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
