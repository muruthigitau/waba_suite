import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  chatRepo,
  messageRepo,
  routeRepo,
  accountRepo,
  userSettingsRepo,
} from "../services/repository";
import syncEngine from "../services/syncEngine";
import type {
  DexieChat,
  DexieMessage,
  DexieAccount,
  DexieUserSettings,
} from "../services/db";
import type {
  Chat,
  Message,
  Account,
  Room,
  RawMessage,
} from "../types";

interface CacheContextType {
  isReady: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: string | undefined;
  hydrateChats: (accountName: string) => Promise<Chat[]>;
  hydrateMessages: (chatId: string) => Promise<Message[]>;
  cacheChats: (rooms: Room[], accountName: string) => Promise<void>;
  cacheMessages: (
    rawMessages: RawMessage[],
    chatId: string,
  ) => Promise<void>;
  cacheRoute: (selectedChatId: string | null, account: string) => Promise<void>;
  restoreRoute: () => Promise<{
    selectedChatId: string | null;
    currentAccount: string;
  } | null>;
  cacheAccounts: (accounts: Account[], defaultAccount: string) => Promise<void>;
  restoreAccounts: () => Promise<DexieAccount[]>;
  cacheUserSettings: (settings: {
    enableMessageTone: boolean;
    enableNotifications: boolean;
    fullName: string;
  }) => Promise<void>;
  restoreUserSettings: () => Promise<DexieUserSettings | undefined>;
  queueOfflineMessage: (
    chat: Chat,
    content: string,
    messageId: string,
    replyTo?: Message,
    fileUrl?: string,
  ) => Promise<void>;
  getCachedChats: (accountName: string) => Promise<Chat[]>;
  getCachedMessages: (chatId: string) => Promise<Message[]>;
  triggerSync: () => Promise<void>;
  syncNewChatMessages: (
    chatId: string,
    mobileNo: string,
    whatsappAccount: string,
  ) => Promise<number>;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export const useCache = () => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useCache must be used within CacheProvider");
  }
  return context;
};

interface CacheProviderProps {
  children: ReactNode;
}

