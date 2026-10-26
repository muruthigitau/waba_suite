/**
 * Attachment picker for bulk templates with an image or document header.
 *
 * The same file is sent to every recipient of the campaign, matching the
 * shared template variables stored on the bulk document.
 */

import React from "react";
import type { TemplateAttachmentKind } from "../../services/bulkMessaging";
import { FileUploadField } from "../common/FileUploadField";

interface TemplateAttachmentProps {
  kind: TemplateAttachmentKind;
  value?: string;
  onChange: (fileUrl: string | null) => void;
}

const ACCEPT: Record<"image" | "document", string> = {
  image: ".png,.jpg,.jpeg,.webp",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt",
};

export const TemplateAttachment: React.FC<TemplateAttachmentProps> = ({
  kind,
  value,
  onChange,
}) => {
  if (!kind) return null;

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-[#aebac1]">
        {kind === "image" ? "Header image" : "Header document"}
      </p>
      <p className="mb-2 text-[11px] text-[#8696a0]">
        This template requires {kind === "image" ? "an image" : "a document"}.
        The same file is sent to every recipient.
      </p>
      <FileUploadField
        value={value}
        onChange={onChange}
        accept={ACCEPT[kind]}
        folder="Home"
      />
    </div>
  );
};

export default TemplateAttachment;
