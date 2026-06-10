import { Check, CheckCheck, Clock, MoreHorizontal, Reply } from "lucide-react";
import React, { useState } from "react";
import type { Message } from "../../types";
import { ContactMessage } from "../messages/ContactMessage";
import { DocumentMessage } from "../messages/DocumentMessage";
import { ImageMessage } from "../messages/ImageMessage";
import { LocationMessage } from "../messages/LocationMessage";
import { ReactionMessage } from "../messages/ReactionMessage";
import { VideoMessage } from "../messages/VideoMessage";

interface MessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  isGroup?: boolean;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onReply,
  onReact,
  onDelete,
  isGroup = false,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const getStatusIcon = () => {
    if (!message.isSent) return null;

    switch (message.status) {
      case "sent":
        return <Check className="w-3 h-3" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3" />;
      case "read":
        return <CheckCheck className="w-3 h-3 text-[#53bdeb]" />;
      case "failed":
        return <Clock className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderContent = () => {
    switch (message.type) {
      case "image":
        return (
          <ImageMessage
            src={message.attach || message.content}
            caption={message.caption}
          />
        );
      case "video":
        return (
          <VideoMessage
            src={message.attach || message.content}
            caption={message.caption}
          />
        );
      case "document":
        return (
          <DocumentMessage
            fileUrl={message.attach || message.content}
            fileName={message.content}
          />
        );
      case "location":
        return <LocationMessage location={message.locationData!} />;
      case "contact":
        return <ContactMessage contact={message.contactData!} />;
      case "reaction":
        return <ReactionMessage emoji={message.content} />;
      default:
        return (
          <p className="text-sm leading-relaxed break-words">
            {message.content}
          </p>
        );
    }
  };

  const handleReaction = (emoji: string) => {
    if (onReact) {
      onReact(message.id, emoji);
    }
    setShowReactionPicker(false);
  };

  return (
    <div
      className={`flex ${message.isSent ? "justify-end" : "justify-start"} group relative`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }}
    >
      <div className={`max-w-[65%] relative`}>
        {message.replyTo && (
          <div className="mb-1.5 p-1.5 bg-black bg-opacity-20 rounded text-xs border-l-2 border-[#25D366]">
            <p className="font-semibold text-[#25D366] text-[11px]">
              {message.replyTo.sender}
            </p>
            <p className="text-[11px] text-[#d1d7db] truncate">
              {message.replyTo.content}
            </p>
          </div>
        )}

        <div
          className={`${
            message.isSent
              ? "bg-[#005c4b] text-white"
              : "bg-[#202c33] text-white"
          } rounded-lg px-3 py-1.5 shadow-sm relative`}
        >
          {isGroup && !message.isSent && message.senderName && (
            <div className="text-xs font-semibold text-[#25D366] mb-1">
              {message.senderName}
            </div>
          )}

          {renderContent()}

          <div className="flex items-center justify-end space-x-1 mt-1">
            <span className="text-[10px] text-[#8696a0]">
              {formatTime(message.fullTimestamp)}
            </span>
            {message.isSent && getStatusIcon()}
          </div>
        </div>

        {message.reactions && message.reactions.length > 0 && (
          <div
            className={`absolute -bottom-3 ${message.isSent ? "left-0" : "right-0"} flex space-x-0.5`}
          >
            {message.reactions.slice(0, 3).map((reaction, idx) => (
              <div
                key={idx}
                className="bg-[#202c33] rounded-full px-1.5 py-0.5 text-xs border border-[#2a3942] shadow-sm"
              >
                {reaction.emoji}{" "}
                {reaction.count > 1 && (
                  <span className="text-[10px]">{reaction.count}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {showActions && onReply && (
          <div
            className={`absolute top-1/2 transform -translate-y-1/2 flex space-x-1 ${message.isSent ? "-left-12" : "-right-12"}`}
          >
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="p-1.5 bg-[#2a3942] rounded-full hover:bg-[#3b4a54] transition shadow-lg"
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-[#aebac1]" />
            </button>
            <button
              onClick={() => onReply(message)}
              className="p-1.5 bg-[#2a3942] rounded-full hover:bg-[#3b4a54] transition shadow-lg"
            >
              <Reply className="w-3.5 h-3.5 text-[#aebac1]" />
            </button>
          </div>
        )}

        {showReactionPicker && (
          <div
            className={`absolute bottom-full mb-2 flex space-x-1 bg-[#202c33] rounded-full p-1.5 shadow-xl border border-[#2a3942] z-10 ${message.isSent ? "right-0" : "left-0"}`}
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="w-7 h-7 hover:bg-[#2a3942] rounded-full transition text-lg flex items-center justify-center"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
