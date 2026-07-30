import { chatRepo, messageRepo, pendingMessageRepo, accountRepo, userSettingsRepo } from "./repository";
import type { DexieChat, DexieMessage, DexieAccount, DexieUserSettings } from "./db";

type SyncStatusCallback = (status: { syncing: boolean; pendingCount: number; lastSync?: string; error?: string }) => void;

type NetworkStatusCallback = (online: boolean) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiCall = (params: Record<string, any>) => Promise<any>;

class SyncEngine {
  private isSyncing = false;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private statusCallback: SyncStatusCallback | null = null;
  private networkCallbacks: NetworkStatusCallback[] = [];
  private isOnline = navigator.onLine;
  private syncIntervalMs = 15000; // 15 seconds
  private pendingMessageCall: ApiCall | null = null;
  private markAsReadCall: ApiCall | null = null;

  constructor() {
    window.addEventListener("online", () => this.handleNetworkChange(true));
    window.addEventListener("offline", () => this.handleNetworkChange(false));
  }

  private handleNetworkChange(online: boolean) {
    this.isOnline = online;
    this.networkCallbacks.forEach((cb) => cb(online));
    if (online) {
      this.triggerSync();
    }
  }

  onNetworkStatus(callback: NetworkStatusCallback) {
    this.networkCallbacks.push(callback);
    return () => {
      this.networkCallbacks = this.networkCallbacks.filter((cb) => cb !== callback);
    };
  }

  isOnlineNow(): boolean {
    return this.isOnline;
  }

  setSyncInterval(ms: number) {
    this.syncIntervalMs = ms;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.isOnline) {
      this.startAutoSync();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setApiCallbacks(params: {
    sendMessage: (params: Record<string, any>) => Promise<any>;
    markAsRead: (params: Record<string, any>) => Promise<any>;
  }) {
    this.pendingMessageCall = params.sendMessage;
    this.markAsReadCall = params.markAsRead;
  }

  onStatusChange(callback: SyncStatusCallback) {
    this.statusCallback = callback;
  }

  startAutoSync() {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      this.triggerSync();
    }, this.syncIntervalMs);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  async triggerSync() {
    if (this.isSyncing || !this.isOnline) return;

    this.isSyncing = true;
    this.statusCallback?.({ syncing: true, pendingCount: 0, lastSync: new Date().toISOString() });

    try {
      await this.syncPendingMessages();
      const pendingMessages = await pendingMessageRepo.getAll("failed");
      const pendingCount = pendingMessages.length;
      this.statusCallback?.({
        syncing: false,
        pendingCount,
        lastSync: new Date().toISOString(),
      });
    } catch (error) {
      this.statusCallback?.({
        syncing: false,
        pendingCount: 0,
        lastSync: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Sync failed",
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncPendingMessages() {
    if (!this.pendingMessageCall) return;

    const pendingQueue = await pendingMessageRepo.getAll("pending");
    const failedQueue = await pendingMessageRepo.getAll("failed");

    const toSync = [...pendingQueue, ...failedQueue].filter(
      (msg) => msg.retryCount < 5, // Max 5 retries
    );

    for (const pending of toSync) {
      try {
        await pendingMessageRepo.markAsSyncing(pending.id);

        await this.pendingMessageCall({
          content: pending.content,
          user: pending.user,
          room: pending.room,
          user_no: pending.userNo,
          message_id: pending.localMessageId,
          whatsapp_account: pending.whatsappAccount,
          reply_to_message_id: pending.replyToMessageId || null,
          content_type: pending.contentType,
          attachment: pending.attachment,
          caption: pending.caption,
        });

        // Mark the local message as synced
        await messageRepo.markAsSynced(pending.localMessageId);
        await pendingMessageRepo.markAsSent(pending.id);

        // Update chat last message
        await chatRepo.updateLastMessage(
          pending.chatId,
          pending.content,
          new Date().toISOString(),
          "sent",
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        await pendingMessageRepo.markAsFailed(pending.id, errorMsg);
      }
    }
  }

  async syncDataToLocal(data: {
    chats: DexieChat[];
    messages: DexieMessage[];
    accounts: DexieAccount[];
    userSettings?: DexieUserSettings;
  }) {
    if (data.chats.length > 0) {
      await chatRepo.bulkUpsert(data.chats);
    }
    if (data.messages.length > 0) {
      await messageRepo.bulkUpsert(data.messages);
    }
    if (data.accounts.length > 0) {
      await accountRepo.bulkUpsert(data.accounts);
    }
    if (data.userSettings) {
      await userSettingsRepo.save(data.userSettings);
    }
  }

  async queueMessage(params: {
    chatId: string;
    content: string;
    localMessageId: string;
    replyToMessageId?: string | null;
    replyToContent?: string;
    replyToSender?: string;
    contentType: string;
    attachment?: string | null;
    caption?: string;
    whatsappAccount: string;
    user: string;
    room: string;
    userNo: string;
  }) {
    await pendingMessageRepo.enqueue(params);
  }

  getSyncStatus(): { isSyncing: boolean; isOnline: boolean } {
    return { isSyncing: this.isSyncing, isOnline: this.isOnline };
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;