/**
 * Create-and-submit dialog for a `Bulk WhatsApp Message` campaign.
 *
 * Campaigns are template-only. Header, body and footer variable values and the
 * header attachment are stored on the campaign so every recipient receives the
 * same content.
 */

import {
  useFrappeCreateDoc,
  useFrappeDocTypeEventListener,
  useFrappeGetCall,
  useFrappeGetDocList,
  useFrappePostCall,
} from "frappe-react-sdk";
import { AlertTriangle, Loader2, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import {
  serializeTemplateVariables,
  templateAttachmentKind,
  templateVariableFields,
  templateVariableKey,
} from "../../services/bulkMessaging";
import type {
  BulkMessage,
  MessageTemplate,
  RecipientList,
} from "../../types/bulk";
import { TemplateAttachment } from "./TemplateAttachment";
import { TemplatePreview } from "./TemplatePreview";

interface CreateBulkMessageModalProps {
  onClose: () => void;
  whatsappAccount: string;
  onOpenRecipientLists: () => void;
  onCreated: (name: string, submitted: boolean) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Could not create the bulk campaign.";
}

export const CreateBulkMessageModal: React.FC<
  CreateBulkMessageModalProps
> = ({
  onClose,
  whatsappAccount,
  onOpenRecipientLists,
  onCreated,
}) => {
  const [title, setTitle] = useState(
    () => `Bulk message - ${new Date().toLocaleDateString()}`,
  );
  const [templateName, setTemplateName] = useState("");
  const [recipientList, setRecipientList] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );
  const [attachment, setAttachment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: templatesData, isLoading: templatesLoading } = useFrappeGetCall<{
    message: MessageTemplate[];
  }>(
    "waba_suite.api.templates.get_standalone_templates",
    { whatsapp_account: whatsappAccount },
  );

  const { data: listsData, isLoading: listsLoading, mutate: mutateLists } = useFrappeGetDocList<
    RecipientList
  >(
    "WhatsApp Recipient List",
    {
      fields: ["name", "list_name", "description"],
      limit: 100,
      orderBy: { field: "list_name", order: "asc" },
    },
  );

  useFrappeDocTypeEventListener("WhatsApp Recipient List", () => {
    void mutateLists();
  });

  const { createDoc } = useFrappeCreateDoc<BulkMessage>();
  const { call: submitDoc } = useFrappePostCall("frappe.client.submit");

  const templates = useMemo(() => templatesData?.message || [], [templatesData]);
  const lists = listsData || [];
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.name === templateName),
    [templates, templateName],
  );

  const handleTemplateChange = (value: string) => {
    setTemplateName(value);
    setVariableValues({});
    setAttachment("");
  };

  const templateFields = useMemo(
    () => templateVariableFields(selectedTemplate),
    [selectedTemplate],
  );
  const attachmentKind = templateAttachmentKind(selectedTemplate);

  const variablesFilled = templateFields.every(
    (field) => (variableValues[templateVariableKey(field)] || "").trim() !== "",
  );

  const canSubmit =
    Boolean(title.trim()) &&
    Boolean(whatsappAccount) &&
    Boolean(templateName) &&
    Boolean(recipientList) &&
    variablesFilled &&
    (!attachmentKind || Boolean(attachment)) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setError(null);
    setSubmitting(true);

    let created: BulkMessage;
    try {
      created = (await createDoc("Bulk WhatsApp Message", {
        title: title.trim(),
        whatsapp_account: whatsappAccount,
        recipient_type: "Recipient List",
        recipient_list: recipientList,
        use_template: 1,
        template: templateName,
        variable_type: "Common",
        template_variables: serializeTemplateVariables(
          selectedTemplate,
          variableValues,
        ),
        attach: attachment || undefined,
      })) as BulkMessage;
    } catch (createError) {
      setError(errorMessage(createError));
      setSubmitting(false);
      return;
    }

    try {
      await submitDoc({ doc: created });
      onCreated(created.name, true);
    } catch {
      onCreated(created.name, false);
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-[680px] max-w-full flex-col overflow-hidden rounded-xl bg-[#202c33] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#2a3942] p-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              New Bulk Campaign
            </h3>
            <p className="mt-0.5 text-xs text-[#8696a0]">
              Sends an approved template to every recipient in the selected
              list.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-[#2a3942]"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-[#aebac1]" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-[#aebac1]">
                Campaign Title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. October promotion"
                className="w-full rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-sm text-white placeholder:text-[#667781] focus:border-[#25D366] focus:outline-none"
              />
            </label>

            <div className="rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-[#8696a0]">
                Account
              </p>
              <p className="truncate text-sm text-white">{whatsappAccount}</p>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#aebac1]">
                Recipient List
              </span>
              <select
                value={recipientList}
                onChange={(event) => setRecipientList(event.target.value)}
                disabled={listsLoading}
                className="w-full rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-sm text-white focus:border-[#25D366] focus:outline-none disabled:opacity-60"
              >
                <option value="">
                  {listsLoading ? "Loading lists..." : "Select a list"}
                </option>
                {lists.map((list) => (
                  <option key={list.name} value={list.name}>
                    {list.list_name || list.name}
                  </option>
                ))}
              </select>
              {!listsLoading && lists.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenRecipientLists}
                  className="mt-1 text-xs text-[#25D366] hover:underline"
                >
                  Create a recipient list first
                </button>
              )}
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-[#aebac1]">
                Template
              </span>
              <select
                value={templateName}
                onChange={(event) => handleTemplateChange(event.target.value)}
                disabled={templatesLoading}
                className="w-full rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-sm text-white focus:border-[#25D366] focus:outline-none disabled:opacity-60"
              >
                <option value="">
                  {templatesLoading ? "Loading templates..." : "Select template"}
                </option>
                {templates.map((template) => (
                  <option key={template.name} value={template.name}>
                    {template.template_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedTemplate && (
            <TemplatePreview
              template={selectedTemplate}
              variableValues={variableValues}
              onVariableChange={(fieldKey, value) =>
                setVariableValues((current) => ({
                  ...current,
                  [fieldKey]: value,
                }))
              }
            />
          )}

          {selectedTemplate && (
            <TemplateAttachment
              kind={attachmentKind}
              value={attachment}
              onChange={(fileUrl) => setAttachment(fileUrl || "")}
            />
          )}

          <div className="flex items-start gap-2 rounded-lg bg-[#182229] p-3 text-[11px] text-[#8696a0]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p>
              Submitting queues one WhatsApp message per recipient. Messages are
              sent in the background and cannot be recalled.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#2a3942] p-4">
          <p className="min-w-0 flex-1 truncate text-xs text-red-400">{error}</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-[#aebac1] hover:bg-[#2a3942]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-[#111b21] hover:bg-[#20b859] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create &amp; Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateBulkMessageModal;

