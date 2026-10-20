import React from "react";

interface AvatarProps {
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
  src?: string;
  color?: string;
}

const sizeClasses = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
  xl: "w-14 h-14 text-xl",
};

export const Avatar: React.FC<AvatarProps> = ({
  name = "",
  size = "md",
  online,
  src,
  color = "#25D366",
}) => {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const displayName = name || "Avatar";

  return (
    <div className="relative">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white`}
        style={{ backgroundColor: src ? "transparent" : color }}
      >
        {src ? (
          <img
            src={src}
            alt={displayName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials || "?"
        )}
      </div>
      {online && (
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#25D366] rounded-full border-2 border-[#202c33]" />
      )}
    </div>
  );
};
