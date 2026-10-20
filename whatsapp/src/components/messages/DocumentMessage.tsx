import { Download, FileIcon } from "lucide-react";
import React from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentMessageProps {
  fileUrl: string;
  fileName: string;
  caption?: string;
}

export const DocumentMessage: React.FC<DocumentMessageProps> = ({
  fileUrl,
  fileName,
  caption,
}) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const isPdf = ext === "pdf";
  const isImage = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "bmp",
    "svg",
    "avif",
    "heic",
    "heif",
  ].includes(ext || "");

  const getFileIconColor = () => {
    switch (ext) {
      case "doc":
      case "docx":
        return "text-blue-500 bg-blue-500/10";
      case "xls":
      case "xlsx":
        return "text-green-500 bg-green-500/10";
      case "ppt":
      case "pptx":
        return "text-orange-500 bg-orange-500/10";
      case "zip":
      case "rar":
        return "text-purple-500 bg-purple-500/10";
      default:
        return "text-[#25D366] bg-[#25D366]/10";
    }
  };

  return (
    <div className="flex flex-col gap-2 max-w-sm w-full">
      {isImage && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative w-full max-h-64 rounded-lg overflow-hidden bg-[#111b21] border border-[#2a3942] flex items-center justify-center p-1 select-none hover:opacity-90 transition group"
        >
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-64 object-contain rounded shadow-sm"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <span className="text-xs bg-[#202c33] text-white px-3 py-1.5 rounded-full border border-[#2a3942] shadow-md font-medium">
              Open Image
            </span>
          </div>
        </a>
      )}

      {isPdf && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative w-full max-h-48 rounded-lg overflow-hidden bg-[#111b21] border border-[#2a3942] flex items-center justify-center p-1 select-none hover:opacity-90 transition group"
        >
          <Document
            file={fileUrl}
            loading={
              <div className="text-xs text-[#8696a0] py-12 animate-pulse">
                Loading preview...
              </div>
            }
            error={
              <div className="text-xs text-red-400 py-12 flex items-center gap-2">
                Preview unavailable
              </div>
            }
          >
            <Page
              pageNumber={1}
              height={180}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="max-w-full rounded shadow-sm"
            />
          </Document>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <span className="text-xs bg-[#202c33] text-white px-3 py-1.5 rounded-full border border-[#2a3942] shadow-md font-medium">
              Open Document
            </span>
          </div>
        </a>
      )}

      <a
        href={fileUrl}
        download={fileName}
        className="flex items-center justify-between bg-black/20 p-2.5 rounded-lg border border-[#2a3942]/40 hover:bg-black/30 transition group"
      >
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${getFileIconColor()}`}
          >
            <FileIcon className="h-4 w-4" />
          </div>
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <span className="truncate text-sm font-medium text-white">
              {fileName}
            </span>
            <span className="text-[10px] text-[#8696a0] font-medium tracking-wider">
              Click to download
            </span>
          </div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#aebac1] opacity-60 group-hover:opacity-100 hover:bg-[#2a3942] transition shrink-0 ml-2">
          <Download className="h-4 w-4" />
        </button>
      </a>

      {caption && (
        <p className="text-sm mt-1 text-[#d1d7db] break-words whitespace-pre-wrap">
          {caption}
        </p>
      )}
    </div>
  );
};
