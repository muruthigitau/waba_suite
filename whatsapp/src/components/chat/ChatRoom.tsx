import { Check, CheckCheck, Users, Clock, AlertCircle } from "lucide-react";
import React from "react";
import type { Chat } from "../../types";
import { Avatar } from "../common/Avatar";

interface ChatRoomProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  formatTime: (timestamp: string) => string;
}

const stripHtml = (html: string) => {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
};

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chat,
  isActive,
  onClick,
  formatTime,
}) => {
  const isOutgoing = chat.lastMessageType === "Outgoing";
  
  const getLastMessageIcon = () => {
    if (!isOutgoing) return null;
    
    switch (chat.lastMessageStatus) {
      case "sent":
        return <Check className="w-3 h-3 text-[#8696a0]" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-[#8696a0]" />;
      case "read":
      case "marked_as_read":
        return <CheckCheck className="w-3 h-3 text-[#53bdeb]" />;
      case "failed":
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case "draft":
        return <Clock className="w-3 h-3 text-[#8696a0]" />;
      default:
        return null;
    }
  };

  const getLastMessagePreview = () => {
    if (chat.lastMessageType === "image") return "📷 Photo";
    if (chat.lastMessageType === "video") return "🎥 Video";
    if (chat.lastMessageType === "document") return "📄 Document";
    if (chat.lastMessageType === "location") return "📍 Location";
    if (chat.lastMessageType === "contact") return "👤 Contact";
    if (chat.lastMessageType === "audio") return "🎵 Audio";
    if (chat.lastMessageType === "button") return "🔘 Button";
    if (chat.lastMessageType === "interactive") return "💬 Interactive";
    if (chat.lastMessageType === "flow") return "📋 Form";
    if (chat.lastMessageType === "reaction") return "😊 Reaction";
    
    const plainText = stripHtml(chat.lastMessage);
    if (plainText.length > 50) {
      return plainText.substring(0, 50) + "...";
    }
    return plainText || "No messages yet";
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center px-3 py-2 hover:bg-[#2a3942] cursor-pointer transition ${
        isActive ? "bg-[#2a3942]" : ""
      }`}
    >
      <Avatar name={chat.name} size="md" online={chat.online} />
      <div className="flex-1 ml-3 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-white text-sm truncate max-w-[150px]">
              {chat.name}
            </span>
            {chat.isGroup && <Users className="w-3 h-3 text-[#8696a0] flex-shrink-0" />}
          </div>
          <span className="text-xs text-[#8696a0] whitespace-nowrap ml-2 flex-shrink-0">
            {formatTime(chat.timestamp)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <div className="flex items-center space-x-1 flex-1 min-w-0">
            {getLastMessageIcon()}
            <p className="text-sm text-[#8696a0] truncate">
              {chat.typing ? (
                <span className="text-[#25D366]">Typing...</span>
              ) : (
                getLastMessagePreview()
              )}
            </p>
          </div>
          {chat.unreadCount > 0 && (
            <div className="ml-2 w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
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