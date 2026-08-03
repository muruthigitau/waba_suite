import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { MessageCircleCheck, MessageSquareText, Paperclip, Send, Smile, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCache } from "../../contexts/CacheContext";
import { useMessageGrouping } from "../../hooks/useMessageGrouping";
import syncEngine from "../../services/syncEngine";
import type { Chat, Message } from "../../types";
import { FileUploadField } from "../common/FileUploadField";
import { Loader } from "../common/Loader";
import { MessageBubble } from "../common/MessageBubble";
import { ChatHeader } from "../layout/ChatHeader";
import { TemplateMessage } from "../messages/TemplateMessage";
import { EmojiPicker } from "../modals/EmojiPicker";
import { TemplateModal } from "../modals/TemplateModal";

const WINDOW_HOURS_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  onTogglePin?: (chatId: string) => void;
  onToggleStar?: (chatId: string) => void;
  onToggleArchive?: (chatId: string) => void;
  within24hWindow?: boolean;
}

export const ChatSpace: React.FC<ChatSpaceProps> = ({
  chat,
  currentAccount,
  onMarkAsRead,
  onReact,
  onBack,
  isMobile = false,
  onTogglePin,
  onToggleStar,
  onToggleArchive,
  within24hWindow,
}) => {
  const {
    isOnline,
    hydrateMessages,
    cacheMessages,
    syncNewChatMessages,
    queueOfflineMessage,
  } = useCache();
  const [messageInput, setMessageInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [globalEmojiPicker, setGlobalEmojiPicker] = useState<{
    isOpen: boolean;
    onSelect: (emoji: string) => void;
  }>({ isOpen: false, onSelect: () => {} });
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [uploadedFileData, setUploadedFileData] = useState<any>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // ─── 24-hour WhatsApp window ─────────────────────────────────────────────
  // Free-form messages (text, media, reactions) are only deliverable within a
  // 24h customer-service window. Outside it, only template messages are allowed.
  // Prefer the prop (set when opening a new/draft contact); otherwise derive
  // from the most recent incoming message timestamp in the loaded messages.
  const templateOnly = useMemo(() => {
    if (typeof within24hWindow === "boolean") {
      return !within24hWindow;
    }
    const now = new Date().getTime();
    const latestIncoming = messages
      .filter((m) => !m.isSent)
      .reduce(
        (max, m) =>
          m.fullTimestamp.getTime() > max ? m.fullTimestamp.getTime() : max,
        0,
      );
    return latestIncoming === 0 || now - latestIncoming > WINDOW_HOURS_MS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [within24hWindow]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileUploadRef = useRef<{
    openSelector: () => void;
    uploadDirectFile: (file: File) => Promise<void>;
  } | null>(null);
  const lastChatIdRef = useRef<string | null>(null);

  const {
    data: messagesData,
    mutate: mutateMessages,
    isLoading,
  } = useFrappeGetCall<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: any[];
  }>(
    "waba_suite.api.message.get_all",
    {
      room: chat?.id || "",
      user_no: chat?.mobileNo || "",
      whatsapp_account: currentAccount,
    },
    chat ? undefined : { enabled: false, revalidateOnFocus: false },
  );

  const { call: markMultipleAsReadCall } = useFrappePostCall(
    "waba_suite.api.message.mark_multiple_as_read",
  );

  const { call: sendMessageCall, loading: isSending } = useFrappePostCall<{
    message: {
      status: string;
      message_id?: string;
    };
  }>("waba_suite.api.message.send");

  // Register get_all as the incremental sync callable so syncEngine can
  // fetch only messages newer than the last cached timestamp.
  const { call: getMessagesCallBack } = useFrappePostCall<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: any[];
  }>("waba_suite.api.message.get_all");

  useEffect(() => {
    syncEngine.setGetMessagesCall(getMessagesCallBack);
    return () => {
      syncEngine.setGetMessagesCall(null);
    };
  }, [getMessagesCallBack]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const formattedMessages = useMemo(() => {
    if (!messagesData?.message || !Array.isArray(messagesData.message)) {
      return [];
    }

    const rawList = messagesData.message;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rawList.map((msg: any) => {
      let reactions = null;
      if (msg.reactions) {
        try {
          reactions =
            typeof msg.reactions === "string"
              ? JSON.parse(msg.reactions)
              : msg.reactions;
        } catch (e) {
          console.error("Failed to parse reactions:", e);
          reactions = null;
        }
      }

      let parsedReplyTo = undefined;
      if (msg.is_reply === 1 && msg.reply_to_message) {
        const parentMsg = rawList.find((m) => m.name === msg.reply_to_message);
        if (parentMsg) {
          parsedReplyTo = {
            messageId: parentMsg.name,
            content: parentMsg.content || parentMsg.message || "",
            sender:
              parentMsg.type === "Outgoing"
                ? "You"
                : parentMsg.sender_name ||
                  parentMsg.sender ||
                  chat?.name ||
                  "Contact",
            contentType: parentMsg.content_type || "text",
          };
        } else {
          parsedReplyTo = {
            messageId: msg.reply_to_message,
            content: "Message",
            sender: "Reply",
            contentType: "text",
          };
        }
      }

      // For template messages, use the message field (JSON) for TemplateMessage component
      // Also pass raw template definition fields for proper rendering
      const templateContent = msg.use_template ? (msg.message || msg.content || "") : (msg.content || msg.message || "");

      return {
        id: msg.name,
        content: templateContent,
        timestamp: new Date(msg.creation).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        fullTimestamp: new Date(msg.creation),
        isSent: msg.type === "Outgoing",
        status: msg.status || "sent",
        type: msg.content_type || "text",
        isTemplate: msg.use_template === 1 || msg.use_template === true,
        reactions: reactions,
        senderName: msg.sender_name || msg.sender,
        caption: msg.caption,
        attach: msg.attach,
        locationData: msg.location_data,
        contactData: msg.contact_data,
        buttonData: msg.button_data,
        interactiveData: msg.interactive_data,
        replyTo: parsedReplyTo,
        templateRaw: msg.use_template ? {
          header: msg.template_header_raw || "",
          body: msg.template_body_raw || "",
          footer: msg.template_footer_raw || "",
        } : undefined,
      };
    });
  }, [messagesData, chat]);

  // ─── Offline-first: hydrate messages from Dexie immediately ───
  // We only clear state when the chat actually changes, not on every render.
  useEffect(() => {
    const chatId = chat?.id ?? null;
    if (chatId !== lastChatIdRef.current) {
      lastChatIdRef.current = chatId;
      if (!chatId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages([]);
      } else {
        // Reset to empty so the previous chat's messages don't flash
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages([]);
        const hydrate = async () => {
          const cached = await hydrateMessages(chatId);
          if (cached.length > 0 && lastChatIdRef.current === chatId) {
            setMessages(cached);
          }
        };
        hydrate();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  // Merge hydrated Dexie data with optimistic/sent messages. This runs in an
  // effect only when formattedMessages changes (server data arrives/updates).
  useEffect(() => {
    if (formattedMessages.length > 0) {
      // Cache the server messages to Dexie for offline use
      if (chat) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cacheMessages(formattedMessages as any, chat.id).catch(() => {});
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages((prev) => {
        const mergedMap = new Map<string, Message>();
        formattedMessages.forEach((m) => mergedMap.set(m.id, m));
        // Preserve optimistic local messages not yet on the server
        prev.forEach((m) => {
          if (!mergedMap.has(m.id)) {
            mergedMap.set(m.id, m);
          }
        });
        return Array.from(mergedMap.values()).sort(
          (a, b) => a.fullTimestamp.getTime() - b.fullTimestamp.getTime(),
        );
      });
    }
  }, [formattedMessages, chat, cacheMessages]);

  // Incremental sync: when online, fetch only messages newer than the last
  // cached timestamp and store them in Dexie.
  useEffect(() => {
    if (!chat || !isOnline) return;

    let cancelled = false;
    const syncIncremental = async () => {
      try {
        const count = await syncNewChatMessages(
          chat.id,
          chat.mobileNo,
          chat.whatsappAccount || currentAccount,
        );
        if (!cancelled && count > 0) {
          const updated = await hydrateMessages(chat.id);
          if (!cancelled) {
            setMessages((prev) => {
              const mergedMap = new Map<string, Message>();
              updated.forEach((m) => mergedMap.set(m.id, m));
              prev.forEach((m) => mergedMap.set(m.id, m));
              return Array.from(mergedMap.values()).sort(
                (a, b) => a.fullTimestamp.getTime() - b.fullTimestamp.getTime(),
              );
            });
          }
        }
      } catch (e) {
        // Offline or server error — Dexie data is already shown
        console.debug("Incremental sync skipped:", e);
      }
    };
    syncIncremental();

    return () => {
      cancelled = true;
    };
  }, [chat, isOnline, currentAccount, syncNewChatMessages, hydrateMessages]);

  useEffect(() => {
    if (chat && chat.unreadCount > 0 && onMarkAsRead) {
      onMarkAsRead(chat);
      markMultipleAsReadCall({
        whatsapp_contact: chat.mobileNo,
        whatsapp_account: currentAccount,
      }).catch(console.error);
    }
  }, [chat, messages, onMarkAsRead, currentAccount, markMultipleAsReadCall]);

  // Poll for new messages every 5s — but only while online
  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (chat && isOnline) {
      mutateMessages();
      pollingIntervalRef.current = setInterval(() => {
        mutateMessages();
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [chat, mutateMessages, isOnline]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Show/hide the scroll-to-bottom button as the user scrolls.
  const handleMessagesScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distanceFromBottom > 150);
    },
    [],
  );

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
    setShowScrollBtn(false);
  }, [scrollToBottom]);

  // Group messages the way WhatsApp does: date chips between days, and
  // consecutive messages from the same sender collapsed together.
  const groupedMessages = useMessageGrouping(messages);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!chat || templateOnly) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            setShowFileUpload(true);
            setTimeout(() => {
              if (fileUploadRef.current) {
                fileUploadRef.current.uploadDirectFile(file);
              }
            }, 50);
            break;
          }
        }
      }
    },
    [chat, templateOnly],
  );

  const sendMessageDirect = useCallback(
    async (
      content: string,
      replyToMessage?: Message | null,
      fileUrl?: string | null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileData?: any,
    ) => {
      if (!chat || isSending) return;

      // ─── Outside the 24h window: only template messages allowed ───
      if (templateOnly) return;

      const messageId = Date.now().toString();
      const messageContent = content.trim() || fileData?.file_name || "File";

      const optimisticMessage: Message = {
        id: messageId,
        content: messageContent,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        fullTimestamp: new Date(),
        isSent: true,
        status: "sending",
        type: fileData?.content_type || "text",
        isTemplate: false,
        replyTo: replyToMessage
          ? {
              content: replyToMessage.content,
              sender: replyToMessage.isSent
                ? "You"
                : replyToMessage.senderName || chat.name,
              messageId: replyToMessage.id,
              contentType: replyToMessage.type,
            }
          : undefined,
        attach: fileUrl || undefined,
        caption: content.trim() ? content.trim() : fileData?.caption,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      scrollToBottom();

      // ─── Offline path: persist to Dexie + queue for background sync ───
      if (!isOnline) {
        await queueOfflineMessage(
          chat,
          messageContent,
          messageId,
          replyToMessage || undefined,
          fileUrl || undefined,
        );
        return;
      }

      try {
        const response = await sendMessageCall({
          content: messageContent,
          user: chat.name,
          room: chat.id,
          user_no: chat.mobileNo,
          message_id: messageId,
          whatsapp_account: chat.whatsappAccount || currentAccount,
          reply_to_message_id: replyToMessage?.id || null,
          content_type: fileData?.content_type || "text",
          attachment: fileUrl,
          caption: content.trim() ? content.trim() : fileData?.caption,
        });

        if (response?.message?.status === "ok") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, status: "sent" } : msg,
            ),
          );
          await mutateMessages();
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, status: "failed" } : msg,
            ),
          );
          console.error("Failed to send message:", response?.message);
        }
      } catch (error) {
        // ─── Network failure: queue for retry when back online ───
        console.error("Failed to send message, queuing for retry:", error);
        await queueOfflineMessage(
          chat,
          messageContent,
          messageId,
          replyToMessage || undefined,
          fileUrl || undefined,
        );
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "failed" } : msg,
          ),
        );
      }
    },
    [
      chat,
      sendMessageCall,
      mutateMessages,
      scrollToBottom,
      isSending,
      currentAccount,
      isOnline,
      queueOfflineMessage,
    ],
  );

  const handleSend = async () => {
    if (!chat || isSending) return;

    if (uploadedFileUrl) {
      await sendMessageDirect(
        messageInput,
        replyTo,
        uploadedFileUrl,
        uploadedFileData,
      );
      setUploadedFileUrl(null);
      setUploadedFileData(null);
      setMessageInput("");
      setReplyTo(null);
      setShowFileUpload(false);
    } else if (messageInput.trim()) {
      await sendMessageDirect(messageInput, replyTo);
      setMessageInput("");
      setReplyTo(null);
    }
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

  const handleReact = async (messageId: string, emoji: string) => {
    if (!chat || templateOnly) return;

    if (onReact) {
      onReact(messageId, emoji);
    }

    try {
      await sendMessageCall({
        content: emoji,
        user: chat.name,
        room: chat.id,
        user_no: chat.mobileNo,
        attachment: null,
        message_id: Date.now().toString(),
        whatsapp_account: chat.whatsappAccount || currentAccount,
        reply_to_message_id: messageId,
        content_type: "reaction",
      });
      await mutateMessages();
    } catch (error) {
      console.error("Failed to sync reaction status:", error);
    }
  };

  const openInputEmojiPicker = () => {
    if (templateOnly) return;
    setGlobalEmojiPicker({
      isOpen: true,
      onSelect: (emoji) => setMessageInput((prev) => prev + emoji),
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFileUploadComplete = (fileUrl: string | null, fileData?: any) => {
    if (fileUrl) {
      setUploadedFileUrl(fileUrl);
      setUploadedFileData(fileData);
    } else {
      setShowFileUpload(false);
      setUploadedFileUrl(null);
      setUploadedFileData(null);
    }
  };

  const handlePaperclipClick = () => {
    if (templateOnly) {
      setShowTemplateModal(true);
      return;
    }
    if (showFileUpload) {
      fileUploadRef.current?.openSelector();
    } else {
      setShowFileUpload(true);
      setTimeout(() => {
        fileUploadRef.current?.openSelector();
      }, 50);
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0b141a] h-full">
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
    <div
      className="flex-1 flex flex-col h-full bg-[#0b141a] overflow-hidden relative"
      onPaste={handlePaste}
    >
      <ChatHeader
        chat={chat}
        onBack={onBack}
        isMobile={isMobile}
        onTogglePin={onTogglePin}
        onToggleStar={onToggleStar}
        onToggleArchive={onToggleArchive}
      />

      {/* Templates-only banner when outside the 24h window */}
      {templateOnly && (
        <div className="flex items-center justify-center px-4 py-2 bg-[#1f2d33] border-b border-[#2a3942] gap-2">
          <MessageSquareText className="w-4 h-4 text-[#ffc107]" />
          <span className="text-xs text-[#d1d7db]">
            This contact is outside the 24-hour window. Only template messages
            can be sent.
          </span>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="text-xs font-medium text-[#25D366] hover:text-[#20b859] transition"
          >
            Open Templates
          </button>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto px-4 py-3 bg-[#0b141a] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHZpZXdCb3g9IjAgMCA4IDgiPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6bTQgNGg0djRINHoiIGZpbGw9IiMxYzI5MzAiLz48L3N2Zz4=')] bg-repeat"
        style={{
          overflowY: "auto",
          scrollBehavior: "smooth",
        }}
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center min-h-[400px]">
            <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center mb-3">
              <MessageCircleCheck className="w-8 h-8 text-[#8696a0]" />
            </div>
            <p className="text-[#8696a0] text-sm">No messages yet</p>
            <p className="text-[#8696a0] text-xs mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          <div className="max-w-[1000px] mx-auto flex flex-col space-y-0.5">
            {groupedMessages.map((g) => {
              if (g.kind === "date") {
                return (
                  <div key={g.key} className="flex justify-center my-3">
                    <span className="px-3 py-1 text-[11px] font-medium text-[#8696a0] bg-[#182229]/90 rounded-md shadow-sm">
                      {g.label}
                    </span>
                  </div>
                );
              }

              const message = g.message!;

              if (message.isTemplate) {
                return (
                  <div
                    key={g.key}
                    className={`flex ${message.isSent ? "justify-end" : "justify-start"} ${g.isFirstOfBatch ? "mt-3" : "mt-0.5"}`}
                  >
                    <div
                      className={`max-w-[70%] ${
                        message.isSent
                          ? "bg-[#005c4b] text-white"
                          : "bg-[#202c33] text-white"
                      } rounded-lg px-3 py-1.5 shadow-sm`}
                    >
                      <TemplateMessage content={message.content} />
                      <div className="flex items-center justify-end space-x-1 mt-1">
                        <span className="text-[10px] text-[#8696a0]">
                          {message.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={g.key} className={g.isFirstOfBatch ? "mt-3" : "mt-0.5"}>
                  <MessageBubble
                    message={message}
                    // Outside the 24h window, hide replies/reactions
                    onReply={templateOnly ? undefined : handleReply}
                    onReact={templateOnly ? undefined : handleReact}
                    isGroup={chat.isGroup}
                    setGlobalEmojiPicker={setGlobalEmojiPicker}
                  />
                </div>
              );
            })}

            {/* Scroll-to-bottom floating button */}
            {showScrollBtn && (
              <button
                onClick={handleScrollToBottom}
                className="absolute bottom-[110px] right-6 z-20 w-11 h-11 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-lg hover:bg-[#008f72] transition"
                title="Scroll to latest"
              >
                <Send className="w-5 h-5 -rotate-90" />
              </button>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {replyTo && (
        <div className="px-4 pt-2 bg-[#202c33] border-t border-[#2a3942] flex-shrink-0">
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
              className="p-1 hover:bg-[#202c33] rounded ml-2 flex-shrink-0"
            >
              <X className="w-4 h-4 text-[#aebac1]" />
            </button>
          </div>
        </div>
      )}

      {showFileUpload && (
        <div className="p-3 bg-[#202c33] border-t border-[#2a3942] flex-shrink-0">
          <FileUploadField
            ref={fileUploadRef}
            value={uploadedFileUrl || undefined}
            onChange={handleFileUploadComplete}
            doctype="WhatsApp Contact"
            docname={chat.id}
            fieldname="attachment"
            isPrivate={false}
            accept=".pdf,.png,.jpg,.jpeg,.mp4,.mp3,.doc,.docx,.xls,.xlsx,.txt"
            isMobile={isMobile}
          />
          {uploadedFileUrl && (
            <div className="mt-2 text-xs text-[#25D366] flex items-center gap-1">
              <span>
                File uploaded successfully. Type a message below to send as
                caption.
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setShowFileUpload(false);
                setUploadedFileUrl(null);
                setUploadedFileData(null);
              }}
              className="px-4 py-2 rounded-lg bg-[#2a3942] text-white hover:bg-[#3b4a54] transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Outside the 24h window: remove input/file entirely, templates only */}
      {templateOnly ? (
        <div className="p-3 bg-[#202c33] border-t border-[#2a3942] flex-shrink-0">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#25D366] hover:bg-[#20b859] rounded-lg transition"
          >
            <MessageSquareText className="w-4 h-4" />
            Send Template Message
          </button>
        </div>
      ) : (
        <div className="p-3 bg-[#202c33] border-t border-[#2a3942] flex-shrink-0 relative">
          <div className="flex items-center space-x-3">
            <button
              onClick={openInputEmojiPicker}
              className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1] flex-shrink-0"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              onClick={handlePaperclipClick}
              className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1] flex-shrink-0"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="p-2 hover:bg-[#2a3942] rounded-full transition text-[#aebac1] flex-shrink-0"
              title="Send template message"
            >
              <MessageSquareText className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                uploadedFileUrl
                  ? "Add a caption to your file..."
                  : "Type a message"
              }
              className="flex-1 px-4 py-2 bg-[#2a3942] rounded-full text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366] min-w-0"
              disabled={isSending}
            />
            <button
              onClick={handleSend}
              disabled={isSending || (!uploadedFileUrl && !messageInput.trim())}
              className="p-2 bg-[#25D366] hover:bg-[#20b859] rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isSending ? (
                <Loader size="sm" color="white" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      )}

      {globalEmojiPicker.isOpen && (
        <EmojiPicker
          onEmojiSelect={globalEmojiPicker.onSelect}
          onClose={() =>
            setGlobalEmojiPicker((prev) => ({ ...prev, isOpen: false }))
          }
        />
      )}

      <TemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        chat={chat}
        currentAccount={currentAccount}
        onSent={() => mutateMessages()}
      />
    </div>
  );
};

export default ChatSpace;