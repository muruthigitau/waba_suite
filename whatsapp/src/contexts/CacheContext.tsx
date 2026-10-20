/**
 * Offline sync context.
 *
 * Exposes network/sync status and the offline message queue to the UI.
 *
 * Navigation and chat-list state (active account, selected chat, filter tab,
 * label filters) are intentionally NOT cached here — they are derived from the
 * URL via `hooks/useUrlState`, and chat/message data is loaded from the server
 * so counts always reflect the backend source of truth.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { chatRepo, messageRepo } from "../services/repository";
import syncEngine from "../services/syncEngine";
import type { DexieMessage } from "../services/db";
import type { Chat, Message } from "../types";

interface CacheContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: string | undefined;
  queueOfflineMessage: (
    chat: Chat,
    content: string,
    messageId: string,
    replyTo?: Message,
    fileUrl?: string,
  ) => Promise<void>;
  triggerSync: () => Promise<void>;
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | undefined>();

  // Listen to network status.
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

  // Listen to sync status.
  useEffect(() => {
    syncEngine.onStatusChange((status) => {
      setIsSyncing(status.syncing);
      setPendingCount(status.pendingCount);
      setLastSync(status.lastSync);
    });
  }, []);

  // Start auto sync while online.
  useEffect(() => {
    if (isOnline) {
      syncEngine.startAutoSync();
    }
    return () => {
      syncEngine.stopAutoSync();
    };
  }, [isOnline]);

  const queueOfflineMessage = useCallback(
    async (
      chat: Chat,
      content: string,
      messageId: string,
      replyTo?: Message,
      fileUrl?: string,
    ): Promise<void> => {
      if (isOnline) return;

      const dexieMsg: DexieMessage = {
        id: messageId,
        chatId: chat.id,
        whatsappAccount: chat.whatsappAccount,
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
              attach: replyTo.attach,
              caption: replyTo.caption,
            }
          : undefined,
      };

      await messageRepo.addOptimistic(dexieMsg);

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

      await chatRepo.updateLastMessage(
        chat.id,
        content,
        new Date().toISOString(),
        "sending",
      );
    },
    [isOnline],
  );

  const triggerSync = useCallback(async () => {
    await syncEngine.triggerSync();
  }, []);

  const value = useMemo<CacheContextType>(
    () => ({
      isOnline,
      isSyncing,
      pendingCount,
      lastSync,
      queueOfflineMessage,
      triggerSync,
    }),
    [
      isOnline,
      isSyncing,
      pendingCount,
      lastSync,
      queueOfflineMessage,
      triggerSync,
    ],
  );

  return (
    <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
  );
};

export default CacheContext;
