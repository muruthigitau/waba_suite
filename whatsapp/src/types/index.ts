// src/types/index.ts
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
}

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  fullTimestamp: Date;
  isSent: boolean;
  status: "sent" | "delivered" | "read" | "failed";
  type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "location"
    | "contact"
    | "button"
    | "interactive"
    | "flow"
    | "reaction";
  reactions?: { emoji: string; count: number; users?: string[] }[];
  replyTo?: {
    content: string;
    sender: string;
    messageId: string;
    contentType?: string;
  };
  senderName?: string;
  caption?: string;
  attach?: string;
  locationData?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  contactData?: any;
  buttonData?: any;
  interactiveData?: any;
  isTemplate?: boolean;
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

export interface RawMessage {
  name: string;
  content: string;
  creation: string;
  sender: string;
  sender_user_no: string;
  status: "sent" | "delivered" | "read" | "failed";
  type: "Incoming" | "Outgoing";
  content_type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "location"
    | "contact"
    | "button"
    | "interactive"
    | "flow"
    | "reaction";
  attach?: string;
  caption?: string;
  reply_to_message?: string;
  reactions?: { emoji: string; count: number; users?: string[] }[];
  location_data?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  contact_data?: any;
  button_data?: any;
  interactive_data?: any;
  sender_name?: string;
}

export interface GuestFormData {
  email: string;
  full_name: string;
  message: string;
}

export interface GuestResponse {
  token: string;
  guest_name: string;
  email: string;
  room: string;
  room_type: string;
  whatsapp_account: string;
}

export interface SendMessageParams {
  content: string;
  user: string;
  room: string;
  user_no: string;
  attachment?: string;
  message_id: string;
  whatsapp_account: string;
  reply_to_message_id?: string | null;
  content_type?: string;
}

export interface GetMessagesParams {
  room: string;
  user_no: string;
  whatsapp_account: string;
}

export interface GetRoomsParams {
  email: string;
  whatsapp_account: string;
}

export interface CreateRoomParams {
  contact_name: string;
  mobile_no: string;
  email: string;
  whatsapp_account: string;
}

export interface MarkAsReadParams {
  room: string;
  whatsapp_account: string;
}

export interface MarkMultipleAsReadParams {
  whatsapp_contact: string;
  whatsapp_account: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  users?: string[];
}

export interface ButtonData {
  id: string;
  text: string;
}

export interface InteractiveData {
  header?: string;
  body?: string;
  footer?: string;
  buttons?: ButtonData[];
}

export interface FlowData {
  title?: string;
  description?: string;
  token?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface ContactData {
  name?: string;
  phones?: Array<{ phone: string; type?: string }>;
  emails?: Array<{ email: string; type?: string }>;
}

export interface MessageStatusUpdate {
  message_id: string;
  room: string;
  status: "sent" | "delivered" | "read" | "failed";
  whatsapp_account: string;
}

export interface LatestChatUpdate {
  room: string;
  content: string;
  creation: string;
  sender: string;
  sender_user_no: string;
  status: string;
  type: string;
  content_type: string;
  name?: string;
  attach?: string;
  caption?: string;
  whatsapp_account: string;
  contact_name?: string;
  reply_to_message?: string;
  reactions?: Reaction[];
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

export interface ApiResponse<T = any> {
  message: T;
  status?: number;
  httpStatus?: number;
  exc_type?: string;
  exception?: string;
}

export interface FrappeCallOptions {
  method: string;
  params?: Record<string, any>;
  args?: Record<string, any>;
}

export interface MessageGroup {
  date: string;
  messages: Message[];
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

export interface FileUploadResponse {
  message: {
    doctype: string;
    name: string;
    file_url: string;
  };
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
  data?: Record<string, any>;
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
