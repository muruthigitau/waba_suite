import { Check, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { Account } from "../../types";
import { Loader } from "../common/Loader";

interface AccountSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: string;
  accounts: Account[];
  onSwitch: (accountName: string) => Promise<void>;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  isOpen,
  onClose,
  currentAccount,
  accounts,
  onSwitch,
}) => {
  const [switching, setSwitching] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(currentAccount);

  useEffect(() => {
    if (isOpen) {
      setSelectedAccount(currentAccount);
    }
  }, [isOpen, currentAccount]);

  const handleSwitch = async () => {
    if (selectedAccount === currentAccount) {
      onClose();
      return;
    }
    setSwitching(true);
    await onSwitch(selectedAccount);
    setSwitching(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[#202c33] rounded-lg shadow-xl w-96 max-w-full">
        <div className="flex items-center justify-between p-4 border-b border-[#2a3942]">
          <h3 className="text-lg font-semibold text-white">
            Switch WhatsApp Account
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[#2a3942] rounded">
            <X className="w-5 h-5 text-[#aebac1]" />
          </button>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-[#8696a0]">
              No active WhatsApp accounts assigned to you.
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.name}
                  onClick={() => setSelectedAccount(account.name)}
                  className={`border rounded-lg p-3 cursor-pointer transition ${
                    selectedAccount === account.name
                      ? "border-[#25D366] bg-[#2a3942]"
                      : "border-[#2a3942] hover:bg-[#2a3942]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        {account.account_name}
                      </div>
                      <div className="text-xs text-[#8696a0]">
                        ID: {account.phone_id}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {account.unread_count > 0 && (
                        <span className="bg-[#25D366] text-white text-xs px-2 py-0.5 rounded-full">
                          {account.unread_count} unread
                        </span>
                      )}
                      {account.is_default && (
                        <span className="bg-[#25D366] text-white text-xs px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                      {selectedAccount === account.name && (
                        <Check className="w-4 h-4 text-[#25D366]" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#2a3942] flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#aebac1] hover:bg-[#2a3942] rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSwitch}
            disabled={switching || selectedAccount === currentAccount}
            className="px-4 py-2 text-sm bg-[#25D366] text-white rounded-lg hover:bg-[#20b859] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {switching && <Loader size="sm" color="white" />}
            <span>Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
