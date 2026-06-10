import { ExternalLink, MapPin } from "lucide-react";
import React from "react";

interface LocationMessageProps {
  location: {
    latitude: number;
    longitude: number;
    name?: string;
  };
}

export const LocationMessage: React.FC<LocationMessageProps> = ({
  location,
}) => {
  const mapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start space-x-3 p-2 bg-black bg-opacity-20 rounded-lg hover:bg-opacity-30 transition group"
    >
      <MapPin className="w-5 h-5 text-[#25D366] mt-0.5" />
      <div className="flex-1 min-w-0">
        {location.name && (
          <div className="text-sm font-medium text-white">{location.name}</div>
        )}
        <div className="text-xs text-[#8696a0] flex items-center gap-1">
          View on map <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </a>
  );
};
