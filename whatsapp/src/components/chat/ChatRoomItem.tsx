import { Check, CheckCheck, Users } from "lucide-react";
import React from "react";
import { Chat } from "../../types";
import { getTimeAgo } from "../../utils/dateUtils";

interface ChatRoomItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export const ChatRoomItem: React.FC<ChatRoomItemProps> = ({
  chat,
  isActive,
  onClick,
}) => {
  const getLastMessageIcon = () => {
    if (chat.lastMessageStatus === "sent") {
      return <Check className="w-3 h-3" />;
    }
    if (chat.lastMessageStatus === "delivered") {
      return <CheckCheck className="w-3 h-3" />;
    }
    if (chat.lastMessageStatus === "read") {
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    }
    return null;
  };

  const getLastMessagePreview = () => {
    if (chat.lastMessageType === "image") return "📷 Photo";
    if (chat.lastMessageType === "video") return "🎥 Video";
    if (chat.lastMessageType === "document") return "📄 Document";
    return chat.lastMessage;
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer transition ${
        isActive ? "bg-gray-50" : ""
      }`}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-semibold">
          {chat.avatar}
        </div>
        {chat.online && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        )}
      </div>

      <div className="flex-1 ml-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-800">{chat.name}</span>
            {chat.isGroup && <Users className="w-3 h-3 text-gray-400" />}
          </div>
          <span className="text-xs text-gray-400">
            {getTimeAgo(chat.timestamp)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-1 flex-1">
            {chat.isSent && getLastMessageIcon()}
            <p className="text-sm text-gray-500 truncate max-w-[180px]">
              {chat.typing ? (
                <span className="text-green-500">Typing...</span>
              ) : (
                getLastMessagePreview()
              )}
            </p>
          </div>
          {chat.unreadCount > 0 && (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-xs text-white">
                {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
