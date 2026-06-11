import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { MessageCircle } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatList } from "../components/chat/ChatList";
import { ChatSpace } from "../components/chat/ChatSpace";
import { useUser } from "../contexts/UserProvider";
import type { Account, Chat, Message, UserSettings } from "../types";

export const WhatsAppHome: React.FC = () => {
  const { logout } = useUser();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: accountsData } = useFrappeGetCall<{
    message: { accounts: Account[]; default_account: string };
  }>("waba_suite.api.accounts.get_user_accounts_with_default", {}, undefined);

  const { data: userSettingsData } = useFrappeGetCall<{
    message: {
      enable_message_tone: number;
      enable_notifications: number;
      full_name: string;
    };
  }>("waba_suite.api.config.get_user_settings", {}, undefined);

  const shouldFetchRooms = useMemo(() => {
    return !!currentAccount;
  }, [currentAccount]);

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

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setShowSidebar(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  useEffect(() => {
    if (accountsData?.message) {
      const { accounts: accs, default_account } = accountsData.message;
      if (accs && Array.isArray(accs)) {
        setAccounts(accs);
        let defaultAccName = default_account;
        if (!defaultAccName && accs.length > 0) {
          defaultAccName = accs[0].name;
        }
        if (defaultAccName && typeof defaultAccName === "string") {
          setCurrentAccount(defaultAccName);
        } else if (defaultAccName && typeof defaultAccName === "object") {
          setCurrentAccount(defaultAccName.name);
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
      };
    });
  }, [roomsData]);

  useEffect(() => {
    if (formattedChats.length > 0) {
      setChats(formattedChats);
    }
  }, [formattedChats]);

  const handleMarkAsRead = useCallback(
    async (chat: Chat) => {
      if (chat && chat.unreadCount > 0) {
        try {
          await markMultipleAsReadCall({
            whatsapp_contact: chat.mobileNo,
            whatsapp_account: chat.whatsappAccount,
          });
          setChats((prev) =>
            prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)),
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

  const handleSwitchAccount = useCallback(async (accountName: string) => {
    setCurrentAccount(accountName);
    setSelectedChatId(null);
    setChats([]);
  }, []);

  const selectedChat = useMemo(() => {
    return selectedChatId
      ? chats.find((c) => c.id === selectedChatId) || null
      : null;
  }, [chats, selectedChatId]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setSelectedChatId(id);
      if (isMobile) setShowSidebar(false);
    },
    [isMobile],
  );

  const handleBack = useCallback(() => {
    setShowSidebar(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <div className="flex h-screen bg-[#111b21]">
      <div
        className={`${
          showSidebar ? "flex" : "hidden"
        } ${isMobile ? "absolute inset-0 z-20" : "relative w-[400px]"} flex-col`}
      >
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
        />
      </div>

      <div className="flex-1 flex flex-col">
        <ChatSpace
          chat={selectedChat}
          currentAccount={currentAccount}
          onSendMessage={handleSendMessage}
          onMarkAsRead={handleMarkAsRead}
          onBack={handleBack}
          isMobile={isMobile}
        />
      </div>

      {isMobile && !showSidebar && (
        <button
          onClick={handleBack}
          className="fixed bottom-4 left-4 p-3 bg-[#25D366] text-white rounded-full shadow-lg hover:bg-[#20b859] transition"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default WhatsAppHome;
