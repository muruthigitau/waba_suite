import { Check, CheckCheck, Reply } from "lucide-react";
import React, { useState } from "react";
import { Message } from "../../types";
import { ContactMessage } from "../messages/ContactMessage";
import { DocumentMessage } from "../messages/DocumentMessage";
import { ImageMessage } from "../messages/ImageMessage";
import { LocationMessage } from "../messages/LocationMessage";
import { VideoMessage } from "../messages/VideoMessage";

interface MessageBubbleProps {
  message: Message;
  onReply?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onReply,
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
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default:
        return null;
    }
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
      default:
        return <p className="text-sm">{message.content}</p>;
    }
  };

  return (
    <div
      className={`flex ${message.isSent ? "justify-end" : "justify-start"} group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="relative max-w-[70%]">
        {message.replyTo && (
          <div className="mb-2 p-2 bg-gray-100 rounded text-xs text-gray-600 border-l-3 border-l-green-500">
            <p className="font-semibold text-green-600">
              Replying to {message.replyTo.sender}
            </p>
            <p className="truncate">{message.replyTo.content}</p>
          </div>
        )}

        <div
          className={`${
            message.isSent
              ? "bg-green-500 text-white"
              : "bg-white text-gray-800"
          } rounded-lg px-4 py-2 shadow-sm relative`}
        >
          {message.senderName && !message.isSent && (
            <div className="text-xs font-semibold text-green-600 mb-1">
              {message.senderName}
            </div>
          )}

          {renderContent()}

          <div className="flex items-center justify-end space-x-1 mt-1">
            <span className="text-[10px] opacity-70">{message.timestamp}</span>
            {message.isSent && getStatusIcon()}
          </div>
        </div>

        {/* Reply button on hover */}
        {onReply && showActions && (
          <button
            onClick={onReply}
            className={`absolute top-1/2 transform -translate-y-1/2 ${
              message.isSent ? "-left-8" : "-right-8"
            } p-1 bg-gray-200 rounded-full opacity-0 group-hover:opacity-100 transition`}
          >
            <Reply className="w-3 h-3 text-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
};
