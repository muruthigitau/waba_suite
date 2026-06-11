import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { chatAPI } from "../services/frappe-sdk";
import { Account, Chat, Message, UserSettings } from "../types";

interface ChatContextType {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  selectedChat: Chat | null;
  setSelectedChat: (chat: Chat | null) => void;
  messages: Record<string, Message[]>;
  addMessage: (chatId: string, message: Message) => void;
  updateMessageStatus: (
    chatId: string,
    messageId: string,
    status: Message["status"],
  ) => void;
  sendMessage: (
    chatId: string,
    content: string,
    replyTo?: Message["replyTo"],
  ) => Promise<void>;
  markMessagesAsRead: (chatId: string, roomId: string) => Promise<void>;
  userSettings: UserSettings;
  updateUserSettings: (settings: UserSettings) => Promise<void>;
  currentAccount: string;
  accounts: Account[];
  switchAccount: (accountName: string) => Promise<void>;
  isLoading: boolean;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [userSettings, setUserSettings] = useState<UserSettings>({
    enableMessageTone: true,
    enableNotifications: true,
  });
  const [currentAccount, setCurrentAccount] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const addMessage = useCallback((chatId: string, message: Message) => {
    setMessages((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), message],
    }));
  }, []);

  const updateMessageStatus = useCallback(
    (chatId: string, messageId: string, status: Message["status"]) => {
      setMessages((prev) => ({
        ...prev,
        [chatId]:
          prev[chatId]?.map((msg) =>
            msg.id === messageId ? { ...msg, status } : msg,
          ) || [],
      }));
    },
    [],
  );

  const sendMessage = useCallback(
    async (chatId: string, content: string, replyTo?: Message["replyTo"]) => {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;

      const messageId = Date.now().toString();
      const newMessage: Message = {
        id: messageId,
        content,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isSent: true,
        status: "sent",
        type: "text",
        replyTo,
      };

      addMessage(chatId, newMessage);

      // Update chat list with last message
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, lastMessage: content, timestamp: "Just now" }
            : c,
        ),
      );

      try {
        await chatAPI.sendMessage({
          content,
          user: chat.name,
          room: chat.mobileNo,
          user_no: chat.mobileNo,
          message_id: messageId,
          whatsapp_account: chat.whatsappAccount,
          reply_to_message_id: replyTo?.messageId || null,
        });

        // Simulate status updates (actual updates come via socket)
        setTimeout(
          () => updateMessageStatus(chatId, messageId, "delivered"),
          1000,
        );
        setTimeout(() => updateMessageStatus(chatId, messageId, "read"), 2000);
      } catch (error) {
        console.error("Failed to send message:", error);
        updateMessageStatus(chatId, messageId, "failed");
      }
    },
    [chats, addMessage, updateMessageStatus],
  );

  const markMessagesAsRead = useCallback(
    async (chatId: string, roomId: string) => {
      try {
        await chatAPI.markMultipleAsRead(roomId, currentAccount);

        // Update unread count in chat list
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
        );
      } catch (error) {
        console.error("Failed to mark messages as read:", error);
      }
    },
    [currentAccount],
  );

  const updateUserSettings = useCallback(async (settings: UserSettings) => {
    try {
      await chatAPI.updateUserSettings(settings);
      setUserSettings(settings);
    } catch (error) {
      console.error("Failed to update user settings:", error);
    }
  }, []);

  const switchAccount = useCallback(async (accountName: string) => {
    setIsLoading(true);
    try {
      const result = await chatAPI.switchAccount(accountName);
      if (result.success) {
        setCurrentAccount(accountName);
        // Refresh chats for new account
        await loadChats(accountName);
      }
    } catch (error) {
      console.error("Failed to switch account:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadChats = useCallback(async (accountName: string) => {
    try {
      const userEmail = localStorage.getItem("user_email") || "";
      const rooms = await chatAPI.getRooms(userEmail, accountName);

      const formattedChats: Chat[] = rooms.map((room) => ({
        id: room.name,
        name: room.contact_name || room.mobile_no,
        mobileNo: room.mobile_no,
        contactName: room.contact_name,
        avatar: (room.contact_name || room.mobile_no).charAt(0).toUpperCase(),
        lastMessage: room.last_message?.content || "",
        timestamp: room.last_message?.creation || room.modified,
        unreadCount: room.unread_incoming,
        typing: false,
        isGroup: room.type === "Group",
        whatsappAccount: accountName,
        roomType: room.type,
      }));

      setChats(formattedChats);
      setUnreadCount(
        formattedChats.reduce((sum, chat) => sum + chat.unreadCount, 0),
      );
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        chats,
        setChats,
        selectedChat,
        setSelectedChat,
        messages,
        addMessage,
        updateMessageStatus,
        sendMessage,
        markMessagesAsRead,
        userSettings,
        updateUserSettings,
        currentAccount,
        accounts,
        switchAccount,
        isLoading,
        unreadCount,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
