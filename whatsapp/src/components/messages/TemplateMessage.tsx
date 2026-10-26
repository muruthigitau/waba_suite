/**
 * Renders a WhatsApp template message inside the chat bubble.
 *
 * Structured template payloads are resolved against the stored raw template
 * so the header attachment, resolved variables, footer and buttons always
 * render in the same order the recipient sees them.
 */
import { FileText } from "lucide-react";
import React, { useMemo } from "react";
import type { TemplateRawSections } from "../../utils/templateMessage";
import { parseTemplatePayload, resolveTemplate } from "../../utils/templateMessage";
import { TemplateButtons } from "./TemplateButtons";
import { TemplateHtmlMessage } from "./TemplateHtmlMessage";
import { TemplateMedia } from "./TemplateMedia";

interface TemplateMessageProps {
  content: string;
  fileUrl?: string;
  templateRaw?: TemplateRawSections;
}

const HTML_PATTERN = /<[a-z][\s\S]*>/i;

export const TemplateMessage: React.FC<TemplateMessageProps> = ({ content, fileUrl, templateRaw }) => {
  const payload = useMemo(() => parseTemplatePayload(content), [content]);

  if (!payload) {
    if (HTML_PATTERN.test(content || "")) {
      return <TemplateHtmlMessage html={content} />;
    }
    return <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{content}</p>;
  }

  const template = resolveTemplate(payload, templateRaw, fileUrl);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <FileText className="h-3 w-3 text-[#25D366]" />
        <span className="text-[10px] font-medium tracking-wider text-[#25D366] uppercase">
          {template.templateName || "Template"}
        </span>
      </div>

      {template.mediaKind && (
        <TemplateMedia kind={template.mediaKind} url={template.mediaUrl} filename={template.mediaFilename} />
      )}

      {template.headerText && (
        <div className="text-sm font-semibold leading-relaxed break-words whitespace-pre-wrap text-white">
          {template.headerText}
        </div>
      )}

      {template.bodyText && (
        <div className="text-sm leading-relaxed break-words whitespace-pre-wrap text-[#d1d7db]">
          {template.bodyText}
        </div>
      )}

      {template.footerText && (
        <div className="text-xs leading-relaxed break-words whitespace-pre-wrap text-[#8696a0]">
          {template.footerText}
        </div>
      )}

      <TemplateButtons buttons={template.buttons} />
    </div>
  );
};
