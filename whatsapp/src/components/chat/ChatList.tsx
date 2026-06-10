import {
  Archive,
  ChevronLeft,
  MessageCircle,
  MoreVertical,
  Search,
  Settings,
  Star,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { useChat } from "../../contexts/ChatContext";
import { Avatar } from "../common/Avatar";
import { AccountSwitcher } from "../modals/AccountSwitcher";
import { AddRoomModal } from "../modals/AddRoomModal";
import { UserSettingsModal } from "../modals/UserSettingsModal";
import { ChatRoomItem } from "./ChatRoomItem";

interface ChatListProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export const ChatList: React.FC<ChatListProps> = ({
  onClose,
  isMobile = false,
}) => {
  const { chats, selectedChat, setSelectedChat, currentAccount, accounts } =
    useChat();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const filteredChats = chats.filter(
    (chat) =>
      chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.mobileNo.includes(searchQuery),
  );

  const handleChatSelect = (chat: (typeof chats)[0]) => {
    setSelectedChat(chat);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const currentAccountInfo = accounts.find(
    (acc) => acc.name === currentAccount,
  );

  return (
    <>
      <div className="flex flex-col h-full bg-white border-r border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Avatar name="John Doe" size="md" color="green" />
            <div>
              <h2 className="font-semibold text-gray-800">John Doe</h2>
              <p className="text-xs text-gray-500">Online</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-gray-100 rounded-full transition">
              <Users className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setShowAddRoom(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <MessageCircle className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Account Switcher Bar */}
        {accounts.length > 1 && (
          <div
            onClick={() => setShowAccountSwitcher(true)}
            className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition"
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">📱</span>
              <div>
                <div className="text-sm font-medium text-gray-800">
                  {currentAccountInfo?.account_name || currentAccount}
                </div>
                <div className="text-xs text-gray-500">
                  Active WhatsApp Account
                </div>
              </div>
            </div>
            <div className="flex items-center text-sm text-green-600">
              <span>Switch</span>
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or start new chat"
              className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <ChatRoomItem
              key={chat.id}
              chat={chat}
              isActive={selectedChat?.id === chat.id}
              onClick={() => handleChatSelect(chat)}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition flex-1 justify-center">
              <Archive className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700 hidden sm:inline">
                Archived
              </span>
            </button>
            <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition flex-1 justify-center">
              <Star className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700 hidden sm:inline">
                Starred
              </span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition flex-1 justify-center"
            >
              <Settings className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700 hidden sm:inline">
                Settings
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AccountSwitcher
        isOpen={showAccountSwitcher}
        onClose={() => setShowAccountSwitcher(false)}
      />
      <AddRoomModal
        isOpen={showAddRoom}
        onClose={() => setShowAddRoom(false)}
      />
      <UserSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
};
