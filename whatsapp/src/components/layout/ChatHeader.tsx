import { Archive, ChevronLeft, MoreVertical, Phone, Pin, Star, Tag, Video } from "lucide-react";
import React, { useState } from "react";
import type { Chat } from "../../types";
import { Avatar } from "../common/Avatar";

interface ChatHeaderProps {
  chat: Chat | null;
  onBack?: () => void;
  isMobile?: boolean;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onMenu?: () => void;
  onTogglePin?: (chatId: string) => void;
  onToggleStar?: (chatId: string) => void;
  onToggleArchive?: (chatId: string) => void;
  onOpenLabels?: (chatId: string) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chat,
  onBack,
  isMobile = false,
  onVoiceCall,
  onVideoCall,
  onMenu,
  onTogglePin,
  onToggleStar,
  onToggleArchive,
  onOpenLabels,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  if (!chat) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#202c33] border-l border-[#2a3942]">
      <div className="flex items-center space-x-3">
        {isMobile && (
          <button
            onClick={onBack}
            className="p-1 hover:bg-[#2a3942] rounded-full transition mr-1"
          >
            <ChevronLeft className="w-5 h-5 text-[#aebac1]" />
          </button>
        )}
        <Avatar
          name={chat.name}
          size="md"
          online={chat.online}
          src={chat.profilePicture}
        />
        <div>
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-white text-sm">{chat.name}</h3>
              {chat.isPinned && <Pin className="w-3 h-3 text-[#25D366]" />}
              {chat.isStarred && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
              {chat.isArchived && <Archive className="w-3 h-3 text-[#8696a0]" />}
            </div>
            {/* Labels as visible chips with color + name */}
            {chat.labels && chat.labels.length > 0 && (
              <div className="flex items-center flex-wrap gap-1 mt-1">
                {chat.labels.map((l) => (
                  <span
                    key={l.name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: l.color || "#8696a0" }}
                    title={l.label_name}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                    {l.label_name}
                  </span>
                ))}
              </div>
            )}
          <div className="flex items-center space-x-2">
            <p className="text-xs text-[#8696a0]">
              {chat.typing ? (
                <span className="text-[#25D366]">Typing...</span>
              ) : chat.online ? (
                "Online"
              ) : (
                "Offline"
              )}
            </p>
            {chat.mobileNo && (
              <>
                <span className="text-xs text-[#8696a0]">•</span>
                <p className="text-xs text-[#8696a0]">{chat.mobileNo}</p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="relative flex items-center">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1]"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {/* 3-dot menu dropdown */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-10 z-50 bg-[#202c33] border border-[#2a3942] rounded-lg shadow-xl py-1 w-48">
              <button
                onClick={() => { setShowMenu(false); onTogglePin?.(chat.id) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d7db] hover:bg-[#2a3942] transition"
              >
                <Pin className={`w-4 h-4 ${chat.isPinned ? "text-[#25D366]" : "text-[#8696a0]"}`} />
                <span>{chat.isPinned ? "Unpin" : "Pin"}</span>
              </button>
              <button
                onClick={() => { setShowMenu(false); onToggleStar?.(chat.id) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d7db] hover:bg-[#2a3942] transition"
              >
                <Star className={`w-4 h-4 ${chat.isStarred ? "text-yellow-400 fill-yellow-400" : "text-[#8696a0]"}`} />
                <span>{chat.isStarred ? "Unstar" : "Star"}</span>
              </button>
              <button
                onClick={() => { setShowMenu(false); onOpenLabels?.(chat.id) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d7db] hover:bg-[#2a3942] transition"
              >
                <Tag
                  className={`w-4 h-4 ${
                    chat.labels && chat.labels.length > 0
                      ? "text-[#25D366]"
                      : "text-[#8696a0]"
                  }`}
                />
                <span>
                  {chat.labels && chat.labels.length > 0
                    ? `Labels (${chat.labels.length})`
                    : "Add labels"}
                </span>
              </button>
              <div className="h-px bg-[#2a3942] my-1" />
              <button
                onClick={() => { setShowMenu(false); onToggleArchive?.(chat.id) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d7db] hover:bg-[#2a3942] transition"
              >
                <Archive className={`w-4 h-4 ${chat.isArchived ? "text-[#25D366]" : "text-[#8696a0]"}`} />
                <span>{chat.isArchived ? "Unarchive" : "Archive"}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
