import React from "react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  color?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  size = "md",
  color = "#25D366",
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} border-2 border-t-transparent rounded-full animate-spin`}
        style={{ borderColor: color, borderTopColor: "transparent" }}
      />
    </div>
  );
};
