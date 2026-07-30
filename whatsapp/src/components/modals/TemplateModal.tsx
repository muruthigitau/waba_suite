import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { AlertTriangle, FileText, Loader2, Send, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import type { Chat } from "../../types";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
  currentAccount: string;
  onSent?: () => void;
}

interface Template {
  name: string;
  template_name: string;
  header: string;
  footer: string;
  template: string;
  variables: number[]; // e.g. [1, 2, 3]
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  chat,
  currentAccount,
  onSent,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  // Keys: "header_1", "body_1", "footer_1" — each section has independent {{1}}, {{2}} etc
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const { data: templatesData, isLoading } = useFrappeGetCall<{
    message: Template[];
  }>(
    "waba_suite.api.templates.get_standalone_templates",
    { whatsapp_account: currentAccount },
    isOpen ? undefined : { enabled: false },
  );

  const { call: sendTemplateCall } = useFrappePostCall(
    "waba_suite.api.templates.send_template",
  );

  const templates = useMemo(() => {
    return templatesData?.message || [];
  }, [templatesData]);

  const handleSelectTemplate = (tpl: Template) => {
    setSelectedTemplate(tpl);
    // Initialize variables with section prefix: header_1, body_1, footer_1 etc
    const initial: Record<string, string> = {};
    ["header", "body", "footer"].forEach((section) => {
      const text = section === "header" ? tpl.header : section === "body" ? tpl.template : tpl.footer;
      if (text) {
        const regex = /\{\{(\d+)\}\}/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          initial[`${section}_${match[1]}`] = "";
        }
      }
    });
    setVarValues(initial);
  };

  // Replace {{N}} with values in a text string for a specific section
  const fillSectionVariables = (text: string, section: string) => {
    if (!text) return text;
    let result = text;
    const regex = /\{\{(\d+)\}\}/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const key = `${section}_${match[1]}`;
      const val = varValues[key];
      if (val) {
        result = result.replace(match[0], val);
      }
    }
    return result;
  };

  // Check for unfilled variables across all sections
  const hasUnfilledVars = useMemo(() => {
    if (!selectedTemplate) return false;
    return Object.values(varValues).some((v) => !v?.trim());
  }, [selectedTemplate, varValues]);

  // Get variables for a specific section with section prefix
  const getVarsForSection = (text: string, section: string) => {
    if (!text) return [];
    const regex = /\{\{(\d+)\}\}/g;
    const vars: { num: number; key: string }[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      const num = parseInt(match[1]);
      const key = `${section}_${num}`;
      if (!vars.find((v) => v.num === num)) vars.push({ num, key });
    }
    return vars;
  };

  const handleSend = async () => {
    if (!chat || !selectedTemplate || hasUnfilledVars) return;

    setSending(true);
    try {
      // Fill each section independently with its own variables
      const filledBody = fillSectionVariables(selectedTemplate.template, "body");
      const filledHeader = fillSectionVariables(selectedTemplate.header, "header") || "";
      const filledFooter = fillSectionVariables(selectedTemplate.footer, "footer") || "";

      await sendTemplateCall({
        header: filledHeader,
        body: filledBody,
        footer: filledFooter,
        template_name: selectedTemplate.name,
        template_raw: selectedTemplate.template,
        template_header_raw: selectedTemplate.header || "",
        template_footer_raw: selectedTemplate.footer || "",
        user: chat.name,
        room: chat.id,
        user_no: chat.mobileNo,
        whatsapp_account: chat.whatsappAccount || currentAccount,
      });

      setSelectedTemplate(null);
      setVarValues({});
      onSent?.();
      onClose();
    } catch (error) {
      console.error("Failed to send template:", error);
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setVarValues({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[85vh] bg-[#202c33] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3942] shrink-0">
          <div className="flex items-center gap-2">
            {selectedTemplate && (
              <button onClick={handleBack} className="p-1 hover:bg-[#2a3942] rounded-full transition">
                <X className="w-4 h-4 text-[#aebac1]" />
              </button>
            )}
            <FileText className="w-5 h-5 text-[#25D366]" />
            <h3 className="text-white font-semibold text-sm">
              {selectedTemplate ? "Template Variables" : "Send Template"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2a3942] rounded-full transition">
            <X className="w-5 h-5 text-[#aebac1]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-[#8696a0] mx-auto mb-2" />
              <p className="text-[#8696a0] text-sm">No standalone templates available</p>
            </div>
          ) : selectedTemplate ? (
            <div className="space-y-5">
              {/* Template name */}
              <div className="bg-[#111b21] rounded-lg px-3 py-2 border border-[#2a3942]">
                <span className="text-xs text-[#25D366] font-medium">{selectedTemplate.template_name}</span>
              </div>

              {/* Live Preview */}
              <div>
                <label className="block text-xs text-[#aebac1] mb-1.5 font-medium">Preview</label>
                <div className="bg-[#111b21] rounded-lg p-3 border border-[#2a3942] min-h-[80px]">
                  {selectedTemplate.header && (
                    <div className="text-sm text-white font-medium mb-1">
                      {fillSectionVariables(selectedTemplate.header, "header")}
                    </div>
                  )}
                  <div className="text-sm text-[#d1d7db] whitespace-pre-wrap">
                    {fillSectionVariables(selectedTemplate.template, "body")}
                  </div>
                  {selectedTemplate.footer && (
                    <div className="text-[11px] text-[#8696a0] mt-2 pt-2 border-t border-[#2a3942]">
                      {fillSectionVariables(selectedTemplate.footer, "footer")}
                    </div>
                  )}
                </div>
              </div>

              {/* Header Variables */}
              {selectedTemplate.header && getVarsForSection(selectedTemplate.header, "header").length > 0 && (
                <SectionVars
                  sectionLabel="Header Variables"
                  vars={getVarsForSection(selectedTemplate.header, "header")}
                  varValues={varValues}
                  onChange={setVarValues}
                />
              )}

              {/* Body Variables */}
              {selectedTemplate.template && getVarsForSection(selectedTemplate.template, "body").length > 0 && (
                <SectionVars
                  sectionLabel="Body Variables"
                  vars={getVarsForSection(selectedTemplate.template, "body")}
                  varValues={varValues}
                  onChange={setVarValues}
                />
              )}

              {/* Footer Variables */}
              {selectedTemplate.footer && getVarsForSection(selectedTemplate.footer, "footer").length > 0 && (
                <SectionVars
                  sectionLabel="Footer Variables"
                  vars={getVarsForSection(selectedTemplate.footer, "footer")}
                  varValues={varValues}
                  onChange={setVarValues}
                />
              )}

              {/* No variables message */}
              {!selectedTemplate.header && !selectedTemplate.template && !selectedTemplate.footer && (
                <p className="text-xs text-[#8696a0] text-center py-4">
                  This template has no content sections.
                </p>
              )}

              {selectedTemplate.variables.length === 0 && (
                <div className="bg-[#182229] rounded-lg p-3 border border-[#2a3942]">
                  <p className="text-xs text-[#8696a0] text-center">
                    This template has no variables. It will be sent as-is.
                  </p>
                </div>
              )}

              {/* Unfilled variables warning */}
              {hasUnfilledVars && (
                <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-400">
                    Please fill in all variable values before sending.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-[#8696a0] mb-3">
                Select a template to fill its variables:
              </p>
              {templates.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => handleSelectTemplate(tpl)}
                  className="w-full text-left p-3 rounded-lg bg-[#111b21] hover:bg-[#2a3942] transition border border-[#2a3942]"
                >
                  <div className="text-sm text-white font-medium mb-0.5">
                    {tpl.template_name}
                  </div>
                  <div className="text-[11px] text-[#8696a0] line-clamp-2">
                    {tpl.header && <span>{tpl.header} — </span>}
                    {(tpl.template || "").substring(0, 80)}
                    {(tpl.template || "").length > 80 ? "..." : ""}
                  </div>
                  {tpl.variables.length > 0 && (
                    <div className="text-[10px] text-[#ffc107] mt-1">
                      {tpl.variables.length} variable{tpl.variables.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#2a3942] p-3 shrink-0">
          {selectedTemplate ? (
            <div className="flex gap-2">
              <button
                onClick={handleBack}
                className="flex-1 py-2.5 text-sm text-[#aebac1] bg-[#2a3942] hover:bg-[#3b4a54] rounded-lg transition"
              >
                Back
              </button>
              <button
                onClick={handleSend}
                disabled={sending || hasUnfilledVars}
                className="flex-1 py-2.5 text-sm text-white bg-[#25D366] hover:bg-[#20b859] rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Template
              </button>
            </div>
          ) : (
            <button onClick={onClose} className="w-full py-2.5 text-sm text-[#8696a0] hover:text-white transition">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-component for rendering variable inputs for a section
interface SectionVar {
  num: number;
  key: string; // "header_1", "body_2", etc
}

interface SectionVarsProps {
  sectionLabel: string;
  vars: SectionVar[];
  varValues: Record<string, string>;
  onChange: (vals: Record<string, string>) => void;
}

const SectionVars: React.FC<SectionVarsProps> = ({ sectionLabel, vars, varValues, onChange }) => (
  <div>
    <label className="block text-xs text-[#aebac1] mb-1.5 font-medium">{sectionLabel}</label>
    <div className="space-y-2">
      {vars.map((v) => (
        <div key={v.key} className="flex items-center gap-2">
          <span className="text-[10px] text-[#25D366] font-mono w-8 shrink-0">
            {`{{${v.num}}}`}
          </span>
          <input
            type="text"
            value={varValues[v.key] || ""}
            onChange={(e) => onChange({ ...varValues, [v.key]: e.target.value })}
            placeholder={`Value for variable ${v.num} in ${sectionLabel}`}
            className="flex-1 px-3 py-2 bg-[#2a3942] rounded-lg text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
          />
        </div>
      ))}
    </div>
  </div>
);
