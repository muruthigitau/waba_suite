import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { MessageCircleCheck, Paperclip, Send, Smile, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Chat, Message } from "../../types";
import { Loader } from "../common/Loader";
import { MessageBubble } from "../common/MessageBubble";
import { ChatHeader } from "../layout/ChatHeader";

interface ChatSpaceProps {
  chat: Chat | null;
  currentAccount: string;
  onSendMessage: (
    content: string,
    replyTo?: Message,
    chat?: Chat,
  ) => Promise<void>;
  onMarkAsRead?: (chat: Chat) => Promise<void>;
  onReact?: (messageId: string, emoji: string) => void;
  onBack?: () => void;
  isMobile?: boolean;
}

export const ChatSpace: React.FC<ChatSpaceProps> = ({
  chat,
  currentAccount,
  onSendMessage,
  onMarkAsRead,
  onReact,
  onBack,
  isMobile = false,
}) => {
  const [messageInput, setMessageInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data: messagesData,
    mutate: mutateMessages,
    isLoading,
  } = useFrappeGetCall<{
    message: any[];
  }>(
    "waba_suite.api.message.get_all",
    {
      room: chat?.mobileNo || "",
      user_no: "",
      whatsapp_account: currentAccount,
    },
    chat ? undefined : { enabled: false },
  );

  const { call: sendMessageCall } = useFrappePostCall(
    "waba_suite.api.message.send",
  );
  const { call: markMultipleAsReadCall } = useFrappePostCall(
    "waba_suite.api.message.mark_multiple_as_read",
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const formattedMessages = useMemo(() => {
    if (!messagesData?.message || !Array.isArray(messagesData.message)) {
      return [];
    }
    return messagesData.message.map((msg: any) => ({
      id: msg.name,
      content: msg.content || msg.message || "",
      timestamp: new Date(msg.creation).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      fullTimestamp: new Date(msg.creation),
      isSent: msg.type === "Outgoing",
      status: msg.status || "sent",
      type: msg.content_type || "text",
      reactions: msg.reactions,
      senderName: msg.sender_name || msg.sender,
      caption: msg.caption,
      attach: msg.attach,
      locationData: msg.location_data,
      contactData: msg.contact_data,
      buttonData: msg.button_data,
      interactiveData: msg.interactive_data,
    }));
  }, [messagesData]);

  useEffect(() => {
    if (formattedMessages.length > 0) {
      setMessages(formattedMessages);
    } else if (formattedMessages.length === 0 && messagesData?.message) {
      setMessages([]);
    }
  }, [formattedMessages, messagesData]);

  useEffect(() => {
    if (chat && chat.unreadCount > 0 && onMarkAsRead) {
      onMarkAsRead(chat);
      markMultipleAsReadCall({
        whatsapp_contact: chat.mobileNo,
        whatsapp_account: currentAccount,
      }).catch(console.error);
    }
  }, [chat, messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!messageInput.trim() || !chat) return;
    await onSendMessage(messageInput, replyTo || undefined, chat);
    setMessageInput("");
    setReplyTo(null);
    await mutateMessages();
    scrollToBottom();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (onReact) {
      onReact(messageId, emoji);
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0b141a]">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#202c33] flex items-center justify-center">
            <MessageCircleCheck className="w-12 h-12 text-[#aebac1]" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            WhatsApp Web
          </h3>
          <p className="text-[#8696a0]">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a]">
      <ChatHeader
        chat={chat}
        onBack={onBack}
        isMobile={isMobile}
        onVoiceCall={() => {}}
        onVideoCall={() => {}}
        onMenu={() => {}}
      />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-[#0b141a] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHZpZXdCb3g9IjAgMCA4IDgiPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6bTQgNGg0djRINHoiIGZpbGw9IiMxYzI5MzAiLz48L3N2Zz4=')] bg-repeat">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center mb-3">
              <MessageCircleCheck className="w-8 h-8 text-[#8696a0]" />
            </div>
            <p className="text-[#8696a0] text-sm">No messages yet</p>
            <p className="text-[#8696a0] text-xs mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onReply={handleReply}
                onReact={handleReact}
                isGroup={chat.isGroup}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {replyTo && (
        <div className="px-4 pt-2 bg-[#202c33] border-t border-[#2a3942]">
          <div className="flex items-center justify-between bg-[#2a3942] rounded-lg p-2 text-sm">
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-[#25D366] text-xs">
                Replying to{" "}
                {replyTo.isSent ? "yourself" : replyTo.senderName || chat.name}
              </span>
              <p className="text-[#d1d7db] text-xs truncate">
                {replyTo.content}
              </p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="p-1 hover:bg-[#202c33] rounded ml-2"
            >
              <X className="w-4 h-4 text-[#aebac1]" />
            </button>
          </div>
        </div>
      )}

      <div className="p-3 bg-[#202c33] border-t border-[#2a3942]">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1]"
          >
            <Smile className="w-5 h-5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1]"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" multiple />
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message"
            className="flex-1 px-4 py-2 bg-[#2a3942] rounded-full text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
          />
          <button
            onClick={handleSend}
            disabled={!messageInput.trim()}
            className="p-2 bg-[#25D366] hover:bg-[#20b859] rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
