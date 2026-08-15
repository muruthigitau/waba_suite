import { Loader, Tag, X } from "lucide-react";
import React, { useState } from "react";
import type { ChatLabel } from "../../types";

interface LabelPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  labels: ChatLabel[];
  selectedLabelIds: string[];
  onSave: (labelIds: string[]) => void;
  isSaving?: boolean;
}

export const LabelPickerModal: React.FC<LabelPickerModalProps> = ({
  isOpen,
  onClose,
  title = "Add labels",
  labels,
  selectedLabelIds,
  onSave,
  isSaving = false,
}) => {
  // The parent keys this modal by the target chat id, so the component
  // re-mounts fresh every time a different chat is opened — ensuring the
  // selection is cleared (no stale selections retained between chats).
  const [selected, setSelected] = useState<string[]>(selectedLabelIds);

  const toggleLabel = (labelId: string) => {
    setSelected((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-[#202c33] rounded-lg shadow-xl w-[420px] max-w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#2a3942] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="w-5 h-5 text-[#25D366] shrink-0" />
            <h3 className="text-lg font-semibold text-white truncate">
              {title}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2a3942] rounded shrink-0">
            <X className="w-5 h-5 text-[#aebac1]" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {labels.length === 0 ? (
            <div className="text-center py-8 text-[#8696a0]">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No labels available.</p>
              <p className="text-xs mt-1">
                Create labels in WhatsApp Chat Label
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {labels.map((label) => {
                const isChecked = selected.includes(label.name);
                return (
                  <button
                    key={label.name}
                    onClick={() => toggleLabel(label.name)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition text-left ${
                      isChecked
                        ? "border-[#25D366] bg-[#2a3942]"
                        : "border-transparent bg-[#182229] hover:bg-[#2a3942]/60"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-[#182229]"
                      style={{ backgroundColor: label.color || "#8696a0" }}
                    />
                    <span className="flex-1 text-sm text-white font-medium">
                      {label.label_name}
                    </span>
                    {isChecked && (
                      <span className="w-6 h-6 rounded-full bg-[#25D366] text-white flex items-center justify-center text-sm shrink-0">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
              {/* "No label" option — clears selection to remove all labels */}
              <button
                onClick={() => setSelected([])}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition text-left ${
                  selected.length === 0
                    ? "border-[#ffc107] bg-[#2a3942]"
                    : "border-transparent bg-[#182229] hover:bg-[#2a3942]/60"
                }`}
              >
                <span className="w-5 h-5 rounded-full flex-shrink-0 bg-[#8696a0] ring-2 ring-[#182229]" />
                <span className="flex-1 text-sm text-[#d1d7db] font-medium">
                  No label
                </span>
                {selected.length === 0 && (
                  <span className="w-6 h-6 rounded-full bg-[#ffc107] text-[#111b21] flex items-center justify-center text-sm shrink-0">
                    ✓
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#2a3942] flex justify-end space-x-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#aebac1] hover:bg-[#2a3942] rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(selected)}
            disabled={isSaving || labels.length === 0}
            className="px-4 py-2 text-sm bg-[#25D366] text-white rounded-lg hover:bg-[#20b859] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSaving && <Loader size="sm" color="white" />}
            <span>Save Labels</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LabelPickerModal;