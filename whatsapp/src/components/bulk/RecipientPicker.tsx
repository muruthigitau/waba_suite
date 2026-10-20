/**
 * Recipient picker used by the recipient-list editor.
 *
 * Supports manual entry, importing from existing chats, and searching saved
 * WhatsApp contacts. All sources produce `WhatsApp Recipient` rows.
 */

import { useFrappeGetCall } from "frappe-react-sdk";
import { Check, Loader2, Plus, Search } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  normalizeMobile,
  parseManualRecipients,
} from "../../services/bulkMessaging";
import type { RecipientRow, WhatsAppContact } from "../../types/bulk";

type PickerTab = "manual" | "chats" | "contacts";

interface RecipientPickerProps {
  whatsappAccount: string;
  existing: RecipientRow[];
  onAdd: (recipients: RecipientRow[]) => void;
}

const TAB_LABELS: Record<PickerTab, string> = {
  manual: "Manual",
  chats: "From Chats",
  contacts: "Saved Contacts",
};

export const RecipientPicker: React.FC<RecipientPickerProps> = ({
  whatsappAccount,
  existing,
  onAdd,
}) => {
  const [tab, setTab] = useState<PickerTab>("manual");
  const [manualText, setManualText] = useState("");
  const [contactQuery, setContactQuery] = useState("");

  const trimmedQuery = useDebouncedValue(contactQuery.trim(), 300);

  const existingMobiles = useMemo(
    () => new Set(existing.map((row) => normalizeMobile(row.mobile_number))),
    [existing],
  );

  const { data: chatsData, isLoading: chatsLoading } = useFrappeGetCall<{
    message: WhatsAppContact[];
  }>(
    "waba_suite.api.contacts.search",
    { query: "", whatsapp_account: whatsappAccount },
    tab === "chats" ? undefined : null,
  );

  const {
    data: contactsData,
    isLoading: contactsLoading,
    isValidating: contactsValidating,
  } = useFrappeGetCall<{
    message: WhatsAppContact[];
  }>(
    "waba_suite.api.contacts.search",
    { query: trimmedQuery, whatsapp_account: whatsappAccount },
    tab === "contacts" ? undefined : null,
  );

  const chats = chatsData?.message || [];
  const contacts = contactsData?.message || [];

  const handleManualAdd = () => {
    const parsed = parseManualRecipients(manualText);
    if (parsed.length === 0) return;
    onAdd(parsed);
    setManualText("");
  };

  const handleContactAdd = (contact: WhatsAppContact) => {
    onAdd([
      {
        mobile_number: contact.mobile_no,
        recipient_name: contact.contact_name || undefined,
      },
    ]);
  };

  const renderContactRow = (contact: WhatsAppContact) => {
    const added = existingMobiles.has(normalizeMobile(contact.mobile_no));
    return (
      <div
        key={contact.name}
        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-[#2a3942] transition"
      >
        <div className="min-w-0">
          <p className="text-sm text-white truncate">
            {contact.contact_name || contact.mobile_no}
          </p>
          <p className="text-xs text-[#8696a0] truncate">{contact.mobile_no}</p>
        </div>
        <button
          type="button"
          disabled={added}
          onClick={() => handleContactAdd(contact)}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-[#25D366] text-[#111b21] hover:bg-[#20b859] disabled:bg-[#2a3942] disabled:text-[#8696a0] transition"
        >
          {added ? (
            <>
              <Check className="w-3.5 h-3.5" /> Added
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> Add
            </>
          )}
        </button>
      </div>
    );
  };

  const renderList = (
    items: WhatsAppContact[],
    loading: boolean,
    emptyLabel: string,
  ) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-6 text-[#8696a0]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <p className="py-6 text-center text-xs text-[#8696a0]">{emptyLabel}</p>
      );
    }
    return <div className="space-y-1">{items.map(renderContactRow)}</div>;
  };

  return (
    <div className="rounded-lg border border-[#2a3942] bg-[#111b21]">
      <div className="flex border-b border-[#2a3942]">
        {(Object.keys(TAB_LABELS) as PickerTab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition ${
              tab === key
                ? "text-[#25D366] border-b-2 border-[#25D366]"
                : "text-[#8696a0] hover:text-white"
            }`}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="p-3">
        {tab === "manual" && (
          <div className="space-y-2">
            <textarea
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              rows={4}
              placeholder={
                "254712345678\n254798765432, Jane Doe\nJane Doe <254700000000>"
              }
              className="w-full resize-none rounded-lg bg-[#202c33] border border-[#2a3942] px-3 py-2 text-sm text-white placeholder:text-[#667781] focus:outline-none focus:border-[#25D366]"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-[#8696a0]">
                One recipient per line. Optionally add a name after a comma.
              </p>
              <button
                type="button"
                onClick={handleManualAdd}
                disabled={!manualText.trim()}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-[#25D366] text-[#111b21] hover:bg-[#20b859] disabled:bg-[#2a3942] disabled:text-[#8696a0] transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        )}

        {tab === "chats" && (
          <div className="max-h-56 overflow-y-auto">
            {renderList(
              chats,
              chatsLoading,
              "No chat partners found for this account.",
            )}
          </div>
        )}

        {tab === "contacts" && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
              <input
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
                placeholder="Search saved contacts by name or number"
                className="w-full rounded-lg bg-[#202c33] border border-[#2a3942] pl-9 pr-3 py-2 text-sm text-white placeholder:text-[#667781] focus:outline-none focus:border-[#25D366]"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {renderList(
                contacts,
                contactsLoading || contactsValidating,
                "No saved contacts found.",
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipientPicker;
