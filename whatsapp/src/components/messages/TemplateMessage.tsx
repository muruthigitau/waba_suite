import {
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  Phone,
} from "lucide-react";
import React, { useState } from "react";

interface TemplateMessageProps {
  content: string;
}

interface TemplateData {
  template_name: string;
  body_values: string[];
  header_values?: string[];
  footer_values?: string[];
  filled_header?: string;
  filled_body?: string;
  filled_footer?: string;
  header?: {
    type: string;
    text?: string;
    url?: string;
    filename?: string;
  };
  buttons?: Array<{
    button_type: string;
    button_label: string;
    phone_number?: string;
    url_type?: string;
    url?: string;
  }>;
}

const parseTemplateContent = (content: string): TemplateData | null => {
  try {
    const parsed = JSON.parse(content);
    if (parsed.template_name) {
      return parsed as TemplateData;
    }
  } catch {
    return null;
  }
  return null;
};

const isHtmlContent = (content: string): boolean => {
  return /<[a-z][\s\S]*>/i.test(content);
};

const extractDocumentFromHtml = (
  html: string,
): { url: string; name: string } | null => {
  const urlMatch = html.match(/http[^<]+\.(pdf|jpg|jpeg|png|gif|webp)/i);
  const nameMatch = html.match(/<b>Document:<\/b>\s*([^<]+)/);
  if (urlMatch) {
    return {
      url: urlMatch[0],
      name: nameMatch
        ? nameMatch[1].trim()
        : urlMatch[0].split("/").pop() || "Document",
    };
  }
  return null;
};

const extractImageFromHtml = (html: string): string | null => {
  const urlMatch = html.match(/http[^<]+\.(jpg|jpeg|png|gif|webp)/i);
  return urlMatch ? urlMatch[0] : null;
};

const extractButtonsFromHtml = (
  html: string,
): Array<{ text: string; url: string }> => {
  const buttons: Array<{ text: string; url: string }> = [];
  const buttonMatches = html.match(/<a href='([^']+)'>([^<]+)<\/a>/g);
  if (buttonMatches) {
    for (const match of buttonMatches) {
      const urlMatch = match.match(/href='([^']+)'/);
      const textMatch = match.match(/>([^<]+)</);
      if (urlMatch && textMatch) {
        buttons.push({ url: urlMatch[1], text: textMatch[1] });
      }
    }
  }
  return buttons;
};

const extractBodyFromHtml = (html: string): string => {
  const bodyMatch = html.match(/<b>Body:<\/b>\s*([^<]+)/);
  return bodyMatch ? bodyMatch[1] : "";
};

const extractTitleFromHtml = (html: string): string => {
  const titleMatch = html.match(
    /<div[^>]*font-size:14px;font-weight:600[^>]*>([^<]+)<\/div>/,
  );
  return titleMatch ? titleMatch[1] : "";
};

