import { ExternalLink, MapPin } from "lucide-react";
import React from "react";

interface LocationData {
  latitude?: number | string | null;
  longitude?: number | string | null;
  name?: string | null;
  address?: string | null;
}

interface LocationMessageProps {
  location?: LocationData | null;
}

/** Convert a coordinate to a finite number, or `null` when unusable. */
const toCoordinate = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const LocationMessage: React.FC<LocationMessageProps> = ({
  location,
}) => {
  const latitude = toCoordinate(location?.latitude);
  const longitude = toCoordinate(location?.longitude);
  const label = location?.name || location?.address || "Shared location";
  const canOpenMap = latitude !== null && longitude !== null;

  const content = (
    <>
      <MapPin className="w-5 h-5 text-[#25D366] mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white break-words">
          {label}
        </div>
        {location?.address && location.address !== label && (
          <div className="text-xs text-[#8696a0] break-words">
            {location.address}
          </div>
        )}
        <div className="text-xs text-[#8696a0] flex items-center gap-1">
          {canOpenMap ? (
            <>
              View on map <ExternalLink className="w-3 h-3" />
            </>
          ) : (
            "Location details unavailable"
          )}
        </div>
      </div>
    </>
  );

  const className =
    "flex items-start space-x-3 p-2 bg-black bg-opacity-20 rounded-lg transition";

  if (!canOpenMap) {
    return <div className={className}>{content}</div>;
  }

  return (
    <a
      href={`https://maps.google.com/?q=${latitude},${longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} hover:bg-opacity-30 group`}
    >
      {content}
    </a>
  );
};

