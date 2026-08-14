/**
 * Chat preference toggles (pin / star / archive).
 *
 * Encapsulates the API calls and optimistic state updates for toggling chat
 * pin/star/archive flags, shared across the chat UI.
 */

import { useCallback } from "react";

interface ToggleResult {
  is_pinned?: boolean;
  is_starred?: boolean;
  is_archived?: boolean;
}

interface UseChatPreferencesOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  togglePinCall: (params: Record<string, any>) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toggleStarCall: (params: Record<string, any>) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toggleArchiveCall: (params: Record<string, any>) => Promise<any>;
  currentAccount: string;
}

type ChatArgs = {
  id: string;
  mobileNo: string;
  name: string;
  whatsappAccount?: string;
  isPinned?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
};

export function useChatPreferences({
  togglePinCall,
  toggleStarCall,
  toggleArchiveCall,
  currentAccount,
}: UseChatPreferencesOptions) {
  const buildParams = useCallback(
    (chat: ChatArgs) => ({
      whatsapp_contact: chat.id,
      mobile_no: chat.mobileNo,
      contact_name: chat.name,
      whatsapp_account: chat.whatsappAccount || currentAccount,
    }),
    [currentAccount],
  );

  const togglePin = useCallback(
    async (chat: ChatArgs): Promise<boolean> => {
      try {
        const res = (await togglePinCall(
          buildParams(chat),
        )) as { message?: ToggleResult };
        return res?.message?.is_pinned ?? !chat.isPinned;
      } catch (error) {
        console.error("Failed to toggle pin:", error);
        return !!chat.isPinned;
      }
    },
    [togglePinCall, buildParams],
  );

  const toggleStar = useCallback(
    async (chat: ChatArgs): Promise<boolean> => {
      try {
        const res = (await toggleStarCall(
          buildParams(chat),
        )) as { message?: ToggleResult };
        return res?.message?.is_starred ?? !chat.isStarred;
      } catch (error) {
        console.error("Failed to toggle star:", error);
        return !!chat.isStarred;
      }
    },
    [toggleStarCall, buildParams],
  );

  const toggleArchive = useCallback(
    async (chat: ChatArgs): Promise<boolean> => {
      try {
        const res = (await toggleArchiveCall(
          buildParams(chat),
        )) as { message?: ToggleResult };
        return res?.message?.is_archived ?? !chat.isArchived;
      } catch (error) {
        console.error("Failed to toggle archive:", error);
        return !!chat.isArchived;
      }
    },
    [toggleArchiveCall, buildParams],
  );

  return { togglePin, toggleStar, toggleArchive };
}