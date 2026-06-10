export interface Chat {
  id: string;
  name: string;
  mobileNo: string;
  contactName: string;
  avatar: string;
  lastMessage: string;
  lastMessageType?: "text" | "image" | "video" | "document";
  lastMessageStatus?: "sent" | "delivered" | "read";
  timestamp: string;
  unreadCount: number;
  online?: boolean;
  typing: boolean;
  isGroup: boolean;
  whatsappAccount: string;
  roomType: "Direct" | "Group" | "Guest";
}

export interface Message {
  id: string;
  content: string;
  timestamp: string;
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
  sender?: string;
  senderName?: string;
  caption?: string;
  attach?: string;
  reactions?: { emoji: string; count: number }[];
  replyTo?: {
    content: string;
    sender: string;
    messageId: string;
    contentType?: string;
  };
  locationData?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  contactData?: any;
  buttonData?: any;
  interactiveData?: any;
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
