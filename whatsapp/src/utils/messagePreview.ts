/**
 * Concise, media-aware previews for message references (reply quotes).
 *
 * Reply quotes and the reply compose bar only have a short amount of space, so
 * raw message bodies (or worse, attachment URLs) make poor references. These
 * helpers turn any message into a compact, human-readable label — typed icons
 * for media, file name plus caption for documents, and a length-capped text
 * excerpt for normal messages.
 */

/** Maximum number of characters shown for a reply reference. */
export const REPLY_PREVIEW_MAX = 64;

const TYPE_ICONS: Record<string, string> = {
  image: "📷",
  video: "🎥",
  audio: "🎵",
  document: "📄",
  location: "📍",
  contact: "👤",
  button: "🔘",
  interactive: "💬",
  flow: "📋",
  reaction: "😊",
  template: "📋",
};

/**
 * Return the file name portion of a URL, without query strings or hashes.
 *
 * @param url Attachment URL (or any path-like string).
 * @returns The decoded base file name, or "" when it cannot be determined.
 */
export function fileNameFromUrl(url?: string | null): string {
  if (!url) return "";
  const clean = url.split("?")[0].split("#")[0];
  const base = clean.substring(clean.lastIndexOf("/") + 1);
  if (!base) return "";
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}

/**
 * Strip HTML/entities from a message body so templates/previews read cleanly.
 *
 * @param html Raw message content.
 * @returns Plain-text content with entities decoded and whitespace collapsed.
 */
export function stripMessageHtml(html?: string | null): string {
  if (!html) return "";
  if (!/<[a-z!/][\s\S]*>/i.test(html)) return html;
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Collapse whitespace and cap a string to `max` characters.
 *
 * @param text Source text.
 * @param max Maximum length (an ellipsis is added when truncating).
 * @returns The trimmed, possibly truncated, text.
 */
export function truncateText(text: string, max: number): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Build a compact reference label for a message.
 *
 * @param input Message type, content, attachment and caption.
 * @returns A short label such as "📄 invoice.pdf • March invoice".
 */
export function getMessagePreview(input: {
  type?: string | null;
  content?: string | null;
  attach?: string | null;
  caption?: string | null;
  maxLength?: number;
}): string {
  const max = input.maxLength ?? REPLY_PREVIEW_MAX;
  const type = (input.type || "text").toLowerCase();
  const caption = stripMessageHtml(input.caption);
  const content = stripMessageHtml(input.content);
  const icon = TYPE_ICONS[type] || "📎";

  switch (type) {
    case "image":
      return truncateText(caption ? `${icon} Photo • ${caption}` : `${icon} Photo`, max);
    case "video":
      return truncateText(caption ? `${icon} Video • ${caption}` : `${icon} Video`, max);
    case "audio":
      return `${icon} Audio`;
    case "document": {
      const name = fileNameFromUrl(input.attach || input.content);
      const detail = caption && caption !== name ? ` • ${caption}` : "";
      if (name) return truncateText(`${icon} ${name}${detail}`, max);
      return truncateText(`${icon} ${caption || "Document"}`, max);
    }
    case "location":
      return `${icon} Location`;
    case "contact":
      return `${icon} Contact`;
    case "reaction":
      return content || `${icon} Reaction`;
    case "template":
      return truncateText(`${icon} ${caption || content || "Template"}`, max);
    default:
      return truncateText(content || caption || "Message", max);
  }
}

/**
 * Return a usable URL for previewing a message attachment, if any.
 *
 * @param input Message type, content and attachment.
 * @returns A URL safe to use in an <img>/<video>/pdf viewer, or null.
 */
export function getPreviewUrl(input: {
  type?: string | null;
  content?: string | null;
  attach?: string | null;
}): string | null {
  const url = input.attach || input.content;
  if (!url) return null;
  if (!/^(https?:)?\/\//i.test(url) && !url.startsWith("/")) return null;
  return url;
}

const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "heic",
  "heif",
];

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "3gp", "mkv", "avi"];

/**
 * Return the lower-case file extension of a URL's base file name.
 *
 * @param url Attachment URL (or any path-like string).
 * @returns The extension without the dot, or "" when absent.
 */
export function fileExtensionFromUrl(url?: string | null): string {
  const name = fileNameFromUrl(url);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
}

/** How an attachment should be previewed. */
export type PreviewKind = "image" | "video" | "pdf" | "other";

/**
 * Decide how to preview an attachment based on its type and file extension.
 *
 * Image/video content types are honoured directly; anything else (commonly
 * "document") is classified by its file extension so images and PDFs sent as
 * documents still get an inline preview.
 *
 * @param input Message type, content and attachment.
 * @returns The preview kind ("image" | "video" | "pdf" | "other").
 */
export function getPreviewKind(input: {
  type?: string | null;
  content?: string | null;
  attach?: string | null;
}): PreviewKind {
  const type = (input.type || "").toLowerCase();
  if (type === "image") return "image";
  if (type === "video") return "video";
  const ext = fileExtensionFromUrl(input.attach || input.content);
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "other";
}

