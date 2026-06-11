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
  header?: {
    type: string;
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
  } catch (e) {
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
        buttons.push({
          url: urlMatch[1],
          text: textMatch[1],
        });
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

  const jsonTemplate = parseTemplateContent(content);
  const isHtml = !jsonTemplate && isHtmlContent(content);

  if (jsonTemplate) {
    const bodyText =
      jsonTemplate.body_values?.filter((v) => v !== "-").join(" ") || "";
    const isImage = jsonTemplate.header?.type === "IMAGE";
    const isDocument = jsonTemplate.header?.type === "DOCUMENT";

    return (
      <div className="space-y-3">
        {isImage && jsonTemplate.header?.url && (
          <>
            <div
              className="relative rounded-lg overflow-hidden cursor-pointer bg-[#2a3942]"
              onClick={() => setIsFullscreen(true)}
            >
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-pulse w-8 h-8 rounded-full bg-[#3b4a54]"></div>
                </div>
              )}
              {imageError && (
                <div className="flex items-center justify-center p-8">
                  <FileText className="w-8 h-8 text-[#8696a0]" />
                  <span className="text-xs text-[#8696a0] ml-2">
                    Failed to load image
                  </span>
                </div>
              )}
              <img
                src={jsonTemplate.header.url}
                alt="Template header"
                className={`w-full max-h-[300px] object-contain rounded-lg transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </div>

            {isFullscreen && (
              <div
                className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center"
                onClick={() => setIsFullscreen(false)}
              >
                <div className="relative max-w-[90vw] max-h-[90vh]">
                  <img
                    src={jsonTemplate.header.url}
                    alt="Template header"
                    className="max-w-full max-h-full object-contain"
                  />
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <a
                      href={jsonTemplate.header.url}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      <Download className="w-5 h-5 text-white" />
                    </a>
                    <button
                      onClick={() => setIsFullscreen(false)}
                      className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
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
            <div className="w-full h-[400px] bg-[#2a3942] rounded-lg overflow-hidden">
              <iframe
                src={`${jsonTemplate.header.url}#toolbar=0`}
                className="w-full h-full"
                title="PDF Preview"
              />
            </div>
            <div className="flex items-center justify-between p-2 bg-[#2a3942] rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#25D366]" />
                <span className="text-sm text-white truncate max-w-[180px]">
                  {jsonTemplate.header.filename || "Document"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowPdfFullscreen(true)}
                  className="p-1.5 bg-[#3b4a54] rounded-lg hover:bg-[#4a5a64] transition"
                >
                  <Maximize2 className="w-4 h-4 text-white" />
                </button>
                <a
                  href={jsonTemplate.header.url}
                  download
                  className="p-1.5 bg-[#3b4a54] rounded-lg hover:bg-[#4a5a64] transition"
                >
                  <Download className="w-4 h-4 text-white" />
                </a>
              </div>
            </div>

            {showPdfFullscreen && (
              <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4">
                <div className="relative w-full max-w-5xl h-[90vh] bg-white rounded-lg overflow-hidden">
                  <div className="absolute top-2 right-2 z-10 flex space-x-2">
                    <a
                      href={jsonTemplate.header.url}
                      download
                      className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      <Download className="w-5 h-5 text-white" />
                    </a>
                    <button
                      onClick={() => setShowPdfFullscreen(false)}
                      className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      <Minimize2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  <iframe
                    src={`${jsonTemplate.header.url}#toolbar=0`}
                    className="w-full h-full"
                    title="PDF Preview"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {bodyText && (
          <div className="text-sm text-[#d1d7db] leading-relaxed">
            {bodyText}
          </div>
        )}

        {jsonTemplate.buttons && jsonTemplate.buttons.length > 0 && (
          <div className="space-y-2 pt-2">
            {jsonTemplate.buttons.map((button, idx) => {
              if (button.button_type === "Visit Website") {
                let cleanUrl = button.url || "";
                if (cleanUrl.includes("{{1}}")) {
                  cleanUrl = cleanUrl.replace("{{1}}", "");
                }
                return (
                  <a
                    key={idx}
                    href={cleanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 w-full py-2.5 px-4 bg-[#25D366] text-white rounded-lg hover:bg-[#20b859] transition text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{button.button_label}</span>
                  </a>
                );
              }

              if (button.button_type === "Call Phone") {
                return (
                  <a
                    key={idx}
                    href={`tel:${button.phone_number}`}
                    className="flex items-center justify-center space-x-2 w-full py-2.5 px-4 bg-[#25D366] text-white rounded-lg hover:bg-[#20b859] transition text-sm font-medium"
                  >
                    <Phone className="w-4 h-4" />
                    <span>{button.button_label}</span>
                  </a>
                );
              }

              if (button.button_type === "Quick Reply") {
                return (
                  <button
                    key={idx}
                    disabled
                    className="w-full py-2.5 px-4 bg-[#2a3942] text-[#aebac1] rounded-lg text-sm font-medium cursor-not-allowed"
                  >
                    {button.button_label}
                  </button>
                );
              }

              if (button.button_type === "Flow") {
                return (
                  <button
                    key={idx}
                    disabled
                    className="w-full py-2.5 px-4 bg-[#2a3942] text-[#aebac1] rounded-lg text-sm font-medium cursor-not-allowed"
                  >
                    {button.button_label} (Flow)
                  </button>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>
    );
  }

  if (isHtml) {
    const title = extractTitleFromHtml(content);
    const body = extractBodyFromHtml(content);
    const imageUrl = extractImageFromHtml(content);
    const document = extractDocumentFromHtml(content);
    const buttons = extractButtonsFromHtml(content);
    const [htmlImageLoaded, setHtmlImageLoaded] = useState(false);
    const [htmlImageError, setHtmlImageError] = useState(false);
    const [htmlIsFullscreen, setHtmlIsFullscreen] = useState(false);
    const [htmlShowPdfFullscreen, setHtmlShowPdfFullscreen] = useState(false);

    return (
      <div className="space-y-3">
        {title && (
          <div className="text-sm font-semibold text-[#25D366] border-b border-[#2a3942] pb-2">
            {title}
          </div>
        )}

        {imageUrl && (
          <>
            <div
              className="relative rounded-lg overflow-hidden cursor-pointer bg-[#2a3942]"
              onClick={() => setHtmlIsFullscreen(true)}
            >
              {!htmlImageLoaded && !htmlImageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-pulse w-8 h-8 rounded-full bg-[#3b4a54]"></div>
                </div>
              )}
              {htmlImageError && (
                <div className="flex items-center justify-center p-8">
                  <FileText className="w-8 h-8 text-[#8696a0]" />
                  <span className="text-xs text-[#8696a0] ml-2">
                    Failed to load image
                  </span>
                </div>
              )}
              <img
                src={imageUrl}
                alt="Template"
                className={`w-full max-h-[300px] object-contain rounded-lg transition-opacity duration-300 ${htmlImageLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setHtmlImageLoaded(true)}
                onError={() => setHtmlImageError(true)}
              />
            </div>

            {htmlIsFullscreen && (
              <div
                className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center"
                onClick={() => setHtmlIsFullscreen(false)}
              >
                <div className="relative max-w-[90vw] max-h-[90vh]">
                  <img
                    src={imageUrl}
                    alt="Template"
                    className="max-w-full max-h-full object-contain"
                  />
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <a
                      href={imageUrl}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      <Download className="w-5 h-5 text-white" />
                    </a>
                    <button
                      onClick={() => setHtmlIsFullscreen(false)}
                      className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
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
            <div className="w-full h-[400px] bg-[#2a3942] rounded-lg overflow-hidden">
              <iframe
                src={`${document.url}#toolbar=0`}
                className="w-full h-full"
                title="PDF Preview"
              />
            </div>
            <div className="flex items-center justify-between p-2 bg-[#2a3942] rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#25D366]" />
                <span className="text-sm text-white truncate max-w-[180px]">
                  {document.name}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setHtmlShowPdfFullscreen(true)}
                  className="p-1.5 bg-[#3b4a54] rounded-lg hover:bg-[#4a5a64] transition"
                >
                  <Maximize2 className="w-4 h-4 text-white" />
                </button>
                <a
                  href={document.url}
                  download
                  className="p-1.5 bg-[#3b4a54] rounded-lg hover:bg-[#4a5a64] transition"
                >
                  <Download className="w-4 h-4 text-white" />
                </a>
              </div>
            </div>

            {htmlShowPdfFullscreen && (
              <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4">
                <div className="relative w-full max-w-5xl h-[90vh] bg-white rounded-lg overflow-hidden">
                  <div className="absolute top-2 right-2 z-10 flex space-x-2">
                    <a
                      href={document.url}
                      download
                      className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      <Download className="w-5 h-5 text-white" />
                    </a>
                    <button
                      onClick={() => setHtmlShowPdfFullscreen(false)}
                      className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      <Minimize2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  <iframe
                    src={`${document.url}#toolbar=0`}
                    className="w-full h-full"
                    title="PDF Preview"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {body && (
          <div className="text-sm text-[#d1d7db] leading-relaxed">{body}</div>
        )}

        {buttons && buttons.length > 0 && (
          <div className="space-y-2 pt-2">
            {buttons.map((button, idx) => {
              let cleanUrl = button.url;
              if (cleanUrl.includes("{{1}}")) {
                cleanUrl = cleanUrl.replace("{{1}}", "");
              }
              return (
                <a
                  key={idx}
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 w-full py-2.5 px-4 bg-[#25D366] text-white rounded-lg hover:bg-[#20b859] transition text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{button.text}</span>
                </a>
              );
            })}
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
