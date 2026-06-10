import { FrappeApp } from "frappe-sdk";

const frappe = new FrappeApp(
  process.env.REACT_APP_FRAPPE_URL || "http://localhost:8000",
  {
    useToken: true,
    token: () => localStorage.getItem("frappe_token") || "",
  },
);

export const db = frappe.db();
export const call = frappe.call();

export interface ChatUser {
  email: string;
  full_name: string;
  user_image?: string;
}

export interface ChatRoom {
  name: string;
  room_name: string;
  mobile_no: string;
  contact_name: string;
  last_message?: ChatMessage;
  unread_incoming: number;
  modified: string;
  type: "Direct" | "Group" | "Guest";
  is_read: number;
  whatsapp_account: string;
}

export interface ChatMessage {
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
  reactions?: { emoji: string; count: number }[];
  location_data?: { latitude: number; longitude: number; name?: string };
  contact_data?: any;
  button_data?: any;
  interactive_data?: any;
}

export const chatAPI = {
  // Account methods
  getSettings: async (token?: string) => {
    const res = await call.get({
      method: "waba_suite.api.config.settings",
      params: { token: token || "" },
    });
    return res.message;
  },

  getUserAccounts: async () => {
    const res = await call.get({
      method: "waba_suite.api.accounts.get_user_accounts_with_default",
    });
    return res.message;
  },

  switchAccount: async (accountName: string) => {
    const res = await call.post({
      method: "waba_suite.api.accounts.switch_account",
      params: { account_name: accountName },
    });
    return res.message;
  },

  getActiveAccount: async () => {
    const res = await call.get({
      method: "waba_suite.api.accounts.get_active_account",
    });
    return res.message;
  },

  // Contacts/Rooms methods
  getRooms: async (email: string, whatsappAccount: string) => {
    const res = await call.get({
      method: "waba_suite.api.contacts.get",
      params: { email, whatsapp_account: whatsappAccount },
    });
    return res.message as ChatRoom[];
  },

  createRoom: async (
    contactName: string,
    mobileNo: string,
    email: string,
    whatsappAccount: string,
  ) => {
    const res = await call.post({
      method: "waba_suite.api.contacts.create",
      params: {
        contact_name: contactName,
        mobile_no: mobileNo,
        email,
        whatsapp_account: whatsappAccount,
      },
    });
    return res.message;
  },

  // Messages methods
  getMessages: async (
    room: string,
    userNo: string,
    whatsappAccount: string,
  ) => {
    const res = await call.get({
      method: "waba_suite.api.message.get_all",
      params: { room, user_no: userNo, whatsapp_account: whatsappAccount },
    });
    return res.message as ChatMessage[];
  },

  sendMessage: async (data: {
    content: string;
    user: string;
    room: string;
    user_no: string;
    attachment?: string;
    message_id: string;
    whatsapp_account: string;
    reply_to_message_id?: string | null;
    content_type?: string;
  }) => {
    const res = await call.post({
      method: "waba_suite.api.message.send",
      params: data,
    });
    return res.message;
  },

  markAsRead: async (room: string, whatsappAccount: string) => {
    await call.post({
      method: "waba_suite.api.message.mark_as_read",
      params: { room, whatsapp_account: whatsappAccount },
    });
  },

  markMultipleAsRead: async (
    whatsappContact: string,
    whatsappAccount: string,
  ) => {
    const res = await call.post({
      method: "waba_suite.api.message.mark_multiple_as_read",
      params: {
        whatsapp_contact: whatsappContact,
        whatsapp_account: whatsappAccount,
      },
    });
    return res.message;
  },

  // Guest methods
  createGuest: async (data: {
    email: string;
    full_name: string;
    message: string;
  }) => {
    const res = await call.post({
      method: "chat.api.user.get_guest_room",
      params: data,
    });
    return res.message;
  },

  // User settings
  updateUserSettings: async (settings: {
    enable_message_tone: boolean;
    enable_notifications: boolean;
  }) => {
    const res = await call.post({
      method: "chat.api.config.user_settings",
      params: { settings },
    });
    return res.message;
  },
};

export default frappe;
