import {
  Archive,
  Home,
  LogOut,
  Mail,
  MailOpen,
  Plus,
  Smartphone,
  Star,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account, Chat, ChatLabel } from "../../types";
import { Avatar } from "../common/Avatar";
import { SearchBar } from "../common/SearchBar";
import { AccountSwitcher } from "../modals/AccountSwitcher";
import { AddRoomModal } from "../modals/AddRoomModal";
import { uiStateRepo } from "../../services/repository";
import { ChatRoom } from "./ChatRoom";

type ChatFilter = "all" | "unread" | "starred" | "archived";

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
  currentAccount: string;
  accounts: Account[];
  onSwitchAccount: (accountName: string) => Promise<void>;
  currentUserName?: string;
  onLogout: () => Promise<void>;
  onTogglePin?: (chatId: string) => void;
  onToggleStar?: (chatId: string) => void;
  onToggleArchive?: (chatId: string) => void;
  onOpenLabels?: (chatId: string) => void;
  labels?: ChatLabel[];
  onNewContact?: (contact?: {
    id?: string;
    name?: string;
    contact_name?: string;
    mobileNo?: string;
    whatsappAccount?: string;
    hasChat?: boolean;
    within24hWindow?: boolean;
    canSendDirect?: boolean;
  }) => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  onClose,
  isMobile = false,
  currentAccount,
  accounts,
  onSwitchAccount,
  currentUserName = "User",
  onLogout,
  onTogglePin,
  onToggleStar,
  onToggleArchive,
  onOpenLabels,
  labels = [],
  onNewContact,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ChatFilter>("all");
  const [showArchivedBanner, setShowArchivedBanner] = useState(true);
  const [selectedLabelFilters, setSelectedLabelFilters] = useState<string[]>(
    [],
  );
  // Guard: prevent the save effect from overwriting persisted state with
  // default values before the async restore completes on mount/account switch.
  const restoredRef = useRef(false);

  // Filter stats
  const unreadCount = useMemo(() => {
    return chats.filter((c) => c.unreadCount > 0 && !c.isArchived).length;
  }, [chats]);

  const starredCount = useMemo(() => {
    return chats.filter((c) => c.isStarred).length;
  }, [chats]);

  const archivedCount = useMemo(() => {
    return chats.filter((c) => c.isArchived).length;
  }, [chats]);

  // Restore persisted filter tab + label filters from IndexedDB on load,
  // scoped per WhatsApp account. `restoredRef` is set only after the async
  // restore completes so the save effect won't clobber persisted values
  // with the component's default initial state.
  useEffect(() => {
    let cancelled = false;
    restoredRef.current = false;
    (async () => {
      try {
        const state = await uiStateRepo.get(currentAccount);
        if (cancelled) return;
        if (state) {
          if (
            state.activeFilter === "all" ||
            state.activeFilter === "unread" ||
            state.activeFilter === "starred" ||
            state.activeFilter === "archived"
          ) {
            setActiveFilter(state.activeFilter);
          }
          if (Array.isArray(state.labelFilters)) {
            setSelectedLabelFilters(state.labelFilters);
          }
        }
      } catch {
        // ignore malformed stored values
      } finally {
        if (!cancelled) {
          restoredRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentAccount]);

  const toggleLabelFilter = useCallback((labelId: string) => {
    setSelectedLabelFilters((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    );
  }, []);

  // Persist the active filter tab + label filters to IndexedDB when they
  // change. Skip until after the async restore has completed so we never
  // save default "all" + [] over the user's persisted selection on mount.
  useEffect(() => {
    if (!restoredRef.current) return;
    uiStateRepo
      .save({
        account: currentAccount,
        activeFilter,
        labelFilters: selectedLabelFilters,
      })
      .catch(() => {});
  }, [currentAccount, activeFilter, selectedLabelFilters]);

  // Sort and filter chats
  const processedChats = useMemo(() => {
    let filtered = [...chats];

    // Apply filter
    switch (activeFilter) {
      case "unread":
        filtered = filtered.filter((c) => c.unreadCount > 0 && !c.isArchived);
        break;
      case "starred":
        filtered = filtered.filter((c) => c.isStarred);
        break;
      case "archived":
        filtered = filtered.filter((c) => c.isArchived);
        break;
      case "all":
      default:
        // Hide archived chats in "all" view
        filtered = filtered.filter((c) => !c.isArchived);
        break;
    }

    // Apply label filters (multichoice — show chats that have ANY selected label)
    if (selectedLabelFilters.length > 0) {
      filtered = filtered.filter((chat) => {
        const chatLabelIds = new Set((chat.labels || []).map((l) => l.name));
        return selectedLabelFilters.some((id) => chatLabelIds.has(id));
      });
    }

    // Apply search
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (chat) =>
          chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          chat.mobileNo.includes(searchQuery),
      );
    }

    // Sort: pinned first, then by timestamp
    filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return filtered;
  }, [chats, activeFilter, searchQuery, selectedLabelFilters]);

  const formatTime = useCallback((timestamp: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (hours < 48) {
      return "Yesterday";
    } else if (hours < 168) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  }, []);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      onSelectChat(chatId);
      if (isMobile && onClose) {
        onClose();
      }
    },
    [onSelectChat, isMobile, onClose],
  );

  const handleSwitchAccount = useCallback(
    async (accountName: string) => {
      await onSwitchAccount(accountName);
      setShowAccountSwitcher(false);
    },
    [onSwitchAccount],
  );

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-[#202c33]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-[60px] bg-[#202c33]">
          <div className="flex items-center space-x-3 min-w-0">
            <Avatar name={currentUserName} size="md" color="#25D366" />
            <div className="min-w-0">
              <h2 className="font-semibold text-white text-base truncate">
                {currentUserName}
              </h2>
              <p className="text-xs text-[#8696a0]">Online</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs — All | Unread | Starred | Archived */}
        <div className="flex border-b border-[#2a3942] bg-[#202c33] overflow-x-auto no-scrollbar">
          <FilterTab
            icon={<Home className="w-4 h-4" />}
            label="All"
            isActive={activeFilter === "all"}
            onClick={() => setActiveFilter("all")}
          />
          <FilterTab
            icon={
              unreadCount > 0 ? (
                <Mail className="w-4 h-4" />
              ) : (
                <MailOpen className="w-4 h-4" />
              )
            }
            label="Unread"
            count={unreadCount}
            isActive={activeFilter === "unread"}
            onClick={() => setActiveFilter("unread")}
          />
          <FilterTab
            icon={<Star className="w-4 h-4" />}
            label="Starred"
            count={starredCount}
            isActive={activeFilter === "starred"}
            onClick={() => setActiveFilter("starred")}
          />
          <FilterTab
            icon={<Archive className="w-4 h-4" />}
            label="Archived"
            count={archivedCount}
            isActive={activeFilter === "archived"}
            onClick={() => setActiveFilter("archived")}
          />
        </div>

        {/* Archived Banner (shown on "all" when archived chats exist) */}
        {activeFilter === "all" && archivedCount > 0 && showArchivedBanner && (
          <div
            onClick={() => setActiveFilter("archived")}
            className="flex items-center justify-between px-4 py-2.5 bg-[#182229] border-b border-[#2a3942] cursor-pointer hover:bg-[#1f2d33] transition"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-[#8696a0]" />
              <span className="text-sm text-[#d1d7db]">
                {archivedCount} archived chat{archivedCount !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowArchivedBanner(false);
              }}
              className="text-xs text-[#8696a0] hover:text-[#aebac1]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Search */}
        <div className="p-3 bg-[#202c33]">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Label Filter — horizontal chip/pill row (toggles directly) */}
        {labels.length > 0 && (
          <div className="px-3 pb-3 bg-[#202c33]">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {selectedLabelFilters.length > 0 && (
                <button
                  onClick={() => setSelectedLabelFilters([])}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-[#2a3942] text-white hover:bg-[#3b4a54] transition"
                  title="Clear label filters"
                >
                  ✕ All
                </button>
              )}
              {labels.map((label) => {
                const isChecked = selectedLabelFilters.includes(label.name);
                return (
                  <button
                    key={label.name}
                    onClick={() => toggleLabelFilter(label.name)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      isChecked
                        ? "text-white shadow"
                        : "bg-[#2a3942] text-[#d1d7db] hover:bg-[#3b4a54]"
                    }`}
                    style={
                      isChecked
                        ? { backgroundColor: label.color || "#25D366" }
                        : undefined
                    }
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${isChecked ? "bg-white/80" : ""}`}
                      style={
                        isChecked
                          ? undefined
                          : { backgroundColor: label.color || "#8696a0" }
                      }
                    />
                    {label.label_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {processedChats.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-[#2a3942] flex items-center justify-center mb-3">
              {activeFilter === "unread" ? (
                <MailOpen className="w-8 h-8 text-[#8696a0]" />
              ) : activeFilter === "starred" ? (
                <Star className="w-8 h-8 text-[#8696a0]" />
              ) : activeFilter === "archived" ? (
                <Archive className="w-8 h-8 text-[#8696a0]" />
              ) : (
                <Plus className="w-8 h-8 text-[#8696a0]" />
              )}
            </div>
            <p className="text-[#8696a0] text-sm font-medium">
              {searchQuery
                ? "No chats found"
                : activeFilter === "unread"
                  ? "No unread chats"
                  : activeFilter === "starred"
                    ? "No starred chats"
                    : activeFilter === "archived"
                      ? "No archived chats"
                      : "No chats available"}
            </p>
            <p className="text-[#8696a0] text-xs mt-1">
              {searchQuery
                ? "Try a different search term"
                : activeFilter === "unread"
                  ? "All caught up!"
                  : activeFilter === "starred"
                    ? "Star a chat to see it here"
                    : activeFilter === "archived"
                      ? "Archive a chat to see it here"
                      : "Start a new conversation by clicking the + button"}
            </p>
          </div>
        )}

        {/* Chat List + Floating New Chat Button (WhatsApp-style) */}
        <div className="relative flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {processedChats.map((chat) => (
              <ChatRoom
                key={chat.id}
                chat={chat}
                isActive={selectedChatId === chat.id}
                onClick={() => handleSelectChat(chat.id)}
                formatTime={formatTime}
                onTogglePin={onTogglePin}
                onToggleStar={onToggleStar}
                onToggleArchive={onToggleArchive}
                onOpenLabels={onOpenLabels}
              />
            ))}
          </div>

          {/* Floating circular + (like real WhatsApp) — opens new chat */}
          <button
            onClick={() => setShowAddRoom(true)}
            className="absolute bottom-4 right-4 z-20 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20b859] text-white shadow-lg shadow-black/40 flex items-center justify-center transition transform hover:scale-105"
            title="New message"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>

        {/* Bottom Navigation — Chats | Account Switcher (if >1) | Logout */}
        <div className="border-t border-[#2a3942] p-2">
          <div className="flex items-center justify-around">
            <button
              onClick={() => {
                setActiveFilter("all");
                setShowArchivedBanner(true);
              }}
              className="flex flex-col items-center space-y-0.5 p-2 rounded-lg transition flex-1 group"
            >
              <Home
                className={`w-5 h-5 transition ${activeFilter === "all" ? "text-[#25D366]" : "text-[#aebac1] group-hover:text-white"}`}
              />
              <span
                className={`text-[10px] transition ${activeFilter === "all" ? "text-[#25D366]" : "text-[#aebac1] group-hover:text-white"}`}
              >
                Chats
              </span>
            </button>
            {accounts.length > 1 && (
              <button
                onClick={() => setShowAccountSwitcher(true)}
                className="flex flex-col items-center space-y-0.5 p-2 rounded-lg transition flex-1 group"
              >
                <Smartphone className="w-5 h-5 text-[#aebac1] group-hover:text-white transition" />
                <span className="text-[10px] text-[#aebac1] group-hover:text-white transition">
                  Accounts
                </span>
              </button>
            )}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex flex-col items-center space-y-0.5 p-2 rounded-lg transition flex-1 group"
            >
              <LogOut className="w-5 h-5 text-[#aebac1] group-hover:text-red-500 transition" />
              <span className="text-[10px] text-[#aebac1] group-hover:text-red-500 transition">
                Logout
              </span>
            </button>
          </div>
        </div>
      </div>

      <AccountSwitcher
        isOpen={showAccountSwitcher}
        onClose={() => setShowAccountSwitcher(false)}
        currentAccount={currentAccount}
        accounts={accounts}
        onSwitch={handleSwitchAccount}
      />
      <AddRoomModal
        isOpen={showAddRoom}
        onClose={() => setShowAddRoom(false)}
        whatsappAccount={currentAccount}
        onSuccess={(contact) => {
          if (onNewContact) {
            onNewContact(contact);
          }
          if (onClose) onClose();
        }}
      />

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-[#202c33] rounded-lg shadow-xl w-80 max-w-full">
            <div className="p-4 border-b border-[#2a3942]">
              <h3 className="text-lg font-semibold text-white">Logout</h3>
            </div>
            <div className="p-4">
              <p className="text-[#d1d7db] text-sm">
                Are you sure you want to logout?
              </p>
            </div>
            <div className="p-4 border-t border-[#2a3942] flex justify-end space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm text-[#aebac1] hover:bg-[#2a3942] rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Filter tab sub-component
interface FilterTabProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}

const FilterTab: React.FC<FilterTabProps> = ({
  icon,
  label,
  count,
  isActive,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center gap-1 py-2.5 px-3 text-xs font-medium transition border-b-2 flex-shrink-0 ${
      isActive
        ? "text-[#25D366] border-[#25D366]"
        : "text-[#8696a0] border-transparent hover:text-[#aebac1]"
    }`}
  >
    {icon}
    <span className="whitespace-nowrap">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="bg-[#2a3942] text-[10px] text-[#aebac1] px-1.5 py-0.5 rounded-full ml-0.5">
        {count > 99 ? "99+" : count}
      </span>
    )}
  </button>
);