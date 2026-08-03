import {
  AlertCircle,
  Archive,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  File,
  FileText,
  Image,
  MapPin,
  Music,
  Pin,
  Star,
  Users,
} from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import type { Chat } from "../../types";
import { Avatar } from "../common/Avatar";

interface ChatRoomProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  formatTime: (timestamp: string) => string;
  onTogglePin?: (chatId: string) => void;
  onToggleStar?: (chatId: string) => void;
  onToggleArchive?: (chatId: string) => void;
}

const stripHtml = (html: string) => {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
};

const isTemplateJSON = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content);
    return !!parsed.template_name;
  } catch {
    return false;
  }
};

const getTemplatePreview = (content: string): string => {
  try {
    const parsed = JSON.parse(content);
    if (parsed.template_name) {
      let preview = parsed.template_name;
      if (parsed.body_values && parsed.body_values.length > 0) {
        const cleanBody = parsed.body_values.filter((v) => v !== "-").join(" ");
        if (cleanBody) {
          preview = `${preview}: ${cleanBody.substring(0, 40)}`;
        }
      }
      return preview;
    }
  } catch {
    return "";
  }
  return "";
};

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chat,
  isActive,
  onClick,
  formatTime,
  onTogglePin,
  onToggleStar,
  onToggleArchive,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
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

    if (isTemplateJSON(chat.lastMessage)) {
      const templatePreview = getTemplatePreview(chat.lastMessage);
      if (templatePreview) {
        return `📋 ${templatePreview}`;
      }
      return "📋 Template message";
    }

    const plainText = stripHtml(chat.lastMessage);
    if (plainText.length > 50) {
      return plainText.substring(0, 50) + "...";
    }
    return plainText || "No messages yet";
  };

  // Close context menu on outside click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowContextMenu((prev) => !prev);
  }, []);

  const handleAction = useCallback(
    (action: (chatId: string) => void) => {
      return (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowContextMenu(false);
        action(chat.id);
      };
    },
    [chat.id],
  );

  const getMessageTypeIcon = () => {
    if (chat.lastMessageType === "image")
      return <Image className="w-3 h-3 text-[#8696a0] mr-1" />;
    if (chat.lastMessageType === "video")
      return <File className="w-3 h-3 text-[#8696a0] mr-1" />;
    if (chat.lastMessageType === "document")
      return <FileText className="w-3 h-3 text-[#8696a0] mr-1" />;
    if (chat.lastMessageType === "location")
      return <MapPin className="w-3 h-3 text-[#8696a0] mr-1" />;
    if (chat.lastMessageType === "contact")
      return <Users className="w-3 h-3 text-[#8696a0] mr-1" />;
    if (chat.lastMessageType === "audio")
      return <Music className="w-3 h-3 text-[#8696a0] mr-1" />;
    if (
      chat.lastMessageType === "button" ||
      chat.lastMessageType === "interactive"
    )
      return <ExternalLink className="w-3 h-3 text-[#8696a0] mr-1" />;
    if (chat.lastMessageType === "flow")
      return <FileText className="w-3 h-3 text-[#8696a0] mr-1" />;
    if (chat.lastMessageType === "reaction")
      return <span className="mr-1">😊</span>;
    if (isTemplateJSON(chat.lastMessage))
      return <FileText className="w-3 h-3 text-[#8696a0] mr-1" />;
    return null;
  };

  return (
    <div className="relative">
      <div
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={`flex items-center px-3 py-2 hover:bg-[#2a3942] cursor-pointer transition border-b border-[#182229]/60 ${
          isActive ? "bg-[#2a3942]" : ""
        } ${chat.isArchived ? "opacity-60" : ""}`}
      >
        <div className="relative">
          <Avatar
            name={chat.name}
            size="md"
            online={chat.online}
            src={chat.profilePicture}
          />
          {/* Pin indicator */}
          {chat.isPinned && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#25D366] rounded-full flex items-center justify-center">
              <Pin className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 ml-3 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-white text-sm truncate max-w-[150px]">
                {chat.name}
              </span>
              {chat.isGroup && (
                <Users className="w-3 h-3 text-[#8696a0] flex-shrink-0" />
              )}
              {/* Star/Archive badges */}
              <div className="flex items-center gap-0.5">
                {chat.isStarred && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                {chat.isArchived && <Archive className="w-3 h-3 text-[#8696a0]" />}
              </div>
            </div>
            <span className="text-xs text-[#8696a0] whitespace-nowrap ml-2 flex-shrink-0">
              {formatTime(chat.timestamp)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center space-x-1 flex-1 min-w-0">
              {getLastMessageIcon()}
              <div className="flex items-center flex-1 min-w-0">
                {getMessageTypeIcon()}
                <p className="text-sm text-[#8696a0] truncate">
                  {chat.typing ? (
                    <span className="text-[#25D366]">Typing...</span>
                  ) : (
                    getLastMessagePreview()
                  )}
                </p>
              </div>
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

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            ref={contextMenuRef}
            className="absolute right-2 top-12 z-50 bg-[#202c33] border border-[#2a3942] rounded-lg shadow-xl py-1 w-44"
          >
            <button
              onClick={handleAction(onTogglePin || (() => {}))}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d7db] hover:bg-[#2a3942] transition"
            >
              <Pin className={`w-4 h-4 ${chat.isPinned ? "text-[#25D366]" : "text-[#8696a0]"}`} />
              <span>{chat.isPinned ? "Unpin" : "Pin"}</span>
            </button>
            <button
              onClick={handleAction(onToggleStar || (() => {}))}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d7db] hover:bg-[#2a3942] transition"
            >
              <Star className={`w-4 h-4 ${chat.isStarred ? "text-yellow-400 fill-yellow-400" : "text-[#8696a0]"}`} />
              <span>{chat.isStarred ? "Unstar" : "Star"}</span>
            </button>
            <div className="h-px bg-[#2a3942] my-1" />
            <button
              onClick={handleAction(onToggleArchive || (() => {}))}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d7db] hover:bg-[#2a3942] transition"
            >
              <Archive className={`w-4 h-4 ${chat.isArchived ? "text-[#25D366]" : "text-[#8696a0]"}`} />
              <span>{chat.isArchived ? "Unarchive" : "Archive"}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
