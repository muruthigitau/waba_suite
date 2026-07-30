/** Component prop type definitions for the WhatsApp chat application. */

import type { Chat, Account, UserSettings, ChatSettings } from "./chat";
import type { Message, Reaction, ButtonData, InteractiveData, FlowData, LocationData, ContactData, MessageStatusUpdate, LatestChatUpdate } from "./message";
import type { GuestFormData } from "./api";

export interface ChatContextType {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  selectedChat: Chat | null;
  setSelectedChat: (chat: Chat | null) => void;
  messages: Record<string, Message[]>;
  addMessage: (chatId: string, message: Message) => void;
  updateMessageStatus: (
    chatId: string,
    messageId: string,
    status: Message["status"],
  ) => void;
  updateMessageReactions: (
    chatId: string,
    messageId: string,
    reactions: Reaction[],
  ) => void;
  sendMessage: (
    chatId: string,
    content: string,
    replyTo?: Message["replyTo"],
    type?: string,
    attach?: string,
  ) => Promise<void>;
  sendReaction: (
    chatId: string,
    messageId: string,
    emoji: string,
  ) => Promise<void>;
  markMessagesAsRead: (chatId: string, roomId: string) => Promise<void>;
  userSettings: UserSettings;
  updateUserSettings: (settings: UserSettings) => Promise<void>;
  currentAccount: string;
  accounts: Account[];
  switchAccount: (accountName: string) => Promise<void>;
  isLoading: boolean;
  unreadCount: number;
  refreshChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
}

export interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
  currentAccount: string;
  accounts: Account[];
  onSwitchAccount: (accountName: string) => Promise<void>;
}

export interface ChatRoomProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  formatTime: (timestamp: string) => string;
}

export interface ChatSpaceProps {
  chat: Chat | null;
  messages: Message[];
  onSendMessage: (content: string, replyTo?: Message) => Promise<void>;
  onSendReaction?: (messageId: string, emoji: string) => Promise<void>;
  onLoadMessages: () => Promise<void>;
  onMarkAsRead: () => Promise<void>;
  onBack?: () => void;
  isMobile?: boolean;
  isLoading?: boolean;
}

export interface MessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  isGroup?: boolean;
}

export interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
  src?: string;
  color?: string;
}

export interface LoaderProps {
  size?: "sm" | "md" | "lg";
  color?: string;
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface ImageMessageProps {
  src: string;
  caption?: string;
}

export interface VideoMessageProps {
  src: string;
  caption?: string;
}

export interface DocumentMessageProps {
  fileUrl: string;
  fileName: string;
}

export interface LocationMessageProps {
  location: LocationData;
}

export interface ContactMessageProps {
  contact: ContactData;
}

export interface ReactionMessageProps {
  emoji: string;
  count?: number;
}

export interface ButtonMessageProps {
  buttons: ButtonData[];
  onButtonClick?: (buttonId: string) => void;
}

export interface InteractiveMessageProps {
  interactive: InteractiveData;
  onButtonClick?: (buttonId: string) => void;
}

export interface FlowMessageProps {
  flow: FlowData;
  onFlowOpen?: (token: string) => void;
}

export interface AccountSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: string;
  accounts: Account[];
  onSwitch: (accountName: string) => Promise<void>;
}

export interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappAccount: string;
  onSuccess?: () => void;
}

export interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ChatWelcomeProps {
  profile: {
    name: string;
    is_admin: boolean;
    chat_status: "Online" | "Offline";
  };
  onSubmitForm: (data: GuestFormData) => Promise<void>;
}

export interface ChatFormProps {
  profile: {
    name: string;
    is_admin: boolean;
    chat_status: "Online" | "Offline";
  };
  onSubmit: (data: GuestFormData) => Promise<void>;
}

export interface ChatBubbleProps {
  isOpen: boolean;
  unreadCount: number;
  onToggle: () => void;
  title?: string;
}

export interface ChatHeaderProps {
  chat: Chat | null;
  onBack?: () => void;
  isMobile?: boolean;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onMenu?: () => void;
}

export interface ChatAppProps {
  settings: ChatSettings;
  user: string;
  userEmail: string;
  isAdmin: boolean;
  whatsappAccount?: string;
}

export interface UseChatReturn {
  chats: Chat[];
  selectedChat: Chat | null;
  messages: Record<string, Message[]>;
  sendMessage: (content: string, replyTo?: Message["replyTo"]) => Promise<void>;
  sendReaction: (messageId: string, emoji: string) => Promise<void>;
  markAsRead: (chatId: string) => Promise<void>;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  selectChat: (chat: Chat | null) => void;
  isLoading: boolean;
  unreadCount: number;
}

export interface UseFrappeRealtimeOptions {
  onMessage?: (data: LatestChatUpdate) => void;
  onStatusUpdate?: (data: MessageStatusUpdate) => void;
  onNewRoom?: (data: NewRoomCreation) => void;
  enabled?: boolean;
}

export interface NewRoomCreation {
  room: string;
  room_name: string;
  mobile_no: string;
  contact_name: string;
  room_type: string;
  whatsapp_account: string;
  members?: string[];
  member_names?: Array<{ name: string; email: string }>;
}

export interface SocketEvents {
  latest_chat_updates: LatestChatUpdate;
  message_status_update: MessageStatusUpdate;
  new_room_creation: NewRoomCreation;
  private_room_creation: NewRoomCreation;
}

export interface UserDetails {
  email: string;
  full_name: string;
  user_image?: string;
  roles?: string[];
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
}

export interface TypingIndicator {
  chatId: string;
  userId: string;
  isTyping: boolean;
}

export interface MessageSearchResult {
  message: Message;
  chat: Chat;
  context?: string;
}

export interface ChatExportData {
  chat: Chat;
  messages: Message[];
  exportedAt: Date;
  format: "json" | "txt" | "html";
}