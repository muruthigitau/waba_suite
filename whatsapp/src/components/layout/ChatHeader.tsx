import { ChevronLeft, MoreVertical, Phone, Video } from "lucide-react";
import React from "react";
import type { Chat } from "../../types";
import { Avatar } from "../common/Avatar";

interface ChatHeaderProps {
  chat: Chat | null;
  onBack?: () => void;
  isMobile?: boolean;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onMenu?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chat,
  onBack,
  isMobile = false,
  onVoiceCall,
  onVideoCall,
  onMenu,
}) => {
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
        <Avatar name={chat.name} size="md" online={chat.online} />
        <div>
          <h3 className="font-semibold text-white text-sm">{chat.name}</h3>
          <p className="text-xs text-[#8696a0]">
            {chat.typing ? (
              <span className="text-[#25D366]">Typing...</span>
            ) : chat.online ? (
              "Online"
            ) : (
              "Offline"
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={onVoiceCall}
          className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1]"
        >
          <Phone className="w-5 h-5" />
        </button>
        <button
          onClick={onVideoCall}
          className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1]"
        >
          <Video className="w-5 h-5" />
        </button>
        <button
          onClick={onMenu}
          className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1]"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