export const TemplateMessage: React.FC<TemplateMessageProps> = ({
  content,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPdfFullscreen, setShowPdfFullscreen] = useState(false);
  const [htmlImageLoaded, setHtmlImageLoaded] = useState(false);
  const [htmlImageError, setHtmlImageError] = useState(false);
  const [htmlIsFullscreen, setHtmlIsFullscreen] = useState(false);
  const [htmlShowPdfFullscreen, setHtmlShowPdfFullscreen] = useState(false);

  const jsonTemplate = parseTemplateContent(content);
  const isHtml = !jsonTemplate && isHtmlContent(content);

  if (jsonTemplate) {
    // Use the filled (fully resolved) text for display
    // These contain the actual text with {{N}} replaced by user values
    const headerText = jsonTemplate.filled_header || jsonTemplate.header?.text || "";
    const bodyText = jsonTemplate.filled_body || "";
    const footerText = jsonTemplate.filled_footer || "";
    const isImage = jsonTemplate.header?.type === "IMAGE";
    const isDocument = jsonTemplate.header?.type === "DOCUMENT";

    // Build full message preview - exactly what the recipient sees
    const fullMessage = [headerText, bodyText, footerText].filter(Boolean).join("\n\n");

    return (
      <div className="space-y-2">
        {/* Template Name Badge */}
        <div className="flex items-center gap-1.5 mb-1">
          <FileText className="w-3 h-3 text-[#25D366]" />
          <span className="text-[10px] text-[#25D366] font-medium uppercase tracking-wider">
            {jsonTemplate.template_name || "Template"}
          </span>
        </div>

        {isImage && jsonTemplate.header?.url && (
          <>
            <div
              className="relative rounded-lg overflow-hidden cursor-pointer bg-[#2a3942]"
              onClick={() => setIsFullscreen(true)}
            >
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-pulse w-8 h-8 rounded-full bg-[#3b4a54]" />
                </div>
              )}
              {imageError && (
                <div className="flex items-center justify-center p-8">
                  <FileText className="w-8 h-8 text-[#8696a0]" />
                  <span className="text-xs text-[#8696a0] ml-2">Failed to load image</span>
                </div>
              )}
              <img
                src={jsonTemplate.header.url}
                alt=""
                className={`w-full max-h-[300px] object-contain rounded-lg transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </div>
            {isFullscreen && (
              <div
                className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                onClick={() => setIsFullscreen(false)}
              >
                <div className="relative max-w-[90vw] max-h-[90vh]">
                  <img src={jsonTemplate.header.url} alt="" className="max-w-full max-h-full object-contain" />
                  <div className="absolute top-4 right-4 flex gap-2">
                    <a href={jsonTemplate.header.url} download onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition">
                      <Download className="w-5 h-5 text-white" />
                    </a>
                    <button onClick={() => setIsFullscreen(false)}
                      className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition">
                      <Minimize2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {isDocument && jsonTemplate.header?.url && (
          <div className="space-y-2">
            <div className="w-full h-[300px] bg-[#2a3942] rounded-lg overflow-hidden">
              <iframe src={`${jsonTemplate.header.url}#toolbar=0`} className="w-full h-full" title="PDF" />
            </div>
            <div className="flex items-center justify-between p-2 bg-[#2a3942] rounded-lg">
              <span className="text-sm text-white truncate">{jsonTemplate.header.filename || "Document"}</span>
              <div className="flex gap-1">
                <button onClick={() => setShowPdfFullscreen(true)} className="p-1.5 bg-[#3b4a54] rounded-lg hover:bg-[#4a5a64] transition">
                  <Maximize2 className="w-4 h-4 text-white" />
                </button>
                <a href={jsonTemplate.header.url} download className="p-1.5 bg-[#3b4a54] rounded-lg hover:bg-[#4a5a64] transition">
                  <Download className="w-4 h-4 text-white" />
                </a>
              </div>
            </div>
            {showPdfFullscreen && (
              <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                <div className="relative w-full max-w-5xl h-[90vh] bg-white rounded-lg overflow-hidden">
                  <div className="absolute top-2 right-2 z-10 flex gap-2">
                    <a href={jsonTemplate.header.url} download className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition">
                      <Download className="w-5 h-5 text-white" />
                    </a>
                    <button onClick={() => setShowPdfFullscreen(false)} className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition">
                      <Minimize2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  <iframe src={`${jsonTemplate.header.url}#toolbar=0`} className="w-full h-full" title="PDF Fullscreen" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full message content - shows complete text as the recipient sees it */}
        {fullMessage && (
          <div className="text-sm text-[#d1d7db] whitespace-pre-wrap leading-relaxed">
            {fullMessage}
          </div>
        )}

        {jsonTemplate.buttons && jsonTemplate.buttons.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {jsonTemplate.buttons.map((button, idx) => {
              if (button.button_type === "Visit Website") {
                return (
                  <a key={idx} href={button.url?.replace("{{1}}", "") || "#"} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-[#25D366]/10 text-[#25D366] rounded-lg border border-[#25D366]/20 text-xs font-medium hover:bg-[#25D366]/20 transition">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {button.button_label}
                  </a>
                );
              }
              if (button.button_type === "Call Phone") {
                return (
                  <a key={idx} href={`tel:${button.phone_number}`}
                    className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-[#25D366]/10 text-[#25D366] rounded-lg border border-[#25D366]/20 text-xs font-medium hover:bg-[#25D366]/20 transition">
                    <Phone className="w-3.5 h-3.5" />
                    {button.button_label}
                  </a>
                );
              }
              return (
                <button key={idx} disabled
                  className="w-full py-2 px-3 bg-[#2a3942] text-[#aebac1] rounded-lg text-xs font-medium cursor-not-allowed">
                  {button.button_label}
                </button>
              );
            })}
          </div>
        )}

        {/* Timestamp is rendered by parent bubble */}
      </div>
    );
  }

  if (isHtml) {
    const title = extractTitleFromHtml(content);
    const body = extractBodyFromHtml(content);
    const imageUrl = extractImageFromHtml(content);
    const document = extractDocumentFromHtml(content);
    const buttons = extractButtonsFromHtml(content);
    return (
      <div className="space-y-2">
        {title && <div className="text-sm font-semibold text-[#25D366] border-b border-[#2a3942] pb-2">{title}</div>}
        {imageUrl && (
          <>
            <div className="relative rounded-lg overflow-hidden cursor-pointer bg-[#2a3942]" onClick={() => setHtmlIsFullscreen(true)}>
              {!htmlImageLoaded && !htmlImageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-pulse w-8 h-8 rounded-full bg-[#3b4a54]" />
                </div>
              )}
              {htmlImageError && (
                <div className="flex items-center justify-center p-8">
                  <FileText className="w-8 h-8 text-[#8696a0]" />
                  <span className="text-xs text-[#8696a0] ml-2">Failed to load image</span>
                </div>
              )}
              <img src={imageUrl} alt=""
                className={`w-full max-h-[300px] object-contain rounded-lg transition-opacity ${htmlImageLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setHtmlImageLoaded(true)} onError={() => setHtmlImageError(true)} />
            </div>
            {htmlIsFullscreen && (
              <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setHtmlIsFullscreen(false)}>
                <div className="relative max-w-[90vw] max-h-[90vh]">
                  <img src={imageUrl} alt="" className="max-w-full max-h-full object-contain" />
                  <div className="absolute top-4 right-4 flex gap-2">
                    <a href={imageUrl} download onClick={(e) => e.stopPropagation()} className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition">
                      <Download className="w-5 h-5 text-white" />
                    </a>
                    <button onClick={() => setHtmlIsFullscreen(false)} className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition">
                      <Minimize2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {document && (
          <div className="space-y-2">
            <div className="w-full h-[300px] bg-[#2a3942] rounded-lg overflow-hidden">
              <iframe src={`${document.url}#toolbar=0`} className="w-full h-full" title="PDF" />
            </div>
            <div className="flex items-center justify-between p-2 bg-[#2a3942] rounded-lg">
              <span className="text-sm text-white truncate">{document.name}</span>
              <button onClick={() => setHtmlShowPdfFullscreen(true)} className="p-1.5 bg-[#3b4a54] rounded-lg hover:bg-[#4a5a64] transition">
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        )}
        {body && <div className="text-sm text-[#d1d7db] leading-relaxed">{body}</div>}
        {buttons.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {buttons.map((b, i) => (
              <a key={i} href={b.url.replace("{{1}}", "")} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-[#25D366]/10 text-[#25D366] rounded-lg border border-[#25D366]/20 text-xs font-medium hover:bg-[#25D366]/20 transition">
                <ExternalLink className="w-3.5 h-3.5" />{b.text}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
      {content}
    </p>
  );
};