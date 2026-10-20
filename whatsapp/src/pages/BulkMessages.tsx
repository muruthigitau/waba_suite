/**
 * Dedicated page for bulk WhatsApp campaigns and recipient list management.
 */

import { useFrappeGetCall } from "frappe-react-sdk";
import { ArrowLeft, Loader2, Megaphone, Users } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CampaignsPanel } from "../components/bulk/CampaignsPanel";
import { RecipientListsPanel } from "../components/bulk/RecipientListsPanel";
import { useUrlState } from "../hooks/useUrlState";
import type { Account } from "../types";

type BulkTab = "campaigns" | "lists";

export const BulkMessages: React.FC = () => {
  const navigate = useNavigate();
  const { account: urlAccount, setAccount } = useUrlState();
  const [tab, setTab] = useState<BulkTab>("campaigns");

  const { data: accountsData, isLoading } = useFrappeGetCall<{
    message: {
      accounts: Account[];
      default_account: Account | null;
      has_accounts: boolean;
    };
  }>("waba_suite.api.accounts.get_user_accounts_with_default", {});

  const accounts = useMemo(
    () => accountsData?.message?.accounts || [],
    [accountsData],
  );
  const serverDefaultAccount =
    accountsData?.message?.default_account?.name || "";

  const account = useMemo(() => {
    if (urlAccount && accounts.some((item) => item.name === urlAccount)) {
      return urlAccount;
    }
    if (serverDefaultAccount) return serverDefaultAccount;
    return accounts[0]?.name || "";
  }, [urlAccount, accounts, serverDefaultAccount]);

  useEffect(() => {
    if (account && account !== urlAccount) {
      setAccount(account);
    }
  }, [account, urlAccount, setAccount]);

  return (
    <div className="flex h-screen flex-col bg-[#111b21]">
      <header className="flex items-center gap-3 border-b border-[#2a3942] bg-[#202c33] px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(account ? `/?account=${account}` : "/")}
          className="rounded-lg p-1.5 text-[#aebac1] hover:bg-[#2a3942] hover:text-white"
          aria-label="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-white">
            Bulk Messages
          </h1>
          <p className="truncate text-xs text-[#8696a0]">
            {account || "No WhatsApp account"}
          </p>
        </div>
        <div className="flex rounded-full bg-[#111b21] p-1">
          <button
            type="button"
            onClick={() => setTab("campaigns")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
              tab === "campaigns"
                ? "bg-[#2a3942] text-white"
                : "text-[#8696a0] hover:text-[#d1d7db]"
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" /> Campaigns
          </button>
          <button
            type="button"
            onClick={() => setTab("lists")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
              tab === "lists"
                ? "bg-[#2a3942] text-white"
                : "text-[#8696a0] hover:text-[#d1d7db]"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Recipient Lists
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-[#8696a0]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !account ? (
          <p className="rounded-lg border border-[#2a3942] p-6 text-center text-sm text-[#8696a0]">
            You do not have access to a WhatsApp account.
          </p>
        ) : tab === "campaigns" ? (
          <CampaignsPanel
            whatsappAccount={account}
            onOpenRecipientLists={() => setTab("lists")}
          />
        ) : (
          <RecipientListsPanel whatsappAccount={account} />
        )}
      </main>
    </div>
  );
};

export default BulkMessages;
