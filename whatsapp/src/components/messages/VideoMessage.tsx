import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import React, { useRef, useState } from "react";

interface VideoMessageProps {
  src: string;
  caption?: string;
}

export const VideoMessage: React.FC<VideoMessageProps> = ({ src, caption }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="relative group">
      <video
        ref={videoRef}
        src={src}
        className="max-w-[250px] max-h-[250px] rounded-lg"
        onClick={togglePlay}
        loop
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black bg-opacity-30 rounded-lg">
        <button
          onClick={togglePlay}
          className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-white" />
          ) : (
            <Play className="w-6 h-6 text-white" />
          )}
        </button>
        <button
          onClick={toggleMute}
          className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition ml-2"
        >
          {isMuted ? (
            <VolumeX className="w-6 h-6 text-white" />
          ) : (
            <Volume2 className="w-6 h-6 text-white" />
          )}
        </button>
      </div>
      {caption && (
        <p className="text-sm mt-1 text-[#d1d7db] break-words whitespace-pre-wrap">
          {caption}
        </p>
      )}
    </div>
  );
};
