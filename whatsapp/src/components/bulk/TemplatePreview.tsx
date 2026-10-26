/**
 * Template preview and common variable inputs for a bulk campaign.
 *
 * Bulk campaigns send one template to many recipients, so header, body and
 * footer variable values are shared across the whole recipient list.
 */

import React from "react";
import {
  templateVariableFields,
  templateVariableKey,
  type TemplateVariableSection,
} from "../../services/bulkMessaging";
import type { MessageTemplate } from "../../types/bulk";

interface TemplatePreviewProps {
  template: MessageTemplate;
  variableValues: Record<string, string>;
  onVariableChange: (fieldKey: string, value: string) => void;
}

const SECTION_LABELS: Record<TemplateVariableSection, string> = {
  header: "Header variables",
  body: "Body variables",
  footer: "Footer variables",
};

/** Render template text with filled placeholders for a live preview. */
function previewText(
  text: string,
  section: TemplateVariableSection,
  values: Record<string, string>,
): string {
  return (text || "").replace(/\{\{(\d+)\}\}/g, (match, variable: string) => {
    const value = values[templateVariableKey({ section, variable })];
    return value?.trim() ? value.trim() : match;
  });
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  variableValues,
  onVariableChange,
}) => {
  const fields = templateVariableFields(template);
  const sections = (["header", "body", "footer"] as const)
    .map((section) => ({
      section,
      fields: fields.filter((field) => field.section === section),
    }))
    .filter((group) => group.fields.length > 0);

  return (
    <>
      <div className="rounded-lg border border-[#2a3942] bg-[#111b21] p-3">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-[#8696a0]">
          Preview
        </p>
        {template.header && (
          <p className="whitespace-pre-wrap text-sm font-semibold text-white">
            {previewText(template.header, "header", variableValues)}
          </p>
        )}
        <p className="mt-1 whitespace-pre-wrap text-sm text-[#d1d7db]">
          {previewText(template.template, "body", variableValues)}
        </p>
        {template.footer && (
          <p className="mt-1 whitespace-pre-wrap text-xs text-[#8696a0]">
            {previewText(template.footer, "footer", variableValues)}
          </p>
        )}
      </div>

      {sections.length > 0 && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-[#aebac1]">
              Template Variables
            </p>
            <p className="text-[11px] text-[#8696a0]">
              The same values are used for every recipient.
            </p>
          </div>
          {sections.map(({ section, fields: sectionFields }) => (
            <div key={section} className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-[#8696a0]">
                {SECTION_LABELS[section]}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {sectionFields.map((field) => {
                  const fieldKey = templateVariableKey(field);
                  return (
                    <label key={fieldKey} className="block">
                      <span className="mb-1 block text-[11px] text-[#8696a0]">
                        {`{{${field.variable}}}`}
                      </span>
                      <input
                        value={variableValues[fieldKey] || ""}
                        onChange={(event) =>
                          onVariableChange(fieldKey, event.target.value)
                        }
                        placeholder={`Value for {{${field.variable}}}`}
                        className="w-full rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-sm text-white placeholder:text-[#667781] focus:border-[#25D366] focus:outline-none"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default TemplatePreview;

