import { Search } from "lucide-react";
import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search or start new chat",
}) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 bg-[#2a3942] rounded-lg text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
      />
    </div>
  );
};
