/**
 * Recipient picker used by the recipient-list editor.
 *
 * Sources: manual entry, existing chats, saved WhatsApp contacts and standard
 * Frappe Contacts. Contact sources are paginated, exclude numbers already in
 * the list, and support multi-select (including selecting every shown row).
 */

import { useFrappeGetCall } from "frappe-react-sdk";
import { Loader2, Plus, Search } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  normalizeMobile,
  parseManualRecipients,
} from "../../services/bulkMessaging";
import type {
  RecipientOption,
  RecipientOptionsResponse,
  RecipientRow,
} from "../../types/bulk";
import { RecipientOptionRow } from "./RecipientOptionRow";

type PickerTab = "manual" | "chats" | "contacts" | "frappe";

interface RecipientPickerProps {
  whatsappAccount: string;
  existing: RecipientRow[];
  onAdd: (recipients: RecipientRow[]) => void;
}

const TAB_LABELS: Record<PickerTab, string> = {
  manual: "Manual",
  chats: "From Chats",
  contacts: "WhatsApp Contacts",
  frappe: "Frappe Contacts",
};

/** Page-size progression applied by each "Load more" click. */
const LOAD_STEPS = [100, 500, 2000, 5000];
const INITIAL_LIMIT = LOAD_STEPS[0];
const MAX_LIMIT = LOAD_STEPS[LOAD_STEPS.length - 1];

const SEARCH_PLACEHOLDERS: Partial<Record<PickerTab, string>> = {
  contacts: "Search WhatsApp contacts by name or number",
  frappe: "Search Frappe contacts by name or number",
};

/** Stable selection key for a picker option. */
const optionKey = (option: RecipientOption) => normalizeMobile(option.mobile_no);

/** Convert a picker option to a recipient row. */
const toRecipientRow = (option: RecipientOption): RecipientRow => ({
  mobile_number: option.mobile_no,
  recipient_name: option.contact_name || undefined,
});

export const RecipientPicker: React.FC<RecipientPickerProps> = ({
  whatsappAccount,
  existing,
  onAdd,
}) => {
  const [tab, setTab] = useState<PickerTab>("manual");
  const [manualText, setManualText] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const [selected, setSelected] = useState<string[]>([]);

  const trimmedQuery = useDebouncedValue(contactQuery.trim(), 300);

  const existingMobiles = useMemo(
    () => new Set(existing.map((row) => normalizeMobile(row.mobile_number))),
    [existing],
  );

  const excludeNumbers = useMemo(
    () =>
      JSON.stringify(existing.map((row) => row.mobile_number).filter(Boolean)),
    [existing],
  );

  const searchable = tab === "contacts" || tab === "frappe";

  const { data, isLoading, isValidating } = useFrappeGetCall<{
    message: RecipientOptionsResponse;
  }>(
    "waba_suite.api.bulk_recipients.get_recipient_options",
    {
      source: tab,
      query: searchable ? trimmedQuery : "",
      exclude: excludeNumbers,
      limit,
      whatsapp_account: whatsappAccount,
    },
    tab === "manual" ? null : undefined,
  );

  const options = useMemo(
    () =>
      (data?.message?.items || []).filter(
        (option) => !existingMobiles.has(normalizeMobile(option.mobile_no)),
      ),
    [data, existingMobiles],
  );
  const hasMore = Boolean(data?.message?.has_more);

  const selectedKeys = useMemo(() => new Set(selected), [selected]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedKeys.has(optionKey(option))),
    [options, selectedKeys],
  );
  const allShownSelected =
    options.length > 0 && selectedOptions.length === options.length;

  const resetSelection = () => setSelected([]);

  const handleTabChange = (nextTab: PickerTab) => {
    setTab(nextTab);
    setLimit(INITIAL_LIMIT);
    resetSelection();
  };

  const handleQueryChange = (value: string) => {
    setContactQuery(value);
    setLimit(INITIAL_LIMIT);
    resetSelection();
  };

  const handleToggleOption = (option: RecipientOption) => {
    const key = optionKey(option);
    setSelected((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key],
    );
  };

  const handleToggleAll = () => {
    setSelected(allShownSelected ? [] : options.map(optionKey));
  };

  const handleManualAdd = () => {
    const parsed = parseManualRecipients(manualText);
    if (parsed.length === 0) return;
    onAdd(parsed);
    setManualText("");
  };

  const handleAddSelected = () => {
    if (selectedOptions.length === 0) return;
    onAdd(selectedOptions.map(toRecipientRow));
    resetSelection();
  };

  const handleLoadMore = () => {
    setLimit((current) => LOAD_STEPS.find((step) => step > current) ?? MAX_LIMIT);
  };

  const emptyLabel =
    tab === "chats"
      ? "No chat partners found for this account."
      : tab === "frappe"
        ? "No Frappe contacts with a phone number match your search."
        : "No WhatsApp contacts match your search.";


  const renderList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-6 text-[#8696a0]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      );
    }
    if (options.length === 0) {
      return (
        <p className="py-6 text-center text-xs text-[#8696a0]">{emptyLabel}</p>
      );
    }
    return (
      <div className="space-y-1">
        {options.map((option) => (
          <RecipientOptionRow
            key={`${option.name}-${option.mobile_no}`}
            option={option}
            selected={selectedKeys.has(optionKey(option))}
            onToggle={handleToggleOption}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-[#2a3942] bg-[#111b21]">
      <div className="flex border-b border-[#2a3942]">
        {(Object.keys(TAB_LABELS) as PickerTab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleTabChange(key)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition ${
              tab === key
                ? "border-b-2 border-[#25D366] text-[#25D366]"
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
              className="w-full resize-none rounded-lg border border-[#2a3942] bg-[#202c33] px-3 py-2 text-sm text-white placeholder:text-[#667781] focus:border-[#25D366] focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-[#8696a0]">
                One recipient per line. Optionally add a name after a comma.
              </p>
              <button
                type="button"
                onClick={handleManualAdd}
                disabled={!manualText.trim()}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-medium text-[#111b21] transition hover:bg-[#20b859] disabled:bg-[#2a3942] disabled:text-[#8696a0]"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>
        )}

        {tab !== "manual" && (
          <div className="space-y-2">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8696a0]" />
                <input
                  value={contactQuery}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  placeholder={SEARCH_PLACEHOLDERS[tab]}
                  className="w-full rounded-lg border border-[#2a3942] bg-[#202c33] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#667781] focus:border-[#25D366] focus:outline-none"
                />
              </div>
            )}
            {options.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#aebac1]">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    onChange={handleToggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-[#2a3942] bg-[#202c33] accent-[#25D366]"
                  />
                  Select all shown ({options.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selectedOptions.length === 0}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-medium text-[#111b21] transition hover:bg-[#20b859] disabled:bg-[#2a3942] disabled:text-[#8696a0]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add selected (
                  {selectedOptions.length})
                </button>
              </div>
            )}
            <div className="max-h-56 overflow-y-auto">{renderList()}</div>
            {hasMore && limit < MAX_LIMIT && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isValidating}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[#2a3942] px-3 py-2 text-xs font-medium text-[#aebac1] transition hover:bg-[#2a3942] disabled:opacity-60"
              >
                {isValidating && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Load more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipientPicker;
