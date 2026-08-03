/** Chat-related type definitions for the WhatsApp chat application. */

export interface Chat {
  id: string;
  name: string;
  mobileNo: string;
  avatar: string;
  profilePicture?: string;
  lastMessage: string;
  lastMessageType?: string;
  lastMessageStatus?: string;
  timestamp: string;
  unreadCount: number;
  online: boolean;
  typing: boolean;
  isGroup: boolean;
  whatsappAccount: string;
  roomType: "Direct" | "Group" | "Guest";
  contactName?: string;
  isPinned?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  /** Whether the contact is within the WhatsApp 24h customer-service window. */
  within24hWindow?: boolean;
}

export interface Room {
  name: string;
  room_name: string;
  mobile_no: string;
  contact_name: string;
  last_message?: {
    content: string;
    content_type: string;
    status: string;
    creation: string;
  };
  unread_incoming: number;
  modified: string;
  type: "Direct" | "Group" | "Guest";
  is_read: number;
  whatsapp_account: string;
}

export interface ChatSettings {
  enable_chat: boolean;
  is_admin: boolean;
  user_settings: UserSettings;
  user: string;
  user_email: string;
  guest_title?: string;
  room?: string;
  is_verified?: boolean;
  chat_status?: "Online" | "Offline";
  socketio_port?: number;
}

export interface UserSettings {
  enableMessageTone: boolean;
  enableNotifications: boolean;
}

export interface Account {
  name: string;
  account_name: string;
  phone_id: string;
  unread_count: number;
  is_default: boolean;
}

export interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  selectedChatId: string | null;
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
}

export type ChatAction =
  | { type: "SET_CHATS"; payload: Chat[] }
  | { type: "ADD_CHAT"; payload: Chat }
  | { type: "UPDATE_CHAT"; payload: { id: string; updates: Partial<Chat> } }
  | { type: "DELETE_CHAT"; payload: string }
  | { type: "SET_MESSAGES"; payload: { chatId: string; messages: Message[] } }
  | { type: "ADD_MESSAGE"; payload: { chatId: string; message: Message } }
  | {
      type: "UPDATE_MESSAGE";
      payload: { chatId: string; messageId: string; updates: Partial<Message> };
    }
  | { type: "DELETE_MESSAGE"; payload: { chatId: string; messageId: string } }
  | { type: "SET_SELECTED_CHAT"; payload: string | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "UPDATE_UNREAD_COUNT"; payload: number }
  | { type: "CLEAR_UNREAD"; payload: string };