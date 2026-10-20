/**
 * Create/edit dialog for `WhatsApp Recipient List`.
 *
 * Loads the existing document (when editing) and delegates rendering to
 * `RecipientListForm`, which owns the editable state.
 */

import { useFrappeGetDoc } from "frappe-react-sdk";
import { Loader2 } from "lucide-react";
import React from "react";
import type { RecipientList } from "../../types/bulk";
import { RecipientListForm } from "./RecipientListForm";

interface RecipientListModalProps {
  onClose: () => void;
  listName?: string | null;
  whatsappAccount: string;
  onSaved?: () => void;
}

export const RecipientListModal: React.FC<RecipientListModalProps> = (
  props,
) => {
  const { listName, whatsappAccount, onClose } = props;
  const { data, isLoading, error } = useFrappeGetDoc<RecipientList>(
    "WhatsApp Recipient List",
    listName || undefined,
    undefined,
    { enabled: Boolean(listName) },
  );

  if (!listName) {
    return <RecipientListForm {...props} initial={null} />;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <Loader2 className="h-7 w-7 animate-spin text-[#25D366]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-xl bg-[#202c33] p-5 text-center shadow-2xl">
          <p className="text-sm text-red-400">
            {error?.message || "Could not load this recipient list."}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg bg-[#2a3942] px-4 py-2 text-sm text-white hover:bg-[#3b4a54]"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <RecipientListForm
      {...props}
      key={listName}
      listName={listName}
      whatsappAccount={whatsappAccount}
      initial={data}
    />
  );
};

export default RecipientListModal;
