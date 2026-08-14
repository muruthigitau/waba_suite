/** API-related type definitions for the WhatsApp chat application. */

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

export interface ApiResponse<T = unknown> {
  message: T;
  status?: number;
  httpStatus?: number;
  exc_type?: string;
  exception?: string;
}

export interface FrappeCallOptions {
  method: string;
  params?: Record<string, unknown>;
  args?: Record<string, unknown>;
}

export interface FileUploadResponse {
  message: {
    doctype: string;
    name: string;
    file_url: string;
  };
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