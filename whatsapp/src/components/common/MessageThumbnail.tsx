import { FileText } from "lucide-react";
import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { getPreviewKind, getPreviewUrl } from "../../utils/messagePreview";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface MessageThumbnailProps {
  type?: string | null;
  content?: string | null;
  attach?: string | null;
  /** Tailwind size classes for the square thumbnail (defaults to 2.5rem). */
  className?: string;
}

/**
 * Small, format-aware preview of a message attachment.
 *
 * Renders a real thumbnail for images (any extension), videos and PDFs (first
 * page), and falls back to a generic file icon for other formats. Used by reply
 * references so replies carry a visual preview too.
 */
export const MessageThumbnail: React.FC<MessageThumbnailProps> = ({
  type,
  content,
  attach,
  className,
}) => {
  const [failed, setFailed] = useState(false);
  const kind = getPreviewKind({ type, content, attach });
  const url = getPreviewUrl({ type, content, attach });
  const size = className || "w-10 h-10";

  if (!url || failed || kind === "other") {
    return (
      <div
        className={`${size} rounded bg-black/20 flex items-center justify-center flex-shrink-0`}
      >
        <FileText className="w-4 h-4 text-[#8696a0]" />
      </div>
    );
  }

  if (kind === "image") {
    return (
      <img
        src={url}
        alt=""
        className={`${size} rounded object-cover bg-black/20 flex-shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        muted
        preload="metadata"
        className={`${size} rounded object-cover bg-black/20 flex-shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }

  // PDF — render the first page as a tiny thumbnail.
  return (
    <div
      className={`${size} rounded overflow-hidden bg-white flex items-center justify-center flex-shrink-0`}
    >
      <Document
        file={url}
        onLoadError={() => setFailed(true)}
        loading={
          <div className="w-3 h-3 rounded-full border-2 border-[#25D366] border-t-transparent animate-spin" />
        }
        error={<FileText className="w-4 h-4 text-[#8696a0]" />}
      >
        <Page
          pageNumber={1}
          width={48}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
};

export default MessageThumbnail;
