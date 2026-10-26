import {
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  DownloadCloud,
  Eye,
  SmilePlus,
} from "lucide-react";
import React, { useState } from "react";
import type { Message } from "../../types";
import { fileNameFromUrl } from "../../utils/messagePreview";
import { ContactMessage } from "../messages/ContactMessage";
import { DocumentMessage } from "../messages/DocumentMessage";
import { ImageMessage } from "../messages/ImageMessage";
import { LocationMessage } from "../messages/LocationMessage";
import { ReactionMessage } from "../messages/ReactionMessage";
import { TemplateMessage } from "../messages/TemplateMessage";
import { VideoMessage } from "../messages/VideoMessage";
import { MessageReference } from "./MessageReference";

interface MessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  /** Called when the reply reference is clicked (scroll to the source). */
  onJumpToMessage?: (messageId: string) => void;
  isGroup?: boolean;
  setGlobalEmojiPicker: React.Dispatch<
    React.SetStateAction<{
      isOpen: boolean;
      onSelect: (emoji: string) => void;
    }>
  >;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onReply,
  onReact,
  onDelete,
  onJumpToMessage,
  isGroup = false,
  setGlobalEmojiPicker,
}) => {
  const [showActions, setShowActions] = useState(false);

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

  const handleDownloadFile = (url: string, defaultName: string) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName || "download";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleViewFile = (url: string) => {
    if (url) window.open(url, "_blank");
  };

  const fileUrl = message.attach || message.content;
  const isMediaFile = ["image", "video", "document"].includes(
    message.type || "",
  );

  const renderContent = () => {
    const captionText = message.caption || message.content;
    const hasCaption =
      message.caption ||
      (message.content && message.content !== message.attach);

    switch (message.type) {
      case "image":
        return (
          <ImageMessage
            src={message.attach || message.content}
            caption={hasCaption ? captionText : undefined}
          />
        );
      case "video":
        return (
          <VideoMessage
            src={message.attach || message.content}
            caption={hasCaption ? captionText : undefined}
          />
        );
      case "document":
        return (
          <DocumentMessage
            fileUrl={message.attach || message.content}
            fileName={
              fileNameFromUrl(message.attach || message.content) ||
              message.caption ||
              "Document"
            }
            caption={hasCaption ? captionText : undefined}
          />
        );
      case "location":
        return message.locationData ? (
          <LocationMessage location={message.locationData} />
        ) : (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.content || "Location shared"}
          </p>
        );
      case "contact":
        return message.contactData ? (
          <ContactMessage contact={message.contactData} />
        ) : (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.content || "Contact shared"}
          </p>
        );
      case "reaction":
        return <ReactionMessage emoji={message.content} />;
      default:
        const isTemplate = /<div[^>]*style="font-family:Arial[^>]*>/.test(
          message.content,
        );
        if (isTemplate) {
          return <TemplateMessage content={message.content} />;
        }
        const isHtml = /<[a-z][\s\S]*>/i.test(message.content);
        if (isHtml) {
          const temp = document.createElement("div");
          temp.innerHTML = message.content;
          const scripts = temp.getElementsByTagName("script");
          for (let i = scripts.length - 1; i >= 0; i--) {
            scripts[i].remove();
          }
          return (
            <div
              className="text-sm leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: temp.innerHTML }}
            />
          );
        }
        return (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
          </p>
        );
    }
  };

  const handleReaction = (emoji: string) => {
    if (onReact) {
      onReact(message.id, emoji);
    }
  };

  const userReactionMap = React.useMemo(() => {
    if (!message.reactions || !Array.isArray(message.reactions)) return {};
    return message.reactions.reduce((acc: Record<string, boolean>, r: any) => {
      if (r.user_reacted || r.is_self) {
        acc[r.emoji] = true;
      }
      return acc;
    }, {});
  }, [message.reactions]);

  const openBubbleEmojiPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setGlobalEmojiPicker({
      isOpen: true,
      onSelect: handleReaction,
    });
  };

  return (
    <div
      className={`flex ${message.isSent ? "justify-end pr-2" : "justify-start pl-2"} group relative mb-3`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="max-w-[70%] relative">
        {message.replyTo && (
          <div className="mb-1.5 p-1.5 bg-black bg-opacity-20 rounded text-xs border-l-2 border-[#25D366]">
            <MessageReference
              sender={message.replyTo.sender}
              type={message.replyTo.contentType}
              content={message.replyTo.content}
              attach={message.replyTo.attach}
              caption={message.replyTo.caption}
              onClick={
                onJumpToMessage
                  ? () => onJumpToMessage(message.replyTo!.messageId)
                  : undefined
              }
            />
          </div>
        )}

        <div
          className={`relative rounded-lg px-3 py-1.5 shadow-sm ${
            message.isSent
              ? "bg-[#005c4b] text-white rounded-tr-none after:content-[''] after:absolute after:top-0 after:right-[-8px] after:w-0 after:height-0 after:border-t-[8px] after:border-t-[#005c4b] after:border-r-[8px] after:border-r-transparent"
              : "bg-[#202c33] text-white rounded-tl-none after:content-[''] after:absolute after:top-0 after:left-[-8px] after:w-0 after:height-0 after:border-t-[8px] after:border-t-[#202c33] after:border-l-[8px] after:border-l-transparent"
          }`}
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
            className={`absolute -bottom-3 ${message.isSent ? "left-2" : "right-2"} flex space-x-0.5 z-20`}
          >
            {message.reactions.slice(0, 3).map((reaction, idx) => {
              const isSelected = userReactionMap[reaction.emoji];
              return (
                <button
                  key={idx}
                  onClick={() => handleReaction(reaction.emoji)}
                  className={`rounded-full px-1.5 py-0.5 text-xs border shadow-sm transition ${
                    isSelected
                      ? "bg-[#005c4b] border-[#25D366] text-white"
                      : "bg-[#202c33] border-[#2a3942] text-[#aebac1] hover:bg-[#2a3942]"
                  }`}
                >
                  {reaction.emoji}{" "}
                  {reaction.count > 1 && (
                    <span className="text-[10px] ml-0.5">{reaction.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {showActions && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 p-1 bg-[#202c33] border border-[#2a3942] rounded-full shadow-xl transition-all duration-150 ${
              message.isSent ? "-left-32" : "-right-32"
            } z-30`}
          >
            <button
              onClick={openBubbleEmojiPicker}
              className="p-1.5 text-[#aebac1] hover:text-white hover:bg-[#2a3942] rounded-full transition"
              title="Add Reaction"
            >
              <SmilePlus className="w-4 h-4" />
            </button>
            {onReply && (
              <button
                onClick={() => onReply(message)}
                className="p-1.5 text-[#aebac1] hover:text-white hover:bg-[#2a3942] rounded-full transition"
                title="Reply"
              >
                <CornerUpLeft className="w-4 h-4" />
              </button>
            )}
            {isMediaFile && fileUrl && (
              <>
                <button
                  onClick={() =>
                    handleDownloadFile(fileUrl, message.content || "attachment")
                  }
                  className="p-1.5 text-[#aebac1] hover:text-white hover:bg-[#2a3942] rounded-full transition"
                  title="Download"
                >
                  <DownloadCloud className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleViewFile(fileUrl)}
                  className="p-1.5 text-[#aebac1] hover:text-white hover:bg-[#2a3942] rounded-full transition"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
