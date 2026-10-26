/**
 * Renders the quick-reply / URL / phone buttons attached to a template message.
 */
import { ExternalLink, Phone } from "lucide-react";
import React from "react";
import type { TemplateButtonPayload } from "../../utils/templateMessage";
import { getTemplateButtonHref } from "../../utils/templateMessage";

interface TemplateButtonsProps {
  buttons: TemplateButtonPayload[];
}

export const TemplateButtons: React.FC<TemplateButtonsProps> = ({ buttons }) => {
  if (!buttons.length) return null;

  return (
    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
      {buttons.map((button, index) => {
        const label = button.button_label || "Button";
        const href = getTemplateButtonHref(button);
        const type = (button.button_type || "").toLowerCase();
        const isPhone = type === "call phone" || type === "phone_number";

        if (href) {
          return (
            <a
              key={`${label}-${index}`}
              href={href}
              target={isPhone ? undefined : "_blank"}
              rel={isPhone ? undefined : "noopener noreferrer"}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-black/15 px-3 py-2 text-sm font-medium text-[#53bdeb] transition hover:bg-black/25"
            >
              {isPhone ? <Phone className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
              <span className="truncate">{label}</span>
            </a>
          );
        }

        return (
          <button
            key={`${label}-${index}`}
            type="button"
            disabled
            className="flex w-full items-center justify-center rounded-md bg-black/15 px-3 py-2 text-sm font-medium text-[#53bdeb] opacity-70"
          >
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
};
