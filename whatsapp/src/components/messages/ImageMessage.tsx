import { Download, X } from "lucide-react";
import React, { useState } from "react";

interface ImageMessageProps {
  src: string;
  caption?: string;
}

export const ImageMessage: React.FC<ImageMessageProps> = ({ src, caption }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      <div className="relative">
        <img
          src={src}
          alt="Shared image"
          className="max-w-[250px] max-h-[250px] rounded-lg cursor-pointer object-cover"
          onClick={() => setIsFullscreen(true)}
        />
        {caption && (
          <p className="text-sm mt-1 text-[#d1d7db] break-words whitespace-pre-wrap">
            {caption}
          </p>
        )}
      </div>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={src}
              alt="Fullscreen"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <a
              href={src}
              download
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 right-4 p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
            >
              <Download className="w-6 h-6 text-white" />
            </a>
          </div>
        </div>
      )}
    </>
  );
};
