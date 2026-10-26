import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { MessageCircleCheck } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatList } from "../components/chat/ChatList";
import { ChatSpace } from "../components/chat/ChatSpace";
import { LabelPickerModal } from "../components/modals/LabelPickerModal";
import { useUser } from "../contexts/UserProvider";
import { useChatPreferences } from "../hooks/useChatPreferences";
import { useUrlState } from "../hooks/useUrlState";
import type { Account, Chat, ChatLabel, Message, UserSettings } from "../types";
import { getMessagePreview } from "../utils/messagePreview";

export const WhatsAppHome: React.FC = () => {
  const { logout } = useUser();
  // Navigation state lives in the URL so it survives reloads, back/forward and
  // is shareable — no IndexedDB cache involved.
  const {
    account: urlAccount,
    chatId: selectedChatId,
    filter: activeFilter,
    labels: selectedLabelFilters,
    setAccount: setUrlAccount,
    setChatId: setSelectedChatId,
    setFilter: setActiveFilter,
    setLabels: setSelectedLabelFilters,
  } = useUrlState();
  // A draft chat is a selected contact that has no message history yet —
  // no room/chat exists until the first message is sent.
  const [draftChat, setDraftChat] = useState<Chat | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    enableMessageTone: true,
    enableNotifications: true,
  });
  const [currentUserName, setCurrentUserName] = useState<string>("User");
  const [allLabels, setAllLabels] = useState<ChatLabel[]>([]);
  // Chat currently having labels edited (the LabelPickerModal target chat id)
  const [labelPickerChatId, setLabelPickerChatId] = useState<string | null>(
    null,
  );
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const { data: accountsData } = useFrappeGetCall<{
    message: {
      accounts: Account[];
      default_account: Account | null;
      has_accounts: boolean;
    };
  }>("waba_suite.api.accounts.get_user_accounts_with_default", {});

  const serverDefaultAccount =
    accountsData?.message?.default_account?.name || "";

  // Resolve the active account: prefer the URL (when it points to an account
  // the user can access), then the server default, then the first account.
  const currentAccount = useMemo(() => {
    if (urlAccount && accounts.some((a) => a.name === urlAccount)) {
      return urlAccount;
    }
    if (serverDefaultAccount) return serverDefaultAccount;
    if (accounts.length > 0) return accounts[0].name;
    return urlAccount;
  }, [urlAccount, accounts, serverDefaultAccount]);

  const { data: userSettingsData } = useFrappeGetCall<{
    message: {
      enable_message_tone: number;
      enable_notifications: number;
      full_name: string;
    };
  }>("waba_suite.api.config.get_user_settings", {});

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
    shouldFetchRooms ? undefined : { enabled: false, revalidateOnFocus: false },
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
  const { data: allLabelsData } = useFrappeGetCall<{
    message: ChatLabel[];
  }>("waba_suite.api.labels.get_all", {});
  const { call: setAssignmentsCall, loading: isSavingLabels } =
    useFrappePostCall("waba_suite.api.labels.set_assignments");

  // Normalise the URL once accounts are known: if the URL has no (or an
  // invalid) account, write the resolved default into it so reloads and
  // shared links stay consistent with what is on screen.
  useEffect(() => {
    if (accounts.length === 0 || !currentAccount) return;
    if (urlAccount !== currentAccount) {
      setUrlAccount(currentAccount);
    }
  }, [accounts, currentAccount, urlAccount, setUrlAccount]);

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

  useEffect(() => {
    if (userSettingsData?.message) {
      setUserSettings({
        enableMessageTone: userSettingsData.message.enable_message_tone === 1,
        enableNotifications:
          userSettingsData.message.enable_notifications === 1,
      });
      if (userSettingsData.message.full_name) {
        setCurrentUserName(userSettingsData.message.full_name);
      }
    }
  }, [userSettingsData]);

  // Accounts come straight from the server (no cache).
  useEffect(() => {
    if (accountsData?.message) {
      const accs = accountsData.message.accounts;
      if (accs && Array.isArray(accs)) {
        setAccounts(accs);
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

  useEffect(() => {
    if (allLabelsData?.message) {
      setAllLabels(allLabelsData.message);
    }
  }, [allLabelsData]);

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
        const lastRawContent =
          room.last_message.message || room.last_message.content || "";
        const lastContentType = room.last_message.content_type || "text";
        const isPlainOrTemplate =
          lastContentType === "text" || lastContentType === "template";
        // Structured/media messages are stored as payload strings; render a
        // short label ("📍 Location", "📷 Photo • caption") instead.
        lastMessageContent = isPlainOrTemplate
          ? lastRawContent
          : getMessagePreview({
              type: lastContentType,
              content: lastRawContent,
              attach: room.last_message.attach,
              maxLength: 64,
            });
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
        // Labels assigned to this contact for filtering
        labels: Array.isArray(room.labels) ? room.labels : [],
        labelIds: Array.isArray(room.labels)
          ? room.labels.map((l: { name: string }) => l.name)
          : [],
        // Single WhatsApp Session status + expiry for the contact+account.
        sessionStatus: room.session_status || undefined,
        sessionExpiresAt: room.session_expires_at || undefined,
        sessionExpired:
          room.is_session_expired === true || room.is_session_expired === 1,
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

  // Chats belong to a specific account; only surface those for the active
  // account so stale rows from a previous account never leak into the new one
  // (no clearing effect required).
  const visibleChats = useMemo(
    () => chats.filter((c) => c.whatsappAccount === currentAccount),
    [chats, currentAccount],
  );

  const handleMarkAsRead = useCallback(
    async (chat: Chat) => {
      if (!chat) return;
      // Fire on every chat open and whenever a new inbound message arrives so
      // all unread messages are acknowledged, regardless of the badge count.
      try {
        await markMultipleAsReadCall({
          whatsapp_contact: chat.id,
          whatsapp_account: chat.whatsappAccount || currentAccount,
        });
        // Optimistically clear the badge, then reconcile with the server so
        // the total always matches the backend source of truth.
        setChats((prev) =>
          prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)),
        );
        mutateRooms();
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    },
    [markMultipleAsReadCall, currentAccount, mutateRooms],
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
      // Switching account is a pure URL change: the rooms query re-runs for the
      // new account and `visibleChats` only surfaces the new account's rows.
      setDraftChat(null);
      setShowSidebar(true);
      setUrlAccount(accountName);
    },
    [setUrlAccount],
  );

  const selectedChat = useMemo(() => {
    if (!selectedChatId) return null;
    const existing = visibleChats.find((c) => c.id === selectedChatId);
    return existing || draftChat || null;
  }, [visibleChats, selectedChatId, draftChat]);

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

  // Open the label picker for a specific chat (sets the target chat id).
  const handleOpenLabels = useCallback((chatId: string) => {
    setLabelPickerChatId(chatId);
  }, []);

  // Save the updated label assignments for the target chat.
  const handleSaveLabels = useCallback(
    async (labelIds: string[]) => {
      if (!labelPickerChatId) return;
      try {
        const res = (await setAssignmentsCall({
          whatsapp_contact: labelPickerChatId,
          whatsapp_account: currentAccount,
          label_ids: labelIds,
        })) as { message?: { labels?: ChatLabel[] } };
        const updatedLabels = res?.message?.labels || [];
        setChats((prev) =>
          prev.map((c) =>
            c.id === labelPickerChatId
              ? {
                  ...c,
                  labels: updatedLabels,
                  labelIds: updatedLabels.map((l) => l.name),
                }
              : c,
          ),
        );
        setLabelPickerChatId(null);
      } catch (error) {
        console.error("Failed to save labels:", error);
      }
    },
    [labelPickerChatId, setAssignmentsCall, currentAccount],
  );

  const labelPickerChat = useMemo(() => {
    if (!labelPickerChatId) return null;
    return visibleChats.find((c) => c.id === labelPickerChatId) || null;
  }, [visibleChats, labelPickerChatId]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setSelectedChatId(id);
      setDraftChat(null);
      if (isMobile) setShowSidebar(false);
    },
    [isMobile, setSelectedChatId],
  );

  // Toggle a label filter on/off (persisted in the URL, no cache).
  const handleToggleLabelFilter = useCallback(
    (labelId: string) => {
      setSelectedLabelFilters(
        selectedLabelFilters.includes(labelId)
          ? selectedLabelFilters.filter((id) => id !== labelId)
          : [...selectedLabelFilters, labelId],
      );
    },
    [selectedLabelFilters, setSelectedLabelFilters],
  );

  const handleClearLabelFilters = useCallback(() => {
    setSelectedLabelFilters([]);
  }, [setSelectedLabelFilters]);

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
      sessionStatus?: string;
      sessionExpiresAt?: string;
      sessionExpired?: boolean;
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
          // Carry the session expiry into the ChatSpace UI so templates-only
          // enforcement applies immediately for new/expired/ended sessions.
          sessionStatus: contact.sessionStatus,
          sessionExpiresAt: contact.sessionExpiresAt,
          sessionExpired: contact.sessionExpired ?? true,
        };
        setDraftChat(draft);
        setSelectedChatId(contact.id);
      }

      if (isMobile) setShowSidebar(false);
    },
    [isMobile, currentAccount, setSelectedChatId],
  );

  // "Back" from the chat view clears the selection (URL) and returns to the list.
  const handleBack = useCallback(() => {
    setSelectedChatId(null);
    setDraftChat(null);
    setShowSidebar(true);
  }, [setSelectedChatId]);

  // Closing the chat list on mobile (after selecting a chat) must keep the
  // selected chat — it only reveals the chat view.
  const handleChatListClose = useCallback(() => {
    setShowSidebar(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // Strict permissions: a non-admin user with no accounts is not listed on
  // any WhatsApp Account's Users table — deny access to the WhatsApp page.
  const deniedAccess = useMemo(() => {
    if (accountsData && accountsData.message) {
      // `has_accounts` reflects only the accounts linked to this user via the
      // Users (WhatsApp Account User) child table. Administrator is always allowed
      // and receives accounts from the backend.
      return accountsData.message.has_accounts === false;
    }
    return false;
  }, [accountsData]);

  return (
    <div
      className="flex w-full h-dvh bg-[#111b21] overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* Strict permissions: deny access when user has no WhatsApp Account access */}
      {deniedAccess && (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#111b21] text-center px-6">
          <div className="w-20 h-20 rounded-full bg-[#202c33] flex items-center justify-center mb-4">
            <MessageCircleCheck className="w-10 h-10 text-[#8696a0]" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Access Denied
          </h2>
          <p className="text-[#8696a0] text-sm max-w-sm">
            You do not have access to WhatsApp. Please contact your
            administrator to be added to a WhatsApp Account's Users list.
          </p>
        </div>
      )}

      {/* Chat List Sidebar - fully hidden when access is denied */}
      {!deniedAccess && (
        <div
          className={`${showSidebar ? "flex" : "hidden"} ${
            isMobile
              ? "absolute inset-0 z-20 w-full"
              : "relative w-full max-w-[400px] min-w-[320px] flex-shrink-0 border-r border-[#2a3942]"
          } flex-col overflow-hidden`}
        >
          <div className="flex-1 flex flex-col overflow-hidden">
            <ChatList
              key={currentAccount}
              chats={visibleChats}
              selectedChatId={selectedChatId}
              onSelectChat={handleSelectChat}
              onClose={handleChatListClose}
              isMobile={isMobile}
              currentAccount={currentAccount}
              accounts={accounts}
              onSwitchAccount={handleSwitchAccount}
              currentUserName={currentUserName}
              onLogout={handleLogout}
              onTogglePin={handleTogglePin}
              onToggleStar={handleToggleStar}
              onToggleArchive={handleToggleArchive}
              onOpenLabels={handleOpenLabels}
              labels={allLabels}
              onNewContact={handleOpenNewContact}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              selectedLabelFilters={selectedLabelFilters}
              onToggleLabelFilter={handleToggleLabelFilter}
              onClearLabelFilters={handleClearLabelFilters}
            />
          </div>
        </div>
      )}

      {/* Chat Space - fully hidden when access is denied */}
      {!deniedAccess && (
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
            onOpenLabels={handleOpenLabels}
            sessionExpired={selectedChat?.sessionExpired}
          />
        </div>
      )}
      {/* Label Picker Modal — keyed by chat id so the selection resets per chat */}
      <LabelPickerModal
        key={labelPickerChatId || "none"}
        isOpen={!!labelPickerChat}
        onClose={() => setLabelPickerChatId(null)}
        title={`Labels — ${labelPickerChat?.name || ""}`}
        labels={allLabels}
        selectedLabelIds={labelPickerChat?.labelIds || []}
        onSave={handleSaveLabels}
        isSaving={isSavingLabels}
      />
    </div>
  );
};

export default WhatsAppHome;
