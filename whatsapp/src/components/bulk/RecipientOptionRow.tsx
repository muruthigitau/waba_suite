/**
 * Single selectable row in the bulk recipient picker.
 *
 * The whole row is a label so clicking anywhere toggles the checkbox.
 */

import React from "react";
import type { RecipientOption } from "../../types/bulk";

interface RecipientOptionRowProps {
  option: RecipientOption;
  selected: boolean;
  onToggle: (option: RecipientOption) => void;
}

export const RecipientOptionRow: React.FC<RecipientOptionRowProps> = ({
  option,
  selected,
  onToggle,
}) => {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition ${
        selected ? "bg-[#2a3942]" : "hover:bg-[#2a3942]"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(option)}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#2a3942] bg-[#202c33] accent-[#25D366]"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">
          {option.contact_name || option.mobile_no}
        </p>
        <p className="truncate text-xs text-[#8696a0]">
          {option.mobile_no}
          {option.company_name ? ` - ${option.company_name}` : ""}
        </p>
      </div>
    </label>
  );
};

export default RecipientOptionRow;
