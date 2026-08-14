import { Cloud, RefreshCw, WifiOff } from "lucide-react";
import React from "react";
import { useCache } from "../../contexts/CacheContext";
import { usePWA } from "../../hooks/usePWA";

export const SyncStatusBar: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, lastSync, triggerSync } =
    useCache();
  const { canUpdate, updateApp } = usePWA();

  if (
    isOnline &&
    !canUpdate &&
    pendingCount === 0 &&
    !isSyncing
  ) {
    return null;
  }

  return (
    <div className="flex-shrink-0">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="flex items-center justify-center px-4 py-2 bg-[#182229] border-b border-[#2a3942] gap-2">
          <WifiOff className="w-4 h-4 text-[#8696a0]" />
          <span className="text-xs text-[#8696a0] font-medium">
            You are offline. Messages will be sent when you reconnect.
          </span>
        </div>
      )}

      {/* Syncing Indicator */}
      {isSyncing && (
        <div className="flex items-center justify-center px-4 py-1.5 bg-[#182229] border-b border-[#2a3942] gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-[#25D366] animate-spin" />
          <span className="text-xs text-[#8696a0]">Syncing messages...</span>
        </div>
      )}

      {/* Pending Messages */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#1f2d33] border-b border-[#2a3942]">
          <div className="flex items-center gap-2">
            <Cloud className="w-3.5 h-3.5 text-[#ffc107]" />
            <span className="text-xs text-[#8696a0]">
              {pendingCount} message{pendingCount !== 1 ? "s" : ""} pending sync
            </span>
          </div>
          <button
            onClick={triggerSync}
            disabled={isSyncing || !isOnline}
            className="text-xs text-[#25D366] hover:text-[#20b859] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Update Available Banner */}
      {canUpdate && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#1a2d39] border-b border-[#2a3942]">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#25D366]" />
            <span className="text-xs text-[#d1d7db]">
              New version available
            </span>
          </div>
          <button
            onClick={updateApp}
            className="px-3 py-1 text-xs font-medium text-white bg-[#25D366] rounded-lg hover:bg-[#20b859] transition"
          >
            Update
          </button>
        </div>
      )}

      {/* Last Sync Timestamp */}
      {lastSync && isOnline && !isSyncing && (
        <div className="flex items-center justify-center px-4 py-1 bg-[#131c21] border-b border-[#2a3942]">
          <Cloud className="w-3 h-3 text-[#8696a0] mr-1.5" />
          <span className="text-[10px] text-[#8696a0]">
            Last sync: {new Date(lastSync).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
};