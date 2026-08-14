import { useFrappeFileUpload } from "frappe-react-sdk";
import {
  AlertCircle,
  CloudUpload,
  FileIcon,
  FileImage,
  FileMusic,
  X,
} from "lucide-react";
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FileUploadFieldProps {
  value?: string;
  onChange: (fileUrl: string | null, fileData?: Record<string, unknown>) => void;
  disabled?: boolean;
  doctype?: string;
  docname?: string;
  fieldname?: string;
  folder?: string;
  isPrivate?: boolean;
  accept?: string;
  isMobile?: boolean;
}

type UploadState = "idle" | "uploading" | "error";
const DEFAULT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.mp4,.mp3,.doc,.docx,.xls,.xlsx";

function parseFrappeError(err: Record<string, unknown>): string {
  try {
    const msgs = JSON.parse(err._server_messages as string);
    const parsed = JSON.parse(msgs[0]);
    return parsed.message || "Upload failed.";
  } catch {
    return (err?.message as string) || (err?.exception as string) || "Upload failed.";
  }
}

function isValidFileType(file: File, accept: string): boolean {
  const allowedExts = accept.split(",").map((x) => x.trim().toLowerCase());
  const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
  if (allowedExts.includes(ext)) return true;

  const mimeType = file.type.toLowerCase();
  if (!mimeType) return false;

  if (mimeType.startsWith("image/")) return true;
  if (mimeType.startsWith("video/")) return true;
  if (mimeType.startsWith("audio/")) return true;
  if (mimeType === "application/pdf") return true;
  if (mimeType.includes("document") || mimeType.includes("spreadsheet") || mimeType.includes("text/")) return true;

  return false;
}

export const FileUploadField = forwardRef<
  { openSelector: () => void; uploadDirectFile: (file: File) => Promise<void> },
  FileUploadFieldProps
