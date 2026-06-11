import {
  Archive,
  LogOut,
  MessageCircle,
  MoreVertical,
  Settings,
  Star,
  Users,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import type { Account, Chat } from "../../types";
import { Avatar } from "../common/Avatar";
import { SearchBar } from "../common/SearchBar";
import { AccountSwitcher } from "../modals/AccountSwitcher";
import { AddRoomModal } from "../modals/AddRoomModal";
import { UserSettingsModal } from "../modals/UserSettingsModal";
import { ChatRoom } from "./ChatRoom";

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
  currentAccount: string;
  accounts: Account[];
  onSwitchAccount: (accountName: string) => Promise<void>;
  userSettings: {
    enableNotifications: boolean;
  };
  currentUserName?: string;
  onLogout: () => Promise<void>;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  onClose,
  isMobile = false,
  currentAccount,
  accounts,
  onSwitchAccount,
  userSettings,
  currentUserName = "User",
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    return chats.filter(
      (chat) =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.mobileNo.includes(searchQuery),
    );
  }, [chats, searchQuery]);

  const currentAccountInfo = useMemo(() => {
    return accounts.find((acc) => acc.name === currentAccount);
  }, [accounts, currentAccount]);

  const formatTime = useCallback((timestamp: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (hours < 48) {
      return "Yesterday";
    } else if (hours < 168) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  }, []);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      onSelectChat(chatId);
      if (isMobile && onClose) {
        onClose();
      }
    },
    [onSelectChat, isMobile, onClose],
  );

  const handleSwitchAccount = useCallback(
    async (accountName: string) => {
      await onSwitchAccount(accountName);
      setShowAccountSwitcher(false);
    },
    [onSwitchAccount],
  );

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-[#202c33]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3942] bg-[#202c33]">
          <div className="flex items-center space-x-3">
            <Avatar name={currentUserName} size="md" color="#25D366" />
            <div>
              <h2 className="font-semibold text-white text-sm">
                {currentUserName}
              </h2>
              <p className="text-xs text-[#8696a0]">Online</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1]">
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowAddRoom(true)}
              className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1]"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1]">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {accounts.length > 1 && (
          <div
            onClick={() => setShowAccountSwitcher(true)}
            className="flex items-center justify-between px-4 py-2 bg-[#2a3942] cursor-pointer hover:bg-[#3b4a54] transition"
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">📱</span>
              <div>
                <div className="text-sm font-medium text-white">
                  {currentAccountInfo?.account_name || currentAccount}
                </div>
                <div className="text-xs text-[#8696a0]">
                  Active WhatsApp Account
                </div>
              </div>
            </div>
            <div className="text-xs text-[#25D366]">Switch</div>
          </div>
        )}

        <div className="p-3 bg-[#202c33]">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-full bg-[#2a3942] flex items-center justify-center mb-3">
                <MessageCircle className="w-8 h-8 text-[#8696a0]" />
              </div>
              <p className="text-[#8696a0] text-sm font-medium">
                {searchQuery ? "No chats found" : "No chats available"}
              </p>
              <p className="text-[#8696a0] text-xs mt-1">
                {searchQuery
                  ? "Try a different search term"
                  : "Start a new conversation by clicking the + button"}
              </p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <ChatRoom
                key={chat.id}
                chat={chat}
                isActive={selectedChatId === chat.id}
                onClick={() => handleSelectChat(chat.id)}
                formatTime={formatTime}
              />
            ))
          )}
        </div>

        <div className="border-t border-[#2a3942] p-3">
          <div className="flex items-center justify-between">
            <button className="flex flex-col items-center space-y-1 p-2 hover:bg-[#2a3942] rounded-lg transition flex-1 group">
              <Archive className="w-5 h-5 text-[#aebac1] group-hover:text-white transition" />
              <span className="text-[10px] text-[#aebac1] group-hover:text-white transition">
                Archived
              </span>
            </button>
            <button className="flex flex-col items-center space-y-1 p-2 hover:bg-[#2a3942] rounded-lg transition flex-1 group">
              <Star className="w-5 h-5 text-[#aebac1] group-hover:text-white transition" />
              <span className="text-[10px] text-[#aebac1] group-hover:text-white transition">
                Starred
              </span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex flex-col items-center space-y-1 p-2 hover:bg-[#2a3942] rounded-lg transition flex-1 group"
            >
              <Settings className="w-5 h-5 text-[#aebac1] group-hover:text-white transition" />
              <span className="text-[10px] text-[#aebac1] group-hover:text-white transition">
                Settings
              </span>
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex flex-col items-center space-y-1 p-2 hover:bg-[#2a3942] rounded-lg transition flex-1 group"
            >
              <LogOut className="w-5 h-5 text-[#aebac1] group-hover:text-red-500 transition" />
              <span className="text-[10px] text-[#aebac1] group-hover:text-red-500 transition">
                Logout
              </span>
            </button>
          </div>
        </div>
      </div>

      <AccountSwitcher
        isOpen={showAccountSwitcher}
        onClose={() => setShowAccountSwitcher(false)}
        currentAccount={currentAccount}
        accounts={accounts}
        onSwitch={handleSwitchAccount}
      />
      <AddRoomModal
        isOpen={showAddRoom}
        onClose={() => setShowAddRoom(false)}
        whatsappAccount={currentAccount}
        onSuccess={() => {
          if (onClose) onClose();
        }}
      />
      <UserSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-[#202c33] rounded-lg shadow-xl w-80 max-w-full">
            <div className="p-4 border-b border-[#2a3942]">
              <h3 className="text-lg font-semibold text-white">Logout</h3>
            </div>
            <div className="p-4">
              <p className="text-[#d1d7db] text-sm">
                Are you sure you want to logout?
              </p>
            </div>
            <div className="p-4 border-t border-[#2a3942] flex justify-end space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm text-[#aebac1] hover:bg-[#2a3942] rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
