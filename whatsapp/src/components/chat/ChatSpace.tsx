import { ChevronLeft, MoreVertical, Phone, Video, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "../../contexts/ChatContext";
import { chatAPI } from "../../services/frappe-sdk";
import chatSocket from "../../services/socket";
import { Avatar } from "../common/Avatar";
import { MessageBubble } from "../common/MessageBubble";
import { MessageInput } from "../common/MessageInput";

interface ChatSpaceProps {
  onBack?: () => void;
  isMobile?: boolean;
}

export const ChatSpace: React.FC<ChatSpaceProps> = ({
  onBack,
  isMobile = false,
}) => {
  const {
    selectedChat,
    messages,
    addMessage,
    updateMessageStatus,
    markMessagesAsRead,
    sendMessage,
    currentAccount,
  } = useChat();
  const [replyTo, setReplyTo] = useState<null | {
    content: string;
    sender: string;
    messageId: string;
  }>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const chatMessages = selectedChat ? messages[selectedChat.id] || [] : [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  useEffect(() => {
    if (selectedChat && selectedChat.unreadCount > 0) {
      markMessagesAsRead(selectedChat.id, selectedChat.mobileNo);
    }
  }, [selectedChat, markMessagesAsRead]);

  // Load messages when chat is selected
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedChat) return;

      setIsLoading(true);
      try {
        const userEmail = localStorage.getItem("user_email") || "";
        const fetchedMessages = await chatAPI.getMessages(
          selectedChat.mobileNo,
          userEmail,
          currentAccount,
        );

        const formattedMessages = fetchedMessages.map((msg) => ({
          id: msg.name,
          content: msg.content,
          timestamp: new Date(msg.creation).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isSent: msg.type === "Outgoing",
          status: msg.status as Message["status"],
          type: msg.content_type,
          sender: msg.sender,
          senderName: msg.sender,
          attach: msg.attach,
          caption: msg.caption,
          reactions: msg.reactions,
        }));

        // Add to context
        formattedMessages.forEach((msg) => addMessage(selectedChat.id, msg));
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [selectedChat, currentAccount, addMessage]);

  // Socket event handlers
  useEffect(() => {
    if (!selectedChat) return;

    const handleNewMessage = (data: any) => {
      if (
        data.room === selectedChat.mobileNo &&
        data.whatsapp_account === currentAccount
      ) {
        const newMessage: Message = {
          id: data.name || Date.now().toString(),
          content: data.content,
          timestamp: new Date(data.creation).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isSent: false,
          status: data.status || "delivered",
          type: data.content_type || "text",
          sender: data.sender,
          senderName: data.user || data.sender,
          attach: data.attach,
          reactions: data.reactions,
        };
        addMessage(selectedChat.id, newMessage);
        scrollToBottom();

        // Mark as read immediately
        markMessagesAsRead(selectedChat.id, selectedChat.mobileNo);
      }
    };

    const handleStatusUpdate = (data: any) => {
      if (data.room === selectedChat.mobileNo) {
        updateMessageStatus(selectedChat.id, data.message_id, data.status);
      }
    };

    chatSocket.on("latest_chat_updates", handleNewMessage);
    chatSocket.on("message_status_update", handleStatusUpdate);
    chatSocket.joinRoom(selectedChat.mobileNo);

    return () => {
      chatSocket.off("latest_chat_updates", handleNewMessage);
      chatSocket.off("message_status_update", handleStatusUpdate);
      chatSocket.leaveRoom(selectedChat.mobileNo);
    };
  }, [
    selectedChat,
    currentAccount,
    addMessage,
    updateMessageStatus,
    markMessagesAsRead,
    scrollToBottom,
  ]);

  const handleSendMessage = async (content: string) => {
    if (!selectedChat) return;
    await sendMessage(selectedChat.id, content, replyTo || undefined);
    setReplyTo(null);
  };

  const handleReply = (message: Message) => {
    setReplyTo({
      content: message.content,
      sender:
        message.senderName ||
        (message.isSent ? "You" : selectedChat?.name || "Unknown"),
      messageId: message.id,
    });
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
            <MessageCircle className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            WhatsApp Web
          </h3>
          <p className="text-gray-500">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-3">
          {isMobile && (
            <button
              onClick={onBack}
              className="p-1 hover:bg-gray-100 rounded-full transition mr-2"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <Avatar name={selectedChat.name} size="md" />
          <div>
            <h3 className="font-semibold text-gray-800">{selectedChat.name}</h3>
            <p className="text-xs text-gray-500">
              {selectedChat.typing
                ? "Typing..."
                : selectedChat.online
                  ? "Online"
                  : "Offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <Video className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
      >
        {isLoading && (
          <div className="flex justify-center">
            <div className="animate-pulse text-gray-400">
              Loading messages...
            </div>
          </div>
        )}

        {chatMessages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onReply={() => handleReply(message)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="px-4 pt-2 bg-white border-t border-gray-200">
          <div className="flex items-center justify-between bg-gray-100 rounded-lg p-2 text-sm">
            <div>
              <span className="font-semibold text-green-600">
                Replying to {replyTo.sender}
              </span>
              <p className="text-gray-600 truncate max-w-md">
                {replyTo.content}
              </p>
            </div>
            <button
              onClick={cancelReply}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <MessageInput onSend={handleSendMessage} />
    </div>
  );
};
