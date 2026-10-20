/**
 * Editor form for `WhatsApp Recipient List`.
 *
 * Existing child rows keep their names so the Frappe update endpoint
 * reconciles them instead of recreating the whole table.
 */

import { useFrappeCreateDoc, useFrappeUpdateDoc } from "frappe-react-sdk";
import { Loader2, Trash2, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { mergeRecipients } from "../../services/bulkMessaging";
import type { RecipientList, RecipientRow } from "../../types/bulk";
import { RecipientPicker } from "./RecipientPicker";

export interface RecipientListFormProps {
  onClose: () => void;
  listName?: string | null;
  whatsappAccount: string;
  onSaved?: () => void;
  initial?: RecipientList | null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Could not save the recipient list.";
}

function toFormRows(list?: RecipientList | null): RecipientRow[] {
  return (list?.recipients || []).map((row) => ({
    name: row.name,
    mobile_number: row.mobile_number,
    recipient_name: row.recipient_name || undefined,
    recipient_data:
      typeof row.recipient_data === "string"
        ? row.recipient_data
        : JSON.stringify(row.recipient_data || {}),
  }));
}

export const RecipientListForm: React.FC<RecipientListFormProps> = ({
  onClose,
  listName,
  whatsappAccount,
  onSaved,
  initial,
}) => {
  const [name, setName] = useState(
    () => initial?.list_name || initial?.name || "",
  );
  const [description, setDescription] = useState(
    () => initial?.description || "",
  );
  const [recipients, setRecipients] = useState<RecipientRow[]>(() =>
    toFormRows(initial),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { createDoc } = useFrappeCreateDoc<RecipientList>();
  const { updateDoc } = useFrappeUpdateDoc<RecipientList>();

  const isEditing = Boolean(listName);

  const uniqueCount = useMemo(
    () => new Set(recipients.map((row) => row.mobile_number.trim())).size,
    [recipients],
  );

  const handleAdd = (rows: RecipientRow[]) => {
    setRecipients((current) => mergeRecipients(current, rows));
  };

  const handleRemove = (index: number) => {
    setRecipients((current) =>
      current.filter((_, rowIndex) => rowIndex !== index),
    );
  };

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError("List name is required.");
      return;
    }
    if (recipients.length === 0) {
      setError("Add at least one recipient.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        list_name: name.trim(),
        description: description.trim(),
        recipients: recipients.map((row) => ({
          name: row.name,
          mobile_number: row.mobile_number.trim(),
          recipient_name: row.recipient_name,
          recipient_data: row.recipient_data || "{}",
        })),
      };

      if (listName) {
        await updateDoc("WhatsApp Recipient List", listName, payload);
      } else {
        await createDoc("WhatsApp Recipient List", payload);
      }

      onSaved?.();
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-[620px] max-w-full flex-col overflow-hidden rounded-xl bg-[#202c33] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#2a3942] p-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isEditing ? "Edit Recipient List" : "New Recipient List"}
            </h3>
            <p className="mt-0.5 text-xs text-[#8696a0]">
              Recipient lists are shared across all WhatsApp accounts.
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
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#aebac1]">
                List Name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isEditing}
                placeholder="e.g. October customers"
                className="w-full rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-sm text-white placeholder:text-[#667781] focus:border-[#25D366] focus:outline-none disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#aebac1]">
                Description
              </span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional note"
                className="w-full rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-sm text-white placeholder:text-[#667781] focus:border-[#25D366] focus:outline-none"
              />
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-[#aebac1]">
                {recipients.length} recipient
                {recipients.length === 1 ? "" : "s"}
                {uniqueCount !== recipients.length
                  ? ` (${uniqueCount} unique)`
                  : ""}
              </p>
              {recipients.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRecipients([])}
                  className="text-xs text-[#8696a0] hover:text-red-400"
                >
                  Clear all
                </button>
              )}
            </div>
            {recipients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#2a3942] py-4 text-center text-xs text-[#8696a0]">
                No recipients yet.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#2a3942] bg-[#111b21] p-2">
                {recipients.map((row, index) => (
                  <div
                    key={`${row.name || row.mobile_number}-${index}`}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-[#2a3942]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">
                        {row.recipient_name || row.mobile_number}
                      </p>
                      {row.recipient_name && (
                        <p className="truncate text-xs text-[#8696a0]">
                          {row.mobile_number}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      className="shrink-0 rounded p-1 text-[#8696a0] hover:bg-[#3b4a54] hover:text-red-400"
                      aria-label="Remove recipient"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <RecipientPicker
            whatsappAccount={whatsappAccount}
            existing={recipients}
            onAdd={handleAdd}
          />
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
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-[#111b21] hover:bg-[#20b859] disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create List"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipientListForm;
