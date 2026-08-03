import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatList } from "../components/chat/ChatList";
import { ChatSpace } from "../components/chat/ChatSpace";
import { SyncStatusBar } from "../components/common/SyncStatusBar";
import { useCache } from "../contexts/CacheContext";
import { useUser } from "../contexts/UserProvider";
import { useChatPreferences } from "../hooks/useChatPreferences";
import syncEngine from "../services/syncEngine";
import type { Account, Chat, Message, UserSettings } from "../types";

export const WhatsAppHome: React.FC = () => {
  const { logout } = useUser();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  // A draft chat is a selected contact that has no message history yet —
  // no room/chat exists until the first message is sent.
  const [draftChat, setDraftChat] = useState<Chat | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentAccount, setCurrentAccount] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    enableMessageTone: true,
    enableNotifications: true,
  });
  const [currentUserName, setCurrentUserName] = useState<string>("User");
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const {
    isReady,
    hydrateChats,
    cacheChats,
    cacheRoute,
    restoreRoute,
    restoreAccounts,
    cacheAccounts,
    cacheUserSettings,
    restoreUserSettings,
  } = useCache();

  const { data: accountsData } = useFrappeGetCall<{
    message: { accounts: Account[]; default_account: string };
  }>(
    "waba_suite.api.accounts.get_user_accounts_with_default",
    {},
    isReady ? undefined : { enabled: false },
  );

  // Cache accounts when data arrives
  useEffect(() => {
    if (accountsData?.message) {
      const { accounts: accs, default_account } = accountsData.message;
      if (accs && Array.isArray(accs) && accs.length > 0) {
        cacheAccounts(accs, default_account);
      }
    }
  }, [accountsData, cacheAccounts]);

  const { data: userSettingsData } = useFrappeGetCall<{
    message: {
      enable_message_tone: number;
      enable_notifications: number;
      full_name: string;
    };
  }>(
    "waba_suite.api.config.get_user_settings",
    {},
    isReady ? undefined : { enabled: false },
  );

  // Cache user settings when data arrives
  useEffect(() => {
    if (userSettingsData?.message) {
      cacheUserSettings({
        enableMessageTone:
          userSettingsData.message.enable_message_tone === 1,
        enableNotifications:
          userSettingsData.message.enable_notifications === 1,
        fullName: userSettingsData.message.full_name || "User",
      });
    }
  }, [userSettingsData, cacheUserSettings]);

  const shouldFetchRooms = useMemo(() => {
    return !!currentAccount;
  }, [currentAccount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roomsData, mutate: mutateRooms } = useFrappeGetCall<{
    message: any[];
  }>(
    "waba_suite.api.contacts.get",
    {
      email: "",
      whatsapp_account: currentAccount,
    },
    shouldFetchRooms
      ? undefined
      : { enabled: false, revalidateOnFocus: false },
  );

  const { call: sendMessageCall } = useFrappePostCall(
    "waba_suite.api.message.send",
  );
  const { call: markMultipleAsReadCall } = useFrappePostCall(
    "waba_suite.api.message.mark_multiple_as_read",
  );
  const { call: togglePinCall } = useFrappePostCall(
    "waba_suite.api.chat_preferences.toggle_pin",
  );
  const { call: toggleStarCall } = useFrappePostCall(
    "waba_suite.api.chat_preferences.toggle_star",
  );
  const { call: toggleArchiveCall } = useFrappePostCall(
    "waba_suite.api.chat_preferences.toggle_archive",
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && selectedChatId) {
        setShowSidebar(false);
      } else {
        setShowSidebar(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [selectedChatId]);

  // Hydrate settings from cache first
  useEffect(() => {
    const hydrate = async () => {
      const cached = await restoreUserSettings();
      if (cached) {
        setUserSettings({
          enableMessageTone: cached.enableMessageTone,
          enableNotifications: cached.enableNotifications,
        });
        if (cached.fullName) {
          setCurrentUserName(cached.fullName);
        }
      }
    };
    if (!isReady) hydrate();
  }, [isReady, restoreUserSettings]);

  useEffect(() => {
    if (userSettingsData?.message) {
      setUserSettings({
        enableMessageTone:
          userSettingsData.message.enable_message_tone === 1,
        enableNotifications:
          userSettingsData.message.enable_notifications === 1,
      });
      if (userSettingsData.message.full_name) {
        setCurrentUserName(userSettingsData.message.full_name);
      }
    }
  }, [userSettingsData]);

  // Hydrate accounts from cache on mount, restore route
  useEffect(() => {
    const init = async () => {
      if (!isReady) return;

      // 1. Restore previous route FIRST — it has the most recent user state
      const route = await restoreRoute();
      if (route && route.currentAccount) {
        setCurrentAccount(route.currentAccount);
        const cachedChats = await hydrateChats(route.currentAccount);
        if (cachedChats.length > 0) {
          setChats(cachedChats);
        }
        if (route.selectedChatId) {
          setSelectedChatId(route.selectedChatId);
        }
        return; // Route takes priority over cached accounts
      }

      // 2. No stored route — fall back to cached accounts
      const cachedAccounts = await restoreAccounts();
      if (cachedAccounts && cachedAccounts.length > 0) {
        setAccounts(
          cachedAccounts.map(
            (a: {
              name: string;
              accountName: string;
              phoneId: string;
              unreadCount: number;
              isDefault: boolean;
            }) => ({
              name: a.name,
              account_name: a.accountName,
              phone_id: a.phoneId,
              unread_count: a.unreadCount,
              is_default: a.isDefault,
            }),
          ),
        );

        const defaultAcc = cachedAccounts.find(
          (a: { isDefault: boolean }) => a.isDefault,
        );
        if (defaultAcc) {
          setCurrentAccount(defaultAcc.name);
        }

        // Hydrate chats from cache
        const defaultName =
          defaultAcc?.name || cachedAccounts[0].name;
        const cachedChats = await hydrateChats(defaultName);
        if (cachedChats.length > 0) {
          setChats(cachedChats);
        }
      }
    };
    init();
  }, [isReady, hydrateChats, restoreRoute, restoreAccounts]);

  useEffect(() => {
    if (accountsData?.message) {
      const { accounts: accs, default_account } = accountsData.message;
      if (accs && Array.isArray(accs)) {
        setAccounts(accs);
        const defaultAccName = (() => {
          if (typeof default_account === "string" && default_account) return default_account;
          if (default_account && typeof default_account === "object" && "name" in default_account) return (default_account as {name: string}).name;
          return accs.length > 0 ? accs[0].name : "";
        })();
        if (defaultAccName) {
          setCurrentAccount(defaultAccName);
        }
      }
    }
  }, [accountsData]);

  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (currentAccount) {
      mutateRooms();
      pollingIntervalRef.current = setInterval(() => {
        mutateRooms();
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentAccount, mutateRooms]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedChats = useMemo(() => {
    if (!roomsData?.message) {
      return [];
    }

    let roomsArray = roomsData.message;
    if (!Array.isArray(roomsArray)) {
      roomsArray = [];
    }

    return roomsArray.map((room: any) => {
      let lastMessageContent = "";
      let lastMessageType = "";
      let lastMessageStatus = "";
      let lastMessageTimestamp = room.modified;

      if (room.last_message) {
        lastMessageContent =
          room.last_message.message || room.last_message.content || "";
        lastMessageType =
          room.last_message.type || room.last_message.content_type || "text";
        lastMessageStatus = room.last_message.status || "sent";
        lastMessageTimestamp = room.last_message.creation || room.modified;
      }

      return {
        id: room.name,
        name: room.contact_name || room.mobile_no,
        mobileNo: room.mobile_no,
        avatar:
          (room.contact_name || room.mobile_no)?.charAt(0)?.toUpperCase() ||
          "?",
        profilePicture: room.profile_picture || null,
        lastMessage: lastMessageContent,
        lastMessageType: lastMessageType,
        lastMessageStatus: lastMessageStatus,
        timestamp: lastMessageTimestamp,
        unreadCount: room.unread_incoming || 0,
        online: false,
        typing: false,
        isGroup: room.type === "Group",
        whatsappAccount: room.whatsapp_account,
        roomType: room.type,
        contactName: room.contact_name,
        isPinned: room.is_pinned === true || room.is_pinned === 1,
        isStarred: room.is_starred === true || room.is_starred === 1,
        isArchived: room.is_archived === true || room.is_archived === 1,
      };
    });
  }, [roomsData]);

  // Merge server chats with preferences from API. The backend now returns
  // is_pinned/is_starred/is_archived with each contact, so we use those as source of truth.
  useEffect(() => {
    if (formattedChats.length > 0) {
      setChats((prev) => {
        const prevMap = new Map(prev.map((c) => [c.id, c]));
        return formattedChats.map((fc) => {
          const existing = prevMap.get(fc.id);
          // Prefer server prefs, but preserve any local toggle that happened since last poll
          if (existing) {
            return {
              ...fc,
              // Use the server values as base, but if the user just toggled locally
              // within the last polling cycle, preserve that
              isPinned: fc.isPinned,
              isStarred: fc.isStarred,
              isArchived: fc.isArchived,
            };
          }
          return fc;
        });
      });
    }
  }, [formattedChats]);

  // Cache chats when rooms data comes from server
  useEffect(() => {
    if (
      roomsData?.message &&
      Array.isArray(roomsData.message) &&
      currentAccount
    ) {
      cacheChats(roomsData.message, currentAccount);
    }
  }, [roomsData, currentAccount, cacheChats]);

  const handleMarkAsRead = useCallback(
    async (chat: Chat) => {
      if (chat && chat.unreadCount > 0) {
        try {
          await markMultipleAsReadCall({
            whatsapp_contact: chat.mobileNo,
            whatsapp_account: chat.whatsappAccount,
          });
          setChats((prev) =>
            prev.map((c) =>
              c.id === chat.id ? { ...c, unreadCount: 0 } : c,
            ),
          );
        } catch (error) {
          console.error("Failed to mark as read:", error);
        }
      }
    },
    [markMultipleAsReadCall],
  );

  const handleSendMessage = useCallback(
    async (content: string, replyTo?: Message, chat?: Chat) => {
      if (!chat) return;

      const messageId = Date.now().toString();

      if (userSettings.enableMessageTone) {
        const audio = new Audio("/sounds/message-sent.mp3");
        audio.play().catch(() => {});
      }

      try {
        await sendMessageCall({
          content,
          user: chat.name,
          room: chat.id,
          user_no: chat.mobileNo,
          message_id: messageId,
          whatsapp_account: chat.whatsappAccount,
          reply_to_message_id: replyTo?.id || null,
          content_type: "text",
        });

        setChats((prev) =>
          prev.map((c) =>
            c.id === chat.id
              ? {
                  ...c,
                  lastMessage: content,
                  timestamp: new Date().toISOString(),
                  lastMessageStatus: "sent",
                }
              : c,
          ),
        );
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [sendMessageCall, userSettings.enableMessageTone],
  );

  const handleSwitchAccount = useCallback(
    async (accountName: string) => {
      setCurrentAccount(accountName);
      setSelectedChatId(null);
      setChats([]);
      // Cache route with new account
      cacheRoute(null, accountName);
    },
    [cacheRoute],
  );

  const selectedChat = useMemo(() => {
    if (!selectedChatId) return draftChat || null;
    const existing = chats.find((c) => c.id === selectedChatId);
    return existing || draftChat || null;
  }, [chats, selectedChatId, draftChat]);

  const { togglePin, toggleStar, toggleArchive } = useChatPreferences({
    togglePinCall,
    toggleStarCall,
    toggleArchiveCall,
    currentAccount,
  });

  const handleTogglePin = useCallback(
    async (chatId: string) => {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;
      const isPinned = await togglePin(chat);
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, isPinned } : c)),
      );
    },
    [chats, togglePin],
  );

  const handleToggleStar = useCallback(
    async (chatId: string) => {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;
      const isStarred = await toggleStar(chat);
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, isStarred } : c)),
      );
    },
    [chats, toggleStar],
  );

  const handleToggleArchive = useCallback(
    async (chatId: string) => {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;
      const isArchived = await toggleArchive(chat);
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, isArchived } : c)),
      );
    },
    [chats, toggleArchive],
  );

  const handleSelectChat = useCallback(
    (id: string) => {
      setSelectedChatId(id);
      setDraftChat(null);
      if (isMobile) setShowSidebar(false);
      // Cache the current route
      cacheRoute(id, currentAccount);
    },
    [isMobile, currentAccount, cacheRoute],
  );

  // Handle a contact selected/created from the "New Message" dialog.
  // We open a chat view for the contact. If the contact has an existing
  // chat we select it; if it's brand new (no messages yet) we keep it as a
  // draft so no room/chat is persisted until the first message is sent.
  const handleOpenNewContact = useCallback(
    (contact?: {
      id?: string;
      name?: string;
      mobileNo?: string;
      whatsappAccount?: string;
      hasChat?: boolean;
      canSendDirect?: boolean;
      within24hWindow?: boolean;
    }) => {
      if (!contact?.id || !contact.mobileNo) return;

      if (contact.hasChat) {
        // Existing chat — just select it (it will appear in the polled list).
        setSelectedChatId(contact.id);
        setDraftChat(null);
      } else {
        // New contact — open as a draft chat (no room saved until message).
        // A brand new contact has never messaged us → outside the 24h window,
        // so only template messages are allowed.
        const draft: Chat = {
          id: contact.id,
          name: contact.name || contact.mobileNo,
          mobileNo: contact.mobileNo,
          contactName: contact.name,
          avatar: (contact.name || contact.mobileNo).charAt(0).toUpperCase(),
          lastMessage: "",
          timestamp: new Date().toISOString(),
          unreadCount: 0,
          online: false,
          typing: false,
          isGroup: false,
          whatsappAccount: contact.whatsappAccount || currentAccount,
          roomType: "Direct",
          // Carry the 24h session window into the ChatSpace UI so templates-only
          // enforcement applies immediately for new/expired/ended sessions.
          within24hWindow: contact.within24hWindow ?? false,
        };
        setDraftChat(draft);
        setSelectedChatId(contact.id);
      }

      if (isMobile) setShowSidebar(false);
      cacheRoute(contact.id, contact.whatsappAccount || currentAccount);
    },
    [isMobile, currentAccount, cacheRoute],
  );

  const handleBack = useCallback(() => {
    setShowSidebar(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // Setup sync engine with actual API callbacks when available
  useEffect(() => {
    syncEngine.setApiCallbacks({
      sendMessage: sendMessageCall,
      markAsRead: markMultipleAsReadCall,
    });
  }, [sendMessageCall, markMultipleAsReadCall]);

  return (
    <div
      className="flex w-full h-dvh bg-[#111b21] overflow-hidden"
      style={{ height: '100dvh' }}
    >
      {/* Chat List Sidebar - takes full screen on mobile when shown */}
      <div
        className={`${
          showSidebar ? "flex" : "hidden"
        } ${
          isMobile
            ? "absolute inset-0 z-20 w-full"
            : "relative w-full max-w-[400px] min-w-[320px] flex-shrink-0 border-r border-[#2a3942]"
        } flex-col overflow-hidden`}
      >
        <SyncStatusBar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onSelectChat={handleSelectChat}
            onClose={handleBack}
            isMobile={isMobile}
            currentAccount={currentAccount}
            accounts={accounts}
            onSwitchAccount={handleSwitchAccount}
            userSettings={userSettings}
            currentUserName={currentUserName}
            onLogout={handleLogout}
            onTogglePin={handleTogglePin}
            onToggleStar={handleToggleStar}
            onToggleArchive={handleToggleArchive}
            onNewContact={handleOpenNewContact}
          />
        </div>
      </div>

      {/* Chat Space - takes full screen on mobile when sidebar is hidden */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          isMobile && showSidebar ? "hidden" : "flex"
        }`}
      >
        <ChatSpace
          chat={selectedChat}
          currentAccount={currentAccount}
          onSendMessage={handleSendMessage}
          onMarkAsRead={handleMarkAsRead}
          onBack={handleBack}
          isMobile={isMobile}
          onTogglePin={handleTogglePin}
          onToggleStar={handleToggleStar}
          onToggleArchive={handleToggleArchive}
          within24hWindow={selectedChat?.within24hWindow}
        />
      </div>
    </div>
  );
};

export default WhatsAppHome;