/**
 * URL-driven UI state for the WhatsApp chat app.
 *
 * The active WhatsApp Account, the selected chat, the chat-list filter tab and
 * the selected label filters are all persisted in the URL query string instead
 * of an IndexedDB cache. This keeps the state shareable, bookmarkable and
 * correct across reloads, back/forward navigation and multiple tabs.
 *
 * URL shape:
 *   /whatsapp?account=<account>&chat=<contact>&filter=unread&labels=a,b
 */

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/** Chat-list filter tabs. */
export type ChatFilter = "all" | "unread" | "starred" | "archived";

const FILTERS: readonly ChatFilter[] = [
  "all",
  "unread",
  "starred",
  "archived",
];

const DEFAULT_FILTER: ChatFilter = "all";

export interface UrlState {
  /** Active WhatsApp Account name, or "" when not yet resolved. */
  account: string;
  /** Selected WhatsApp Contact (chat) name, or null. */
  chatId: string | null;
  /** Active chat-list filter tab. */
  filter: ChatFilter;
  /** Selected label names used to filter the chat list. */
  labels: string[];
  setAccount: (account: string) => void;
  setChatId: (chatId: string | null) => void;
  setFilter: (filter: ChatFilter) => void;
  setLabels: (labels: string[]) => void;
}

/**
 * Read and write the app's navigation/UI state from the URL query string.
 *
 * All writes replace the current history entry so that toggling filters or
 * opening chats does not flood the browser history.
 */
export function useUrlState(): UrlState {
  const [searchParams, setSearchParams] = useSearchParams();

  const account = searchParams.get("account") || "";
  const chatId = searchParams.get("chat");
  const filterParam = searchParams.get("filter");
  const filter = FILTERS.includes(filterParam as ChatFilter)
    ? (filterParam as ChatFilter)
    : DEFAULT_FILTER;
  const labels = useMemo(() => {
    const raw = searchParams.get("labels");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setAccount = useCallback(
    (value: string) => {
      update((params) => {
        if (value) {
          params.set("account", value);
        } else {
          params.delete("account");
        }
        // A chat belongs to a specific account, so clear it on account change.
        params.delete("chat");
      });
    },
    [update],
  );

  const setChatId = useCallback(
    (value: string | null) => {
      update((params) => {
        if (value) {
          params.set("chat", value);
        } else {
          params.delete("chat");
        }
      });
    },
    [update],
  );

  const setFilter = useCallback(
    (value: ChatFilter) => {
      update((params) => {
        if (value === DEFAULT_FILTER) {
          params.delete("filter");
        } else {
          params.set("filter", value);
        }
      });
    },
    [update],
  );

  const setLabels = useCallback(
    (value: string[]) => {
      update((params) => {
        if (value.length > 0) {
          params.set("labels", value.join(","));
        } else {
          params.delete("labels");
        }
      });
    },
    [update],
  );

  return {
    account,
    chatId,
    filter,
    labels,
    setAccount,
    setChatId,
    setFilter,
    setLabels,
  };
}

export default useUrlState;
