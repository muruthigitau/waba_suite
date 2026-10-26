/**
 * Renders the media header of a WhatsApp template message.
 *
 * Images open in a fullscreen viewer, videos play inline and documents are
 * rendered as a downloadable file card.
 */
import { Download, ExternalLink, FileText, X } from "lucide-react";
import React, { useState } from "react";
import type { TemplateMediaKind } from "../../utils/templateMessage";

interface TemplateMediaProps {
  kind: TemplateMediaKind;
  url: string;
  filename?: string;
}

function UnavailableMedia({ filename }: { filename?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#2a3942]/60 bg-black/20 p-2.5">
      <FileText className="h-4 w-4 shrink-0 text-[#8696a0]" />
      <span className="truncate text-xs text-[#8696a0]">
        {filename ? `Attachment unavailable: ${filename}` : "Attachment unavailable"}
      </span>
    </div>
  );
}

export const TemplateMedia: React.FC<TemplateMediaProps> = ({ kind, url, filename }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const name = filename || "Attachment";

  if (!url) return <UnavailableMedia filename={filename} />;

  if (kind === "image") {
    if (imageError) return <UnavailableMedia filename={filename} />;

    return (
      <>
        <div className="relative overflow-hidden rounded-lg bg-black/20">
          <img
            src={url}
            alt={name}
            className="max-h-[260px] w-full cursor-pointer object-contain"
            onClick={() => setIsFullscreen(true)}
            onError={() => setImageError(true)}
          />
        </div>

        {isFullscreen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
            onClick={() => setIsFullscreen(false)}
          >
            <div className="relative max-h-[90vh] max-w-[90vw]">
              <img src={url} alt={name} className="max-h-[90vh] max-w-[90vw] object-contain" />
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="absolute top-3 right-3 rounded-full bg-black/60 p-2 transition hover:bg-black/80"
                aria-label="Close image"
              >
                <X className="h-5 w-5 text-white" />
              </button>
              <a
                href={url}
                download={name}
                onClick={(event) => event.stopPropagation()}
                className="absolute right-3 bottom-3 rounded-full bg-black/60 p-2 transition hover:bg-black/80"
                aria-label="Download image"
              >
                <Download className="h-5 w-5 text-white" />
              </a>
            </div>
          </div>
        )}
      </>
    );
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="max-h-[260px] w-full rounded-lg bg-black object-contain"
      >
        Your browser does not support embedded videos.
      </video>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#2a3942]/60 bg-black/20 p-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#25D366]">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="text-[10px] font-medium tracking-wider text-[#8696a0]">Document</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#aebac1] transition hover:bg-[#2a3942]"
        aria-label="Open document"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
      <a
        href={url}
        download={name}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#aebac1] transition hover:bg-[#2a3942]"
        aria-label="Download document"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
};
