import db, {
  type DexieChat,
  type DexieMessage,
  type DexieRoute,
  type DexiePendingMessage,
  type DexieAccount,
  type DexieUserSettings,
  type DexieUiState,
} from "./db";

const SYNCED_AT = new Date().toISOString();

// ─── Chats Repository ─────────────────────────────────────────

export const chatRepo = {
  async getAll(accountName: string): Promise<DexieChat[]> {
    return db.chats
      .where("whatsappAccount")
      .equals(accountName)
      .reverse()
      .sortBy("timestamp");
  },

  async getById(id: string): Promise<DexieChat | undefined> {
    return db.chats.get(id);
  },

  async bulkUpsert(chats: DexieChat[]): Promise<void> {
    await db.chats.bulkPut(chats);
  },

  async upsert(chat: DexieChat): Promise<void> {
    await db.chats.put(chat);
  },

  async updateLastMessage(
    chatId: string,
    lastMessage: string,
    timestamp: string,
    status: string,
  ): Promise<void> {
    await db.chats.update(chatId, {
      lastMessage,
      timestamp,
      lastMessageStatus: status,
    });
  },

  async updateUnreadCount(
    chatId: string,
    unreadCount: number,
  ): Promise<void> {
    await db.chats.update(chatId, { unreadCount });
  },

  async clearUnread(chatId: string): Promise<void> {
    await db.chats.update(chatId, { unreadCount: 0 });
  },

  async delete(id: string): Promise<void> {
    await db.chats.delete(id);
  },

  async clearAll(): Promise<void> {
    await db.chats.clear();
  },

  async clearByAccount(whatsappAccount: string): Promise<void> {
    await db.chats.where("whatsappAccount").equals(whatsappAccount).delete();
  },
};

// ─── Messages Repository ──────────────────────────────────────

export const messageRepo = {
  async getByChatId(
    chatId: string,
    whatsappAccount: string,
  ): Promise<DexieMessage[]> {
    return db.messages
      .where({ chatId, whatsappAccount })
      .reverse()
      .sortBy("fullTimestamp");
  },

  async getById(id: string): Promise<DexieMessage | undefined> {
    return db.messages.get(id);
  },

  async bulkUpsert(messages: DexieMessage[]): Promise<void> {
    await db.messages.bulkPut(messages);
  },

  async upsert(message: DexieMessage): Promise<void> {
    await db.messages.put(message);
  },

  async addOptimistic(message: DexieMessage): Promise<void> {
    await db.messages.put({ ...message, isPending: 1, syncedAt: SYNCED_AT });
  },

  async updateStatus(
    id: string,
    status: DexieMessage["status"],
  ): Promise<void> {
    await db.messages.update(id, { status, isPending: 0, syncedAt: SYNCED_AT });
  },

  async markAsSynced(id: string): Promise<void> {
    await db.messages.update(id, { isPending: 0, syncedAt: SYNCED_AT });
  },

  async deleteByChatId(chatId: string): Promise<void> {
    await db.messages.where("chatId").equals(chatId).delete();
  },

  async deleteByAccount(whatsappAccount: string): Promise<void> {
    await db.messages.where("whatsappAccount").equals(whatsappAccount).delete();
  },

  async clearByAccount(whatsappAccount: string): Promise<void> {
    await db.messages.where("whatsappAccount").equals(whatsappAccount).delete();
  },

  async clearAll(): Promise<void> {
    await db.messages.clear();
  },

  async getPendingMessages(
    chatId: string,
    whatsappAccount?: string,
  ): Promise<DexieMessage[]> {
    if (whatsappAccount) {
      return db.messages
        .where({ chatId, isPending: 1, whatsappAccount })
        .toArray();
    }
    return db.messages
      .where({ chatId, isPending: 1 })
      .toArray();
  },

  async getLastTimestamp(
    chatId: string,
    whatsappAccount?: string,
  ): Promise<string | undefined> {
    let latest: DexieMessage[];
    if (whatsappAccount) {
      latest = await db.messages
        .where({ chatId, whatsappAccount })
        .reverse()
        .sortBy("fullTimestamp");
    } else {
      latest = await db.messages
        .where({ chatId, whatsappAccount: "unknown" })
        .reverse()
        .sortBy("fullTimestamp");
    }
    // sortBy with reverse() returns newest-first, so latest[0] is the newest
    return latest.length > 0 ? latest[0].fullTimestamp.toISOString() : undefined;
  },
};

// ─── Route/Memory Repository ──────────────────────────────────

