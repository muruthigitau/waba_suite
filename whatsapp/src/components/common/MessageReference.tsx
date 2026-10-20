import React from "react";
import { getMessagePreview } from "../../utils/messagePreview";
import { MessageThumbnail } from "./MessageThumbnail";

interface MessageReferenceProps {
  /** Short label shown above the preview (sender name / "Replying to …"). */
  sender: string;
  /** Content type of the referenced message (image, document, text, …). */
  type?: string | null;
  content?: string | null;
  attach?: string | null;
  caption?: string | null;
  /** Maximum preview length; defaults to REPLY_PREVIEW_MAX. */
  maxLength?: number;
  /** When provided the whole reference becomes a button (e.g. jump to source). */
  onClick?: () => void;
}

/**
 * Compact, media-aware reference to another message.
 *
 * Used by reply quotes and the reply compose bar. Shows a small format-aware
 * thumbnail (image/video/PDF) and a typed, length-capped label so a reply
 * always carries a meaningful reference to the original message. Pass an
 * `onClick` to make the reference actionable (e.g. scroll to the source).
 */
export const MessageReference: React.FC<MessageReferenceProps> = ({
  sender,
  type,
  content,
  attach,
  caption,
  maxLength,
  onClick,
}) => {
  const preview = getMessagePreview({
    type,
    content,
    attach,
    caption,
    maxLength,
  });

  // Only media/document references get a thumbnail — plain text replies show
  // just the text preview.
  const normalizedType = (type || "").toLowerCase();
  const hasThumbnail =
    !!attach ||
    ["image", "video", "document", "audio"].includes(normalizedType);

  const body = (
    <div className="flex items-start gap-2 min-w-0 w-full">
      {hasThumbnail && (
        <MessageThumbnail type={type} content={content} attach={attach} />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#25D366] text-[11px] truncate">
          {sender}
        </p>
        <p className="text-[11px] text-[#d1d7db] truncate">{preview}</p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Go to message"
        className="w-full text-left cursor-pointer hover:bg-black/10 rounded transition"
      >
        {body}
      </button>
    );
  }

  return body;
};

export default MessageReference;
