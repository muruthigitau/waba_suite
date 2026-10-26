/**
 * Types for bulk WhatsApp campaigns and recipient lists.
 *
 * These mirror the `Bulk WhatsApp Message` and `WhatsApp Recipient List`
 * DocTypes returned by the Frappe REST API.
 */

export type BulkMessageStatus =
  | "Draft"
  | "Queued"
  | "In Progress"
  | "Completed"
  | "Partially Failed";

/** A submitted (or draft) bulk campaign row. */
export interface BulkMessage {
  name: string;
  title: string;
  status: BulkMessageStatus;
  recipient_count: number;
  sent_count: number;
  template?: string;
  recipient_list?: string;
  whatsapp_account?: string;
  creation: string;
  docstatus: number;
}

/** A row in the `WhatsApp Recipient` child table. */
export interface RecipientRow {
  /** Existing child-row name; omit for newly added recipients. */
  name?: string;
  mobile_number: string;
  recipient_name?: string;
  recipient_data?: string | Record<string, unknown>;
}

/** A `WhatsApp Recipient List` with its child rows. */
export interface RecipientList {
  name: string;
  list_name: string;
  description?: string;
  modified?: string;
  recipients?: RecipientRow[];
}

/** Standalone approved template as returned by `get_standalone_templates`. */
export interface MessageTemplate {
  name: string;
  template_name: string;
  header: string;
  /** Header media type (`TEXT`, `IMAGE` or `DOCUMENT`). */
  header_type?: string;
  footer: string;
  template: string;
  variables: number[];
  header_vars: string[];
  body_vars: string[];
  footer_vars: string[];
}

/** A selectable contact row returned by `bulk_recipients.get_recipient_options`. */
export interface RecipientOption {
  name: string;
  contact_name: string;
  mobile_no: string;
  company_name?: string | null;
}

/** Paginated payload returned by `bulk_recipients.get_recipient_options`. */
export interface RecipientOptionsResponse {
  items: RecipientOption[];
  has_more: boolean;
}

/** Contact payload returned by the WhatsApp contacts API. */
export interface WhatsAppContact {
  name: string;
  contact_name: string;
  mobile_no: string;
  has_chat?: boolean;
  session_status?: string | null;
  session_expires_at?: string | null;
  is_session_expired?: boolean;
}

/** Progress summary returned by `bulk_messaging.get_progress`. */
export interface BulkProgress {
  total: number;
  /** Successfully processed messages (includes delivered/read receipts). */
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  queued: number;
  /** Messages still in draft/processing states. */
  pending: number;
  /** Sent + failed. */
  processed: number;
  percent: number;
  /** Raw per-status counts, keyed by lowercase WhatsApp Message status. */
  status_counts?: Record<string, number>;
}
