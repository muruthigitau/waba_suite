import { Download } from "lucide-react";
import React from "react";

interface DocumentMessageProps {
  fileUrl: string;
  fileName: string;
}

export const DocumentMessage: React.FC<DocumentMessageProps> = ({
  fileUrl,
  fileName,
}) => {
  const getFileIcon = () => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "📄";
      case "doc":
      case "docx":
        return "📘";
      case "xls":
      case "xlsx":
        return "📊";
      case "ppt":
      case "pptx":
        return "📽️";
      case "zip":
      case "rar":
        return "🗜️";
      default:
        return "📎";
    }
  };

  return (
    <a
      href={fileUrl}
      download
      className="flex items-center space-x-3 p-2 bg-black bg-opacity-20 rounded-lg hover:bg-opacity-30 transition group"
    >
      <span className="text-2xl">{getFileIcon()}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {fileName}
        </div>
        <div className="text-xs text-[#8696a0]">Click to download</div>
      </div>
      <Download className="w-4 h-4 text-[#aebac1] opacity-0 group-hover:opacity-100 transition" />
    </a>
  );
};
