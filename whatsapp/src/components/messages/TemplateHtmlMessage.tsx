/**
 * Renders legacy HTML template messages created before templates were stored
 * as structured JSON payloads.
 */
import { Download, ExternalLink, FileText, Minimize2 } from "lucide-react";
import React, { useState } from "react";

interface TemplateHtmlMessageProps {
  html: string;
}

interface HtmlButton {
  text: string;
  url: string;
}

function extractDocument(html: string): { url: string; name: string } | null {
  const urlMatch = html.match(/http[^<]+\.(pdf|jpg|jpeg|png|gif|webp)/i);
  const nameMatch = html.match(/<b>Document:<\/b>\s*([^<]+)/);
  if (!urlMatch) return null;
  return {
    url: urlMatch[0],
    name: nameMatch ? nameMatch[1].trim() : urlMatch[0].split("/").pop() || "Document",
  };
}

function extractImage(html: string): string | null {
  const urlMatch = html.match(/http[^<]+\.(jpg|jpeg|png|gif|webp)/i);
  return urlMatch ? urlMatch[0] : null;
}

function extractButtons(html: string): HtmlButton[] {
  const matches = html.match(/<a href='([^']+)'>([^<]+)<\/a>/g);
  if (!matches) return [];
  return matches.flatMap((match) => {
    const urlMatch = match.match(/href='([^']+)'/);
    const textMatch = match.match(/>([^<]+)</);
    return urlMatch && textMatch ? [{ url: urlMatch[1], text: textMatch[1] }] : [];
  });
}

function extractBody(html: string): string {
  const match = html.match(/<b>Body:<\/b>\s*([^<]+)/);
  return match ? match[1] : "";
}

function extractTitle(html: string): string {
  const match = html.match(/<div[^>]*font-size:14px;font-weight:600[^>]*>([^<]+)<\/div>/);
  return match ? match[1] : "";
}

export const TemplateHtmlMessage: React.FC<TemplateHtmlMessageProps> = ({ html }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const title = extractTitle(html);
  const body = extractBody(html);
  const imageUrl = extractImage(html);
  const document = extractDocument(html);
  const buttons = extractButtons(html);

  return (
    <div className="space-y-2">
      {title && (
        <div className="border-b border-[#2a3942] pb-2 text-sm font-semibold text-[#25D366]">{title}</div>
      )}

      {imageUrl && (
        <>
          <div
            className="relative cursor-pointer overflow-hidden rounded-lg bg-[#2a3942]"
            onClick={() => setShowFullscreen(true)}
          >
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-pulse rounded-full bg-[#3b4a54]" />
              </div>
            )}
            {imageError && (
              <div className="flex items-center justify-center p-8">
                <FileText className="h-8 w-8 text-[#8696a0]" />
                <span className="ml-2 text-xs text-[#8696a0]">Failed to load image</span>
              </div>
            )}
            <img
              src={imageUrl}
              alt=""
              className={`max-h-[300px] w-full rounded-lg object-contain transition-opacity ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </div>

          {showFullscreen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
              onClick={() => setShowFullscreen(false)}
            >
              <div className="relative max-h-[90vh] max-w-[90vw]">
                <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                <div className="absolute top-4 right-4 flex gap-2">
                  <a
                    href={imageUrl}
                    download
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-full bg-black/50 p-2 transition hover:bg-black/70"
                    aria-label="Download image"
                  >
                    <Download className="h-5 w-5 text-white" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowFullscreen(false)}
                    className="rounded-full bg-black/50 p-2 transition hover:bg-black/70"
                    aria-label="Close image"
                  >
                    <Minimize2 className="h-5 w-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {document && (
        <div className="space-y-2">
          <div className="h-[300px] w-full overflow-hidden rounded-lg bg-[#2a3942]">
            <iframe src={`${document.url}#toolbar=0`} className="h-full w-full" title="PDF" />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#2a3942] p-2">
            <span className="truncate text-sm text-white">{document.name}</span>
            <a
              href={document.url}
              download
              className="rounded-lg bg-[#3b4a54] p-1.5 transition hover:bg-[#4a5a64]"
              aria-label="Download document"
            >
              <Download className="h-4 w-4 text-white" />
            </a>
          </div>
        </div>
      )}

      {body && <div className="text-sm leading-relaxed text-[#d1d7db]">{body}</div>}

      {buttons.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {buttons.map((button, index) => (
            <a
              key={`${button.text}-${index}`}
              href={button.url.replace(/\{\{\d+\}\}/g, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#25D366]/20 bg-[#25D366]/10 px-3 py-2 text-xs font-medium text-[#25D366] transition hover:bg-[#25D366]/20"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {button.text}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
