/**
 * Message grouping utilities for the chat space.
 *
 * Groups messages the way WhatsApp does: date-chip separators between days and
 * collapsed consecutive batches from the same sender.
 */

import { useMemo } from "react";
import type { Message } from "../types";

export interface MessageGroup {
  key: string;
  kind: "date" | "message";
  date?: Date;
  label?: string;
  message?: Message;
  isFirstOfBatch?: boolean;
}

const DAY_MS = 86400000;
const BATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function dayLabel(d: Date): string {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = Math.round((startOfToday.getTime() - dayStart.getTime()) / DAY_MS);

  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let lastDayLabel: string | null = null;
  let prevKey: string | null = null;

  messages.forEach((m) => {
    const lbl = dayLabel(m.fullTimestamp);
    if (lbl !== lastDayLabel) {
      groups.push({ key: `date-${lbl}`, kind: "date", date: m.fullTimestamp, label: lbl });
      lastDayLabel = lbl;
      prevKey = null;
    }

    // Consecutive batch: same direction + same sender + within a few minutes.
    const msgKey = `${m.isSent ? "out" : "in"}-${m.senderName || ""}`;
    const last = groups[groups.length - 1];
    const sameBatch =
      prevKey === msgKey &&
      last?.kind === "message" &&
      (last.message?.fullTimestamp.getTime() ?? 0) >
        m.fullTimestamp.getTime() - BATCH_WINDOW_MS;

    groups.push({ key: `msg-${m.id}`, kind: "message", message: m, isFirstOfBatch: !sameBatch });
    prevKey = msgKey;
  });

  return groups;
}

export function useMessageGrouping(messages: Message[]): MessageGroup[] {
  return useMemo(() => groupMessages(messages), [messages]);
}