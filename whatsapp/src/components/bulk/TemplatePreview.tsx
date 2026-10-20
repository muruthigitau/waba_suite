/**
 * Template preview and common body-variable inputs for a bulk campaign.
 *
 * Bulk campaigns send one template to many recipients, so variable values are
 * shared across the whole recipient list.
 */

import React from "react";
import type { MessageTemplate } from "../../types/bulk";

interface TemplatePreviewProps {
  template: MessageTemplate;
  variableValues: Record<string, string>;
  onVariableChange: (variable: string, value: string) => void;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  variableValues,
  onVariableChange,
}) => (
  <>
    <div className="rounded-lg border border-[#2a3942] bg-[#111b21] p-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-[#8696a0]">
        Preview
      </p>
      {template.header && (
        <p className="whitespace-pre-wrap text-sm font-semibold text-white">
          {template.header}
        </p>
      )}
      <p className="mt-1 whitespace-pre-wrap text-sm text-[#d1d7db]">
        {template.template}
      </p>
      {template.footer && (
        <p className="mt-1 whitespace-pre-wrap text-xs text-[#8696a0]">
          {template.footer}
        </p>
      )}
    </div>

    {template.body_vars.length > 0 && (
      <div className="space-y-2">
        <div>
          <p className="text-xs font-medium text-[#aebac1]">Template Variables</p>
          <p className="text-[11px] text-[#8696a0]">
            The same values are used for every recipient.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {template.body_vars.map((variable) => (
            <label key={variable} className="block">
              <span className="mb-1 block text-[11px] text-[#8696a0]">
                {`{{${variable}}}`}
              </span>
              <input
                value={variableValues[variable] || ""}
                onChange={(event) =>
                  onVariableChange(variable, event.target.value)
                }
                placeholder={`Value for {{${variable}}}`}
                className="w-full rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-sm text-white placeholder:text-[#667781] focus:border-[#25D366] focus:outline-none"
              />
            </label>
          ))}
        </div>
      </div>
    )}
  </>
);

export default TemplatePreview;
