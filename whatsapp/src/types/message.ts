/** Message-related type definitions for the WhatsApp chat application. */

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

export interface MessageGroup {
  date: string;
  messages: Message[];
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