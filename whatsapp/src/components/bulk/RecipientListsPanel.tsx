/**
 * Recipient list management panel for bulk campaigns.
 */

import { useFrappeDeleteDoc, useFrappeGetDocList } from "frappe-react-sdk";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import React, { useState } from "react";
import type { RecipientList } from "../../types/bulk";
import { RecipientListModal } from "./RecipientListModal";

interface RecipientListsPanelProps {
  whatsappAccount: string;
}

export const RecipientListsPanel: React.FC<RecipientListsPanelProps> = ({
  whatsappAccount,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [deletingList, setDeletingList] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: listError, mutate } = useFrappeGetDocList<
    RecipientList
  >("WhatsApp Recipient List", {
    fields: ["name", "list_name", "description", "modified"],
    limit: 100,
    orderBy: { field: "modified", order: "desc" },
  });

  const { deleteDoc } = useFrappeDeleteDoc();

  const lists = data || [];

  const openCreate = () => {
    setEditingList(null);
    setModalOpen(true);
  };

  const openEdit = (name: string) => {
    setEditingList(name);
    setModalOpen(true);
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete recipient list "${name}"?`)) return;

    setError(null);
    setDeletingList(name);
    try {
      await deleteDoc("WhatsApp Recipient List", name);
      await mutate();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the recipient list.",
      );
    } finally {
      setDeletingList(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Recipient Lists</h2>
          <p className="text-xs text-[#8696a0]">
            Build reusable lists from chats, saved contacts, or manual numbers.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-[#111b21] hover:bg-[#20b859]"
        >
          <Plus className="h-4 w-4" /> New List
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#8696a0]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : listError ? (
        <p className="rounded-lg border border-[#2a3942] p-6 text-center text-sm text-red-400">
          {listError.message || "Could not load recipient lists."}
        </p>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2a3942] py-16 text-center">
          <Users className="mb-3 h-10 w-10 text-[#8696a0]" />
          <p className="text-sm font-medium text-white">No recipient lists</p>
          <p className="mt-1 text-xs text-[#8696a0]">
            Create a list before sending a bulk campaign.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => (
            <div
              key={list.name}
              className="rounded-xl border border-[#2a3942] bg-[#202c33] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {list.list_name || list.name}
                  </p>
                  <p className="mt-1 line-clamp-2 min-h-8 text-xs text-[#8696a0]">
                    {list.description || "No description"}
                  </p>
                </div>
                <Users className="h-5 w-5 shrink-0 text-[#8696a0]" />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#8696a0]">
                  {list.modified
                    ? `Updated ${new Date(list.modified).toLocaleDateString()}`
                    : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(list.name)}
                    className="rounded-lg p-1.5 text-[#aebac1] hover:bg-[#2a3942] hover:text-white"
                    aria-label={`Edit ${list.list_name || list.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(list.name)}
                    disabled={deletingList === list.name}
                    className="rounded-lg p-1.5 text-[#aebac1] hover:bg-[#2a3942] hover:text-red-400 disabled:opacity-50"
                    aria-label={`Delete ${list.list_name || list.name}`}
                  >
                    {deletingList === list.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <RecipientListModal
          onClose={() => setModalOpen(false)}
          listName={editingList}
          whatsappAccount={whatsappAccount}
          onSaved={() => {
            void mutate();
          }}
        />
      )}
    </div>
  );
};

export default RecipientListsPanel;

