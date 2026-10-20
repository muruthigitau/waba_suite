/**
 * Single bulk campaign row with status, progress and actions.
 *
 * Kept separate from `CampaignsPanel` so the panel stays focused on fetching
 * campaigns and orchestrating submit/progress calls.
 */

import { Loader2, RefreshCw } from "lucide-react";
import React from "react";
import type { BulkMessage, BulkProgress } from "../../types/bulk";

interface CampaignCardProps {
  campaign: BulkMessage;
  progress?: BulkProgress;
  busy: boolean;
  onSubmit: () => void;
  onCheckProgress: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-[#2a3942] text-[#aebac1]",
  Queued: "bg-amber-500/15 text-amber-300",
  "In Progress": "bg-sky-500/15 text-sky-300",
  Completed: "bg-emerald-500/15 text-emerald-300",
  "Partially Failed": "bg-red-500/15 text-red-300",
};

const PROGRESS_BADGES: {
  key: keyof Pick<
    BulkProgress,
    "sent" | "delivered" | "read" | "queued" | "pending" | "failed" | "total"
  >;
  label: string;
  className: string;
}[] = [
  { key: "sent", label: "Sent", className: "bg-emerald-500/15 text-emerald-300" },
  { key: "delivered", label: "Delivered", className: "bg-teal-500/15 text-teal-300" },
  { key: "read", label: "Read", className: "bg-sky-500/15 text-sky-300" },
  { key: "queued", label: "Queued", className: "bg-amber-500/15 text-amber-300" },
  { key: "pending", label: "Pending", className: "bg-[#2a3942] text-[#aebac1]" },
  { key: "failed", label: "Failed", className: "bg-red-500/15 text-red-300" },
  { key: "total", label: "Total", className: "bg-[#2a3942] text-white" },
];

export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  progress,
  busy,
  onSubmit,
  onCheckProgress,
}) => {
  const status = campaign.status || "Draft";
  const total = campaign.recipient_count || 0;
  const done = progress ? progress.processed : campaign.sent_count;
  const percent = progress
    ? Math.min(100, Math.round(progress.percent))
    : total
      ? Math.min(100, Math.round((done / total) * 100))
      : 0;
  const isDraft = campaign.docstatus === 0;

  return (
    <div className="rounded-xl border border-[#2a3942] bg-[#202c33] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {campaign.title || campaign.name}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                STATUS_STYLES[status] || STATUS_STYLES.Draft
              }`}
            >
              {status}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#8696a0]">
            {campaign.recipient_list || "No list"} ·{" "}
            {campaign.template || "No template"} ·{" "}
            {new Date(campaign.creation).toLocaleString()}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isDraft && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-medium text-[#111b21] hover:bg-[#20b859] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit
            </button>
          )}
          <button
            type="button"
            onClick={onCheckProgress}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a3942] px-3 py-1.5 text-xs text-[#d1d7db] hover:bg-[#2a3942] disabled:opacity-60"
          >
            {busy && !isDraft ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Check Progress
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#111b21]">
          <div
            className="h-full rounded-full bg-[#25D366] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        {progress && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
            {PROGRESS_BADGES.map((badge) => (
              <span
                key={badge.key}
                className={`rounded-full px-2 py-0.5 ${badge.className}`}
              >
                {badge.label}: {progress[badge.key] ?? 0}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8696a0]">
          <span>
            {done} / {total} processed
          </span>
          <span>{percent}%</span>
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;
