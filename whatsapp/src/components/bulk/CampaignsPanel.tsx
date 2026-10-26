/**
 * Bulk campaign list with per-campaign sending progress.
 *
 * Progress is fetched on demand from `waba_suite.utils.bulk_messaging.get_progress`
 * because the campaign row only stores the last persisted counters.
 */

import {
  useFrappeDocTypeEventListener,
  useFrappeGetDocList,
  useFrappePostCall,
} from "frappe-react-sdk";
import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
} from "lucide-react";
import type { BulkMessage, BulkProgress } from "../../types/bulk";
import { CampaignCard } from "./CampaignCard";
import { CreateBulkMessageModal } from "./CreateBulkMessageModal";

interface CampaignsPanelProps {
  whatsappAccount: string;
  onOpenRecipientLists: () => void;
}

export const CampaignsPanel: React.FC<CampaignsPanelProps> = ({
  whatsappAccount,
  onOpenRecipientLists,
}) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [progress, setProgress] = useState<Record<string, BulkProgress>>({});
  const [busyDoc, setBusyDoc] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "warning";
    message: string;
  } | null>(null);

  const { data, isLoading, error, mutate } = useFrappeGetDocList<BulkMessage>(
    "Bulk WhatsApp Message",
    {
      fields: [
        "name",
        "title",
        "status",
        "recipient_count",
        "sent_count",
        "template",
        "recipient_list",
        "whatsapp_account",
        "creation",
        "docstatus",
      ],
      filters: [["whatsapp_account", "=", whatsappAccount]],
      limit: 100,
      orderBy: { field: "creation", order: "desc" },
    },
  );

  const { call: getProgress } = useFrappePostCall<{
    message: BulkProgress;
  }>("waba_suite.utils.bulk_messaging.get_progress");
  const { call: fetchDoc } = useFrappePostCall("frappe.client.get");
  const { call: submitDoc } = useFrappePostCall("frappe.client.submit");

  const campaigns = data || [];

  // Recipient-list edits update draft campaign counts on the server; refresh
  // the cards as soon as those documents change.
  useFrappeDocTypeEventListener("Bulk WhatsApp Message", () => {
    void mutate();
  });

  const handleCheckProgress = async (name: string) => {
    setBusyDoc(name);
    setNotice(null);
    try {
      // `call` resolves to the full Frappe response, not the unwrapped `message`.
      const response = await getProgress({ name });
      const result = response?.message;
      if (!result) {
        throw new Error("Empty progress response");
      }
      setProgress((current) => ({ ...current, [name]: result }));
      await mutate();
    } catch {
      setNotice({
        tone: "warning",
        message: "Could not load progress for this campaign.",
      });
    } finally {
      setBusyDoc(null);
    }
  };

  const handleSubmitDraft = async (name: string) => {
    setBusyDoc(name);
    setNotice(null);
    try {
      const doc = await fetchDoc({
        doctype: "Bulk WhatsApp Message",
        name,
      });
      await submitDoc({ doc });
      await mutate();
      setNotice({
        tone: "success",
        message: "Campaign submitted. Messages are being queued.",
      });
    } catch (submitError) {
      setNotice({
        tone: "warning",
        message:
          submitError instanceof Error
            ? submitError.message
            : "Could not submit the campaign.",
      });
    } finally {
      setBusyDoc(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Bulk Messages</h2>
          <p className="text-xs text-[#8696a0]">
            Template campaigns sent to a saved recipient list.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-[#111b21] hover:bg-[#20b859]"
        >
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
            notice.tone === "success"
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#8696a0]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : error ? (
        <p className="rounded-lg border border-[#2a3942] p-6 text-center text-sm text-red-400">
          {error.message || "Could not load bulk campaigns."}
        </p>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2a3942] py-16 text-center">
          <Send className="mb-3 h-10 w-10 text-[#8696a0]" />
          <p className="text-sm font-medium text-white">No bulk campaigns</p>
          <p className="mt-1 text-xs text-[#8696a0]">
            Create a campaign to send a template to a recipient list.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.name}
              campaign={campaign}
              progress={progress[campaign.name]}
              busy={busyDoc === campaign.name}
              onSubmit={() => handleSubmitDraft(campaign.name)}
              onCheckProgress={() => handleCheckProgress(campaign.name)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateBulkMessageModal
          onClose={() => setCreateOpen(false)}
          whatsappAccount={whatsappAccount}
          onOpenRecipientLists={onOpenRecipientLists}
          onCreated={async (name, submitted) => {
            setCreateOpen(false);
            setNotice(
              submitted
                ? {
                    tone: "success",
                    message: "Campaign submitted. Messages are being queued.",
                  }
                : {
                    tone: "warning",
                    message: `Campaign ${name} was saved as a draft but could not be submitted. Submit it from the list below.`,
                  },
            );
            await mutate();
          }}
        />
      )}
    </div>
  );
};

export default CampaignsPanel;