>(
  (
    {
      value,
      onChange,
      disabled,
      doctype,
      docname,
      fieldname,
      folder = "Home",
      isPrivate = false,
      accept = DEFAULT_ACCEPT,
      isMobile = false,
    },
    ref,
  ) => {
    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [showMobilePicker, setShowMobilePicker] = useState(false);
    const mobileInputRef = useRef<HTMLInputElement>(null);
    const desktopInputRef = useRef<HTMLInputElement>(null);
    const { upload, progress, reset } = useFrappeFileUpload();

    const uploadFile = async (file: File) => {
      if (!isValidFileType(file, accept)) {
        setErrorMessage(`Invalid file type. Allowed: ${accept}`);
        setUploadState("error");
        return;
      }
      setErrorMessage("");
      setUploadState("uploading");
      reset();
      try {
        const hasDocname = typeof docname === "string" && docname.trim() !== "";
        const fileArgs: Record<string, unknown> = { isPrivate, folder };
        if (doctype && hasDocname) {
          fileArgs.doctype = doctype;
          fileArgs.docname = docname!.trim();
        }
        if (fieldname) fileArgs.fieldname = fieldname;

        const res = await upload(file, fileArgs) as { file_url?: string };
        if (res?.file_url) {
          setUploadState("idle");
          onChange(res.file_url, res);
        } else {
          setErrorMessage("Upload succeeded but no file URL was returned.");
          setUploadState("error");
        }
      } catch (e) {
        setErrorMessage(parseFrappeError(e as Record<string, unknown>));
        setUploadState("error");
      }
    };

    useImperativeHandle(ref, () => ({
      openSelector: () => {
        if (isMobile) {
          setShowMobilePicker(true);
        } else {
          desktopInputRef.current?.click();
        }
      },
      uploadDirectFile: async (file: File) => {
        await uploadFile(file);
      },
    }));

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await uploadFile(file);
      try { e.target.value = ''; } catch { /* ignore */ }
      setShowMobilePicker(false);
    };

    const triggerMobilePicker = (acceptType: string) => {
      setShowMobilePicker(false);
      setTimeout(() => {
        if (mobileInputRef.current) {
          mobileInputRef.current.accept = acceptType;
          mobileInputRef.current.click();
        }
      }, 100);
    };

    const clearFile = (e: React.MouseEvent) => {
      e.stopPropagation();
      setUploadState("idle");
      setErrorMessage("");
      reset();
      onChange(null);
    };

    const dismissModal = () => {
      if (uploadState === "error") setUploadState("idle");
    };

    const isImageFile = (url: string) => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url);
    const isPdfFile = (url: string) => /\.pdf$/i.test(url);

    const UploadModal =
      uploadState !== "idle"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={uploadState !== "uploading" ? dismissModal : undefined}
            >
              <div
                className="flex flex-col items-center gap-5 rounded-2xl bg-[#202c33] p-8 shadow-2xl max-w-sm w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                {uploadState === "uploading" && (
                  <>
                    <div className="relative flex h-20 w-20 items-center justify-center">
                      <svg className="absolute inset-0 h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className="text-[#2a3942]" />
                        <circle
                          cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4"
                          strokeLinecap="round" className="text-[#25D366] transition-all duration-300"
                          strokeDasharray={`${2 * Math.PI * 36}`}
                          strokeDashoffset={`${2 * Math.PI * 36 * (1 - (progress ?? 0) / 100)}`}
                        />
                      </svg>
                      <CloudUpload className="h-8 w-8 text-[#25D366]" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-white">Uploading File</h3>
                      <p className="text-sm text-[#8696a0] mt-1">
                        {progress != null ? `${Math.round(progress)}% completed` : "Please wait..."}
                      </p>
                    </div>
                  </>
                )}
                {uploadState === "error" && (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                      <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <div className="text-center w-full">
                      <h3 className="text-lg font-bold text-white">Upload Failed</h3>
                      <p className="mt-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-left">
                        {errorMessage}
                      </p>
                    </div>
                    <div className="flex w-full gap-2">
                      <button onClick={dismissModal} className="flex-1 py-2.5 bg-[#2a3942] hover:bg-[#3b4a54] text-white rounded-xl font-medium transition">
                        Dismiss
                      </button>
                      <button onClick={() => { dismissModal(); setTimeout(() => desktopInputRef.current?.click(), 100); }} className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#20b859] text-white rounded-xl font-medium transition">
                        Retry
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null;

    return (
      <div className="w-full">
        {value && (
          <div className="flex flex-col gap-3 rounded-xl bg-[#25D366]/5 border border-[#25D366]/10 p-3 relative group">
            {isImageFile(value) ? (
              <div className="relative w-full rounded-lg overflow-hidden bg-[#111b21] flex items-center justify-center max-h-60 border border-[#2a3942]">
                <img src={value} alt="Preview" className="w-full h-full object-contain max-h-60" />
              </div>
            ) : isPdfFile(value) ? (
              <div className="relative w-full max-h-60 rounded-lg overflow-hidden bg-[#111b21] border border-[#2a3942] flex items-center justify-center p-2 select-none">
                <Document
                  file={value}
                  loading={<div className="text-xs text-[#8696a0] py-8 animate-pulse">Loading preview...</div>}
                  error={<div className="text-xs text-red-400 py-8 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Preview unavailable</div>}
                >
                  <Page pageNumber={1} height={200} renderTextLayer={false} renderAnnotationLayer={false} className="max-w-full rounded shadow-md" />
                </Document>
              </div>
            ) : null}

            <div className="flex items-center justify-between bg-[#202c33] p-2.5 rounded-lg border border-[#2a3942]">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/10">
                  <FileIcon className="h-4 w-4 text-[#25D366]" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium text-white">{value.split("/").pop()}</span>
                  <span className="text-[10px] font-medium uppercase text-[#25D366] tracking-wider">Ready to send</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => desktopInputRef.current?.click()} className="h-8 px-3 text-xs font-semibold text-[#25D366] hover:bg-[#2a3942] rounded-lg transition">Replace</button>
                <button onClick={clearFile} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8696a0] hover:bg-red-500/20 hover:text-red-500 transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop file input */}
        <input ref={desktopInputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} disabled={disabled} />

        {/* Mobile file input — single input, accept dynamically set per button */}
        <input ref={mobileInputRef} type="file" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={handleFileChange} />

        {/* Mobile Picker - WhatsApp-style bottom action sheet */}
        {isMobile && showMobilePicker && (
          <div className="fixed inset-0 z-[200] flex items-end bg-black/60" onClick={() => setShowMobilePicker(false)}>
            <div className="w-full bg-[#202c33] rounded-t-2xl p-4 pb-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 bg-[#2a3942] rounded-full mx-auto mb-4" />
              <h3 className="text-white font-semibold text-sm mb-4 px-1">Send a file</h3>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  onClick={() => triggerMobilePicker("image/*,video/*")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#00a884]/10 hover:bg-[#00a884]/20 transition border border-[#00a884]/20"
                >
                  <div className="w-14 h-14 rounded-full bg-[#00a884] flex items-center justify-center">
                    <FileImage className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-[#d1d7db] font-medium">Photo & Video</span>
                </button>
                <button
                  onClick={() => triggerMobilePicker("audio/*")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#e5422e]/10 hover:bg-[#e5422e]/20 transition border border-[#e5422e]/20"
                >
                  <div className="w-14 h-14 rounded-full bg-[#e5422e] flex items-center justify-center">
                    <FileMusic className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-[#d1d7db] font-medium">Audio</span>
                </button>
              </div>

              <button
                onClick={() => triggerMobilePicker(".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*")}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#2a3942]/50 hover:bg-[#2a3942] transition mb-2"
              >
                <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center">
                  <FileIcon className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm text-white font-medium block">Document</span>
                  <span className="text-xs text-[#8696a0]">PDF, Word, Excel, Images</span>
                </div>
              </button>

              <button onClick={() => setShowMobilePicker(false)} className="w-full py-3 text-sm text-[#8696a0] font-medium">
                Cancel
              </button>
            </div>
          </div>
        )}

        {UploadModal}
      </div>
    );
  },
);

FileUploadField.displayName = "FileUploadField";