export const CacheProvider: React.FC<CacheProviderProps> = ({ children }) => {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | undefined>();
  const isReady = useMemo(() => true, []);

  // Listen to network status
  useEffect(() => {
    const unsub = syncEngine.onNetworkStatus((online) => {
      setIsOnline(online);
      if (online) {
        syncEngine.startAutoSync();
      } else {
        syncEngine.stopAutoSync();
      }
    });
    return unsub;
  }, []);

  // Listen to sync status
  useEffect(() => {
    syncEngine.onStatusChange((status) => {
      setIsSyncing(status.syncing);
      setPendingCount(status.pendingCount);
      setLastSync(status.lastSync);
    });
  }, []);

  // Start auto sync when online
  useEffect(() => {
    if (isOnline) {
      syncEngine.startAutoSync();
    }
    return () => {
      syncEngine.stopAutoSync();
    };
  }, [isOnline]);

  // ─── Hydrate from cache (returns typed data for components) ───

  const dexieChatToChat = useCallback((dc: DexieChat): Chat => ({
    id: dc.id,
    name: dc.name,
    mobileNo: dc.mobileNo,
    avatar: dc.avatar,
    profilePicture: dc.profilePicture || undefined,
    lastMessage: dc.lastMessage,
    lastMessageType: dc.lastMessageType,
    lastMessageStatus: dc.lastMessageStatus,
    timestamp: dc.timestamp,
    unreadCount: dc.unreadCount,
    online: dc.online,
    typing: dc.typing,
    isGroup: dc.isGroup,
    whatsappAccount: dc.whatsappAccount,
    roomType: dc.roomType as "Direct" | "Group" | "Guest",
    contactName: dc.contactName,
  }), []);

  const dexieMessageToMessage = useCallback(
    (dm: DexieMessage): Message => ({
      id: dm.id,
      content: dm.content,
      timestamp: dm.timestamp,
      fullTimestamp: dm.fullTimestamp,
      isSent: dm.isSent,
      status: dm.status as Message["status"],
      type: dm.type as Message["type"],
      senderName: dm.senderName,
      caption: dm.caption,
      attach: dm.attach,
      reactions: dm.reactions as Message["reactions"],
      replyTo: dm.replyTo as Message["replyTo"],
      locationData: dm.locationData as Message["locationData"],
      contactData: dm.contactData as Message["contactData"],
      buttonData: dm.buttonData as Message["buttonData"],
      interactiveData: dm.interactiveData as Message["interactiveData"],
      isTemplate: dm.isTemplate,
    }),
    [],
  );

  const roomToDexieChat = useCallback(
    (room: Room, accountName: string): DexieChat => {
      let lastMessageContent = "";
      let lastMessageType = "";
      let lastMessageStatus = "";
      const lastMessageTimestamp = room.last_message?.creation || room.modified;

      if (room.last_message) {
        lastMessageContent = room.last_message.content || "";
        lastMessageType = room.last_message.content_type || "text";
        lastMessageStatus = room.last_message.status || "sent";
      }

      return {
        id: room.name,
        name: room.contact_name || room.mobile_no,
        mobileNo: room.mobile_no,
        avatar: (room.contact_name || room.mobile_no).charAt(0).toUpperCase(),
        profilePicture: null,
        lastMessage: lastMessageContent,
        lastMessageType,
        lastMessageStatus,
        timestamp: lastMessageTimestamp,
        unreadCount: room.unread_incoming,
        online: false,
        typing: false,
        isGroup: room.type === "Group",
        whatsappAccount: accountName,
        roomType: room.type,
        contactName: room.contact_name,
        syncedAt: new Date().toISOString(),
      };
    },
    [],
  );

  const rawMessageToDexieMessage = useCallback(
    (rm: RawMessage, chatId: string): DexieMessage => {
      let parsedReactions = undefined;
      if (rm.reactions) {
        try {
          parsedReactions =
            typeof rm.reactions === "string"
              ? JSON.parse(rm.reactions)
              : rm.reactions;
        } catch {
          parsedReactions = undefined;
        }
      }

      return {
        id: rm.name,
        chatId,
        content: rm.content || "",
        timestamp: new Date(rm.creation).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        fullTimestamp: new Date(rm.creation),
        isSent: rm.type === "Outgoing",
        status: rm.status as DexieMessage["status"],
        type: rm.content_type,
        senderName: rm.sender_name,
        caption: rm.caption,
        attach: rm.attach,
        reactions: parsedReactions,
        replyTo: undefined,
        locationData: rm.location_data,
        contactData: rm.contact_data,
        buttonData: rm.button_data,
        interactiveData: rm.interactive_data,
        isTemplate: false,
        isPending: 0,
        syncedAt: new Date().toISOString(),
      };
    },
    [],
  );

  // ─── Public API ─────────────────────────────────────────────

  const hydrateChats = useCallback(
    async (accountName: string): Promise<Chat[]> => {
      const cached = await chatRepo.getAll(accountName);
      return cached.map(dexieChatToChat);
    },
    [dexieChatToChat],
  );

  const hydrateMessages = useCallback(
    async (chatId: string): Promise<Message[]> => {
      const cached = await messageRepo.getByChatId(chatId);
      return cached.map(dexieMessageToMessage);
    },
    [dexieMessageToMessage],
  );

  const cacheChats = useCallback(
    async (rooms: Room[], accountName: string): Promise<void> => {
      const dexieChats = rooms.map((room) => roomToDexieChat(room, accountName));
      await chatRepo.bulkUpsert(dexieChats);
    },
    [roomToDexieChat],
  );

  const cacheMessages = useCallback(
    async (rawMessages: RawMessage[], chatId: string): Promise<void> => {
      const dexieMessages = rawMessages.map((rm) =>
        rawMessageToDexieMessage(rm, chatId),
      );
      await messageRepo.bulkUpsert(dexieMessages);
    },
    [rawMessageToDexieMessage],
  );

  const cacheRoute = useCallback(
    async (selectedChatId: string | null, account: string): Promise<void> => {
      const params = new URLSearchParams(location.search);
      await routeRepo.save({
        path: location.pathname + (params.toString() ? `?${params.toString()}` : ""),
        selectedChatId,
        currentAccount: account,
      });
    },
    [location],
  );

  const restoreRoute = useCallback(async () => {
    const route = await routeRepo.get();
    if (!route) return null;
    return {
      selectedChatId: route.selectedChatId,
      currentAccount: route.currentAccount,
    };
  }, []);

  const cacheAccounts = useCallback(
    async (accounts: Account[], defaultAccount: string): Promise<void> => {
      const dexieAccounts: DexieAccount[] = accounts.map((acc) => ({
        name: acc.name,
        accountName: acc.account_name,
        phoneId: acc.phone_id,
        unreadCount: acc.unread_count,
        isDefault: acc.name === defaultAccount,
        syncedAt: new Date().toISOString(),
      }));
      await accountRepo.bulkUpsert(dexieAccounts);
    },
    [],
  );

  const restoreAccounts = useCallback(async (): Promise<DexieAccount[]> => {
    return accountRepo.getAll();
  }, []);

  const cacheUserSettings = useCallback(
    async (settings: {
      enableMessageTone: boolean;
      enableNotifications: boolean;
      fullName: string;
    }): Promise<void> => {
      await userSettingsRepo.save({
        enableMessageTone: settings.enableMessageTone,
        enableNotifications: settings.enableNotifications,
        fullName: settings.fullName,
      });
    },
    [],
  );

  const restoreUserSettings = useCallback(async () => {
    return userSettingsRepo.get();
  }, []);

  const queueOfflineMessage = useCallback(
    async (
      chat: Chat,
      content: string,
      messageId: string,
      replyTo?: Message,
      fileUrl?: string,
    ): Promise<void> => {
      if (!isOnline) {
        // Save optimistic message locally
        const dexieMsg: DexieMessage = {
          id: messageId,
          chatId: chat.id,
          content,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          fullTimestamp: new Date(),
          isSent: true,
          status: "sending",
          type: "text",
          isPending: 1,
          syncedAt: new Date().toISOString(),
          attach: fileUrl,
          replyTo: replyTo
            ? {
                content: replyTo.content,
                sender: replyTo.isSent ? "You" : replyTo.senderName || chat.name,
                messageId: replyTo.id,
                contentType: replyTo.type,
              }
            : undefined,
        };

        await messageRepo.addOptimistic(dexieMsg);

        // Queue for sync
        await syncEngine.queueMessage({
          chatId: chat.id,
          content,
          localMessageId: messageId,
          replyToMessageId: replyTo?.id || null,
          replyToContent: replyTo?.content,
          replyToSender: replyTo?.isSent ? "You" : replyTo?.senderName,
          contentType: "text",
          attachment: fileUrl,
          caption: content,
          whatsappAccount: chat.whatsappAccount,
          user: chat.name,
          room: chat.id,
          userNo: chat.mobileNo,
        });

        // Update chat last message instantly
        await chatRepo.updateLastMessage(
          chat.id,
          content,
          new Date().toISOString(),
          "sending",
        );
      }
    },
    [isOnline],
  );

  const getCachedChats = useCallback(
    async (accountName: string): Promise<Chat[]> => {
      return hydrateChats(accountName);
    },
    [hydrateChats],
  );

  const getCachedMessages = useCallback(
    async (chatId: string): Promise<Message[]> => {
      return hydrateMessages(chatId);
    },
    [hydrateMessages],
  );

  const triggerSync = useCallback(async () => {
    await syncEngine.triggerSync();
  }, []);

  const syncNewChatMessages = useCallback(
    async (
      chatId: string,
      mobileNo: string,
      whatsappAccount: string,
    ): Promise<number> => {
      const lastTimestamp = await messageRepo.getLastTimestamp(chatId);
      return syncEngine.syncNewMessages({
        chatId,
        mobileNo,
        whatsappAccount,
        lastTimestamp,
      });
    },
    [],
  );

  const value = useMemo<CacheContextType>(
    () => ({
      isReady,
      isOnline,
      isSyncing,
      pendingCount,
      lastSync,
      hydrateChats,
      hydrateMessages,
      cacheChats,
      cacheMessages,
      cacheRoute,
      restoreRoute,
      cacheAccounts,
      restoreAccounts,
      cacheUserSettings,
      restoreUserSettings,
      queueOfflineMessage,
      getCachedChats,
      getCachedMessages,
      triggerSync,
      syncNewChatMessages,
    }),
    [
      isReady,
      isOnline,
      isSyncing,
      pendingCount,
      lastSync,
      hydrateChats,
      hydrateMessages,
      cacheChats,
      cacheMessages,
      cacheRoute,
      restoreRoute,
      cacheAccounts,
      restoreAccounts,
      cacheUserSettings,
      restoreUserSettings,
      queueOfflineMessage,
      getCachedChats,
      getCachedMessages,
      triggerSync,
      syncNewChatMessages,
    ],
  );

  return (
    <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
  );
};

export default CacheContext;