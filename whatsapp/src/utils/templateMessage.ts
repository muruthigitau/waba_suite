/**
 * Helpers for parsing and resolving WhatsApp template messages.
 *
 * Template messages are stored as a JSON payload on `WhatsApp Message.message`
 * while the original template text is kept in the `template_*_raw` fields.
 * These helpers merge both so the chat UI can reliably render the header,
 * body, footer, media attachment and buttons.
 */

export type TemplateMediaKind = "image" | "video" | "document";

export interface TemplateHeaderPayload {
  type?: string;
  text?: string;
  url?: string;
  filename?: string;
}

export interface TemplateButtonPayload {
  button_type?: string;
  button_label?: string;
  phone_number?: string;
  url_type?: string;
  url?: string;
}

export interface TemplatePayload {
  template_name?: string;
  header_values?: unknown;
  body_values?: unknown;
  footer_values?: unknown;
  filled_header?: string;
  filled_body?: string;
  filled_footer?: string;
  header?: TemplateHeaderPayload;
  buttons?: TemplateButtonPayload[];
}

export interface TemplateRawSections {
  header?: string;
  body?: string;
  footer?: string;
}

export interface ResolvedTemplate {
  templateName: string;
  headerText: string;
  bodyText: string;
  footerText: string;
  mediaKind: TemplateMediaKind | null;
  mediaUrl: string;
  mediaFilename: string;
  buttons: TemplateButtonPayload[];
}

const MEDIA_EXTENSIONS: Record<string, TemplateMediaKind> = {
  avif: "image",
  bmp: "image",
  gif: "image",
  jpeg: "image",
  jpg: "image",
  png: "image",
  svg: "image",
  webp: "image",
  "3gp": "video",
  avi: "video",
  mkv: "video",
  mov: "video",
  mp4: "video",
  webm: "video",
};

const TEMPLATE_PAYLOAD_KEYS = [
  "template_name",
  "header_values",
  "body_values",
  "footer_values",
  "filled_header",
  "filled_body",
  "filled_footer",
  "header",
  "buttons",
];

const PLACEHOLDER_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize a JSON string or array into a list of variable values. */
export function toValueList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => (value === null || value === undefined ? "" : String(value)));
}

/** Replace `{{1}}` style placeholders with the matching positional value. */
export function replacePlaceholders(text: string | undefined, values: unknown): string {
  if (!text) return "";
  const list = toValueList(values);
  if (!list.length) return text;
  return text.replace(PLACEHOLDER_PATTERN, (match, index: string) => {
    const value = list[Number(index) - 1];
    return value === undefined || value === "" ? match : value;
  });
}

/** Return true when the text still contains `{{n}}` placeholders. */
export function hasPlaceholders(text: string | undefined): boolean {
  return Boolean(text && text.match(PLACEHOLDER_PATTERN));
}

/**
 * Parse the JSON payload stored on a template message.
 *
 * Returns `null` for regular text messages or malformed JSON so callers can
 * fall back to plain text rendering.
 */
export function parseTemplatePayload(content: string | undefined): TemplatePayload | null {
  const trimmed = (content || "").trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return null;
    if (!TEMPLATE_PAYLOAD_KEYS.some((key) => key in parsed)) return null;
    return parsed as TemplatePayload;
  } catch {
    return null;
  }
}

function resolveSection(filled: string | undefined, raw: string | undefined, values: unknown): string {
  const fromRaw = replacePlaceholders(raw, values);
  if (fromRaw && !hasPlaceholders(fromRaw)) return fromRaw;
  return filled || fromRaw || raw || "";
}

function inferMediaKind(url: string | undefined): TemplateMediaKind | null {
  if (!url) return null;
  const cleanUrl = url.split("?")[0].split("#")[0];
  const extension = cleanUrl.split(".").pop()?.toLowerCase() || "";
  return MEDIA_EXTENSIONS[extension] || null;
}

function declaredMediaKind(headerType: string): TemplateMediaKind | null {
  if (headerType === "IMAGE") return "image";
  if (headerType === "VIDEO") return "video";
  if (headerType === "DOCUMENT") return "document";
  return null;
}

function filenameFromUrl(url: string): string {
  const cleanUrl = url.split("?")[0].split("#")[0];
  const segment = cleanUrl.split("/").pop() || "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Resolve a template payload and the stored raw template into display values. */
export function resolveTemplate(
  payload: TemplatePayload,
  raw: TemplateRawSections | undefined,
  fallbackFileUrl?: string,
): ResolvedTemplate {
  const header = payload.header || {};
  const headerType = (header.type || "").toUpperCase();
  const detectedKind = declaredMediaKind(headerType);
  const isMediaHeader = Boolean(detectedKind);
  const mediaKind = detectedKind ?? (headerType ? null : inferMediaKind(header.url || fallbackFileUrl));
  const mediaUrl = mediaKind ? header.url || fallbackFileUrl || "" : "";
  const mediaFilename = header.filename || (mediaUrl ? filenameFromUrl(mediaUrl) : "");

  const rawHeader = isMediaHeader ? "" : raw?.header || header.text || "";
  const headerText = isMediaHeader ? "" : resolveSection(payload.filled_header, rawHeader, payload.header_values);

  return {
    templateName: payload.template_name || "",
    headerText,
    bodyText: resolveSection(payload.filled_body, raw?.body, payload.body_values),
    footerText: resolveSection(payload.filled_footer, raw?.footer, payload.footer_values),
    mediaKind,
    mediaUrl,
    mediaFilename,
    buttons: Array.isArray(payload.buttons)
      ? payload.buttons.filter((button) => Boolean(button?.button_label))
      : [],
  };
}

/** Build a clickable href for website/phone template buttons. */
export function getTemplateButtonHref(button: TemplateButtonPayload): string | null {
  const type = (button.button_type || "").toLowerCase();

  if (type === "visit website" || type === "url") {
    const url = (button.url || "").replace(PLACEHOLDER_PATTERN, "").trim();
    return url && url !== "#" ? url : null;
  }

  if (type === "call phone" || type === "phone_number") {
    const phone = (button.phone_number || "").replace(/[^\d+]/g, "");
    return phone ? `tel:${phone}` : null;
  }

  return null;
}
