import { useFrappeFileUpload } from "frappe-react-sdk";
import { AlertCircle, CloudUpload, FileIcon, X } from "lucide-react";
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
  onChange: (fileUrl: string | null, fileData?: any) => void;
  disabled?: boolean;
  doctype?: string;
  docname?: string;
  fieldname?: string;
  folder?: string;
  isPrivate?: boolean;
  accept?: string;
}

type UploadState = "idle" | "uploading" | "error";
const DEFAULT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.mp4,.mp3,.doc,.docx,.xls,.xlsx";

function parseFrappeError(err: any): string {
  try {
    const msgs = JSON.parse(err._server_messages);
    const parsed = JSON.parse(msgs[0]);
    return parsed.message || "Upload failed.";
  } catch {
    return err?.message || err?.exception || "Upload failed.";
  }
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
    },
    ref,
  ) => {
    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);
    const { upload, progress, reset } = useFrappeFileUpload();

    const isValidFile = (file: File) => {
      const allowed = accept.split(",").map((x) => x.trim().toLowerCase());
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
      return allowed.includes(ext);
    };

    const upload_file = async (file: File) => {
      if (!isValidFile(file)) {
        setErrorMessage(`Invalid file type. Allowed: ${accept}`);
        setUploadState("error");
        return;
      }
      setErrorMessage("");
      setUploadState("uploading");
      reset();
      try {
        const hasDocname = typeof docname === "string" && docname.trim() !== "";
        const fileArgs: Record<string, any> = { isPrivate, folder };
        if (doctype && hasDocname) {
          fileArgs.doctype = doctype;
          fileArgs.docname = docname!.trim();
        }
        if (fieldname) fileArgs.fieldname = fieldname;

        const res = await upload(file, fileArgs);
        if (res?.file_url) {
          setUploadState("idle");
          onChange(res.file_url, res);
        } else {
          setErrorMessage("Upload succeeded but no file URL was returned.");
          setUploadState("error");
        }
      } catch (e: any) {
        setErrorMessage(parseFrappeError(e));
        setUploadState("error");
      }
    };

    useImperativeHandle(ref, () => ({
      openSelector: () => {
        inputRef.current?.click();
      },
      uploadDirectFile: async (file: File) => {
        await upload_file(file);
      },
    }));

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await upload_file(file);
      if (inputRef.current) inputRef.current.value = "";
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

    const isImage = (url: string) => {
      return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url);
    };

    const isPdf = (url: string) => {
      return /\.pdf$/i.test(url);
    };

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
                      <svg
                        className="absolute inset-0 h-20 w-20 -rotate-90"
                        viewBox="0 0 80 80"
                      >
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="text-[#2a3942]"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          className="text-[#25D366] transition-all duration-300"
                          strokeDasharray={`${2 * Math.PI * 36}`}
                          strokeDashoffset={`${2 * Math.PI * 36 * (1 - (progress ?? 0) / 100)}`}
                        />
                      </svg>
                      <CloudUpload className="h-8 w-8 text-[#25D366]" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-white">
                        Uploading File
                      </h3>
                      <p className="text-sm text-[#8696a0] mt-1">
                        {progress != null
                          ? `${Math.round(progress)}% completed`
                          : "Please wait..."}
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
                      <h3 className="text-lg font-bold text-white">
                        Upload Failed
                      </h3>
                      <p className="mt-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-left">
                        {errorMessage}
                      </p>
                    </div>
                    <div className="flex w-full gap-2">
                      <button
                        onClick={dismissModal}
                        className="flex-1 py-2.5 bg-[#2a3942] hover:bg-[#3b4a54] text-white rounded-xl font-medium transition"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => {
                          dismissModal();
                          setTimeout(() => inputRef.current?.click(), 100);
                        }}
                        className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#20b859] text-white rounded-xl font-medium transition"
                      >
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
            {isImage(value) ? (
              <div className="relative w-full rounded-lg overflow-hidden bg-[#111b21] flex items-center justify-center max-h-60 border border-[#2a3942]">
                <img
                  src={value}
                  alt="Preview"
                  className="w-full h-full object-contain max-h-60"
                />
              </div>
            ) : isPdf(value) ? (
              <div className="relative w-full max-h-60 rounded-lg overflow-hidden bg-[#111b21] border border-[#2a3942] flex items-center justify-center p-2 select-none">
                <Document
                  file={value}
                  loading={
                    <div className="text-xs text-[#8696a0] py-8 animate-pulse">
                      Loading preview...
                    </div>
                  }
                  error={
                    <div className="text-xs text-red-400 py-8 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Preview unavailable
                    </div>
                  }
                >
                  <Page
                    pageNumber={1}
                    height={200}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="max-w-full rounded shadow-md"
                  />
                </Document>
              </div>
            ) : null}

            <div className="flex items-center justify-between bg-[#202c33] p-2.5 rounded-lg border border-[#2a3942]">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/10">
                  <FileIcon className="h-4 w-4 text-[#25D366]" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium text-white">
                    {value.split("/").pop()}
                  </span>
                  <span className="text-[10px] font-medium uppercase text-[#25D366] tracking-wider">
                    Ready to send
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="h-8 px-3 text-xs font-semibold text-[#25D366] hover:bg-[#2a3942] rounded-lg transition"
                >
                  Replace
                </button>
                <button
                  onClick={clearFile}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8696a0] hover:bg-red-500/20 hover:text-red-500 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
        {UploadModal}
      </div>
    );
  },
);

FileUploadField.displayName = "FileUploadField";
