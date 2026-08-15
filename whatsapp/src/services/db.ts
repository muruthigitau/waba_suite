import Dexie, { type EntityTable } from "dexie";

export interface DexieChat {
  id: string;
  name: string;
  mobileNo: string;
  avatar: string;
  profilePicture?: string | null;
  lastMessage: string;
  lastMessageType: string;
  lastMessageStatus: string;
  timestamp: string;
  unreadCount: number;
  online: boolean;
  typing: boolean;
  isGroup: boolean;
  whatsappAccount: string;
  roomType: string;
  contactName?: string;
  syncedAt: string;
}

export interface DexieMessageReaction {
  emoji: string;
  count: number;
  users?: string[];
}

export interface DexieReplyTo {
  content: string;
  sender: string;
  messageId: string;
  contentType?: string;
}

export interface DexieLocationData {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface DexieContactData {
  name?: string;
  phones?: Array<{ phone: string; type?: string }>;
  emails?: Array<{ email: string; type?: string }>;
}

export interface DexieButtonData {
  id: string;
  text: string;
}

export interface DexieInteractiveData {
  header?: string;
  body?: string;
  footer?: string;
  buttons?: DexieButtonData[];
}

export interface DexieMessage {
  id: string;
  chatId: string;
  whatsappAccount: string;
  content: string;
  timestamp: string;
  fullTimestamp: Date;
  isSent: boolean;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  type: string;
  senderName?: string;
  caption?: string;
  attach?: string;
  reactions?: DexieMessageReaction[];
  replyTo?: DexieReplyTo;
  locationData?: DexieLocationData;
  contactData?: DexieContactData;
  buttonData?: DexieButtonData;
  interactiveData?: DexieInteractiveData;
  isTemplate?: boolean;
  isPending: number; // 1 = pending sync, 0 = synced
  syncedAt: string;
}

export interface DexieRoute {
  id: string;
  path: string;
  selectedChatId: string | null;
  currentAccount: string;
  updatedAt: string;
}

export interface DexiePendingMessage {
  id: string;
  localMessageId: string;
  chatId: string;
  content: string;
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
  createdAt: string;
  retryCount: number;
  lastError?: string;
  status: "pending" | "syncing" | "failed";
}

export interface DexieAccount {
  name: string;
  accountName: string;
  phoneId: string;
  unreadCount: number;
  isDefault: boolean;
  syncedAt: string;
}

export interface DexieUserSettings {
  id: string;
  enableMessageTone: boolean;
  enableNotifications: boolean;
  fullName: string;
  syncedAt: string;
}

/**
 * Persisted chat-list UI state (filter tab + selected label filters),
 * scoped per WhatsApp account so each account keeps its own filter state.
 * `id` is the account name.
 */
export interface DexieUiState {
  id: string;
  activeFilter: string;
  labelFilters: string[];
  updatedAt: string;
}

const db = new Dexie("WhatsAppDB") as Dexie & {
  chats: EntityTable<DexieChat, "id">;
  messages: EntityTable<DexieMessage, "id">;
  routes: EntityTable<DexieRoute, "id">;
  pendingMessages: EntityTable<DexiePendingMessage, "id">;
  accounts: EntityTable<DexieAccount, "name">;
  userSettings: EntityTable<DexieUserSettings, "id">;
  uiState: EntityTable<DexieUiState, "id">;
};

db.version(1).stores({
  chats: "id, whatsappAccount, timestamp, name, mobileNo",
  messages: "id, chatId, timestamp, status, isPending, fullTimestamp",
  routes: "id",
  pendingMessages: "id, chatId, status, createdAt",
  accounts: "name, isDefault",
  userSettings: "id",
});

// Add uiState table (filter tab + label filters) — persisted in IndexedDB.
db.version(2).stores({
  chats: "id, whatsappAccount, timestamp, name, mobileNo",
  messages: "id, chatId, timestamp, status, isPending, fullTimestamp",
  routes: "id",
  pendingMessages: "id, chatId, status, createdAt",
  accounts: "name, isDefault",
  userSettings: "id",
  uiState: "id",
});

// v3: Add whatsappAccount index to messages so each account's messages are
// isolated. Messages are scoped per (chatId + whatsappAccount).
db.version(3).stores({
  chats: "id, whatsappAccount, timestamp, name, mobileNo",
  messages: "id, chatId, whatsappAccount, timestamp, status, isPending, fullTimestamp",
  routes: "id",
  pendingMessages: "id, chatId, status, createdAt, whatsappAccount",
  accounts: "name, isDefault",
  userSettings: "id",
  uiState: "id",
});

export default db;