export const routeRepo = {
  async get(): Promise<DexieRoute | undefined> {
    return db.routes.get("current");
  },

  async save(data: {
    path: string;
    selectedChatId: string | null;
    currentAccount: string;
  }): Promise<void> {
    await db.routes.put({
      id: "current",
      path: data.path,
      selectedChatId: data.selectedChatId,
      currentAccount: data.currentAccount,
      updatedAt: SYNCED_AT,
    });
  },

  async clear(): Promise<void> {
    await db.routes.delete("current");
  },
};

// ─── Pending Messages Queue Repository ────────────────────────

export const pendingMessageRepo = {
  async getAll(status?: DexiePendingMessage["status"]): Promise<DexiePendingMessage[]> {
    if (status) {
      return db.pendingMessages
        .where("status")
        .equals(status)
        .toArray();
    }
    return db.pendingMessages.toArray();
  },

  async getByChatId(chatId: string): Promise<DexiePendingMessage[]> {
    return db.pendingMessages
      .where("chatId")
      .equals(chatId)
      .toArray();
  },

  async enqueue(msg: Omit<DexiePendingMessage, "id" | "createdAt" | "retryCount" | "status">): Promise<string> {
    const id = `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await db.pendingMessages.put({
      id,
      ...msg,
      createdAt: SYNCED_AT,
      retryCount: 0,
      status: "pending",
    });
    return id;
  },

  async markAsSyncing(id: string): Promise<void> {
    await db.pendingMessages.update(id, { status: "syncing" });
  },

  async markAsFailed(id: string, error: string): Promise<void> {
    const entry = await db.pendingMessages.get(id);
    if (entry) {
      await db.pendingMessages.update(id, {
        status: "failed",
        retryCount: entry.retryCount + 1,
        lastError: error,
      });
    }
  },

  async markAsSent(id: string): Promise<void> {
    await db.pendingMessages.delete(id);
  },

  async incrementRetry(id: string): Promise<void> {
    const entry = await db.pendingMessages.get(id);
    if (entry) {
      await db.pendingMessages.update(id, {
        retryCount: entry.retryCount + 1,
      });
    }
  },

  async delete(id: string): Promise<void> {
    await db.pendingMessages.delete(id);
  },

  async clearAll(): Promise<void> {
    await db.pendingMessages.clear();
  },

  async clearByAccount(whatsappAccount: string): Promise<void> {
    await db.pendingMessages
      .where("whatsappAccount")
      .equals(whatsappAccount)
      .delete();
  },
};

// ─── Accounts Repository ──────────────────────────────────────

export const accountRepo = {
  async getAll(): Promise<DexieAccount[]> {
    return db.accounts.toArray();
  },

  async getDefault(): Promise<DexieAccount | undefined> {
    const all = await db.accounts.toArray();
    return all.find((a) => a.isDefault);
  },

  async bulkUpsert(accounts: DexieAccount[]): Promise<void> {
    await db.accounts.bulkPut(accounts);
  },

  async upsert(account: DexieAccount): Promise<void> {
    await db.accounts.put(account);
  },

  async clearAll(): Promise<void> {
    await db.accounts.clear();
  },
};

// ─── User Settings Repository ─────────────────────────────────

export const userSettingsRepo = {
  async get(): Promise<DexieUserSettings | undefined> {
    return db.userSettings.get("current");
  },

  async save(settings: Omit<DexieUserSettings, "id" | "syncedAt">): Promise<void> {
    await db.userSettings.put({
      id: "current",
      ...settings,
      syncedAt: SYNCED_AT,
    });
  },

  async clear(): Promise<void> {
    await db.userSettings.delete("current");
  },
};

// ─── Database Maintenance ─────────────────────────────────────

export const uiStateRepo = {
  async get(account: string): Promise<DexieUiState | undefined> {
    return db.uiState.get(account);
  },

  async save(data: {
    account: string;
    activeFilter: string;
    labelFilters: string[];
  }): Promise<void> {
    await db.uiState.put({
      id: data.account,
      activeFilter: data.activeFilter,
      labelFilters: data.labelFilters,
      updatedAt: SYNCED_AT,
    });
  },

  async clear(account: string): Promise<void> {
    await db.uiState.delete(account);
  },
};

export const dbMaintenance = {
  async clearAllData(): Promise<void> {
    await Promise.all([
      db.chats.clear(),
      db.messages.clear(),
      db.routes.clear(),
      db.pendingMessages.clear(),
      db.accounts.clear(),
      db.userSettings.clear(),
      db.uiState.clear(),
    ]);
  },

  async getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
      };
    }
    return null;
  },
};