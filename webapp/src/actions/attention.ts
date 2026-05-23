"use server";

import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { monthEndStr, monthStartStr, toColombiaDateString } from "@/lib/utils/date";
import type { AttentionSignal, AttentionSnapshot, AttentionPage } from "@/types/attention";

// ─── Cached inner function ────────────────────────────────────────────────────

async function getAttentionSnapshotCached(
  accessToken: string,
  userId: string,
  monthStart: string,
  monthEnd: string,
  todayStr: string,
): Promise<AttentionSnapshot> {
  "use cache";
  cacheTag("attention");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  // Run queries in parallel
  const [uncategorizedRes, destinatarioRes, overdueRemindersRes] = await Promise.all([
    // Signal 1: Uncategorized OUTFLOW transactions in the current month.
    // Matches `computeMonthlyAggregates.uncategorizedCount` (the Resumen del
    // mes / Movimientos definition) so /accounts and /transactions agree.
    // INFLOW is excluded — income rarely needs a category and would inflate
    // the signal. Backlog beyond the current month is surfaced inside
    // /categorizar (the action surface), not in the attention card.
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("direction", "OUTFLOW")
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .is("category_id", null)
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null),

    // Signal 2: Transactions without destinatario but with raw_description
    // Used as a proxy for pending destinatario suggestions (grouped by pattern)
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("destinatario_id", null)
      .not("raw_description", "is", null)
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null),

    // Signal: Overdue reminders
    supabase
      .from("financial_reminders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_completed", false)
      .lt("due_date", todayStr),
  ]);

  const signals: AttentionSignal[] = [];

  // Signal 1: Uncategorized OUTFLOW transactions (current month).
  const uncategorizedCount = uncategorizedRes.count ?? 0;
  if (uncategorizedCount > 0) {
    signals.push({
      page: "transactions",
      key: "uncategorized",
      count: uncategorizedCount,
      label:
        uncategorizedCount === 1
          ? "1 gasto sin categoría este mes"
          : `${uncategorizedCount} gastos sin categoría este mes`,
      priority: "action",
      actionHref: "/categorizar",
    });
  }

  // Signal 2: Pending destinatario suggestions
  // Divide raw count by 3 as a simplified proxy for grouped suggestions (min 3 occurrences)
  const rawUnmatchedCount = destinatarioRes.count ?? 0;
  const suggestionCount = Math.floor(rawUnmatchedCount / 3);
  if (suggestionCount > 0) {
    signals.push({
      page: "destinatarios",
      key: "suggestions",
      count: suggestionCount,
      label:
        suggestionCount === 1
          ? "1 destinatario sugerido"
          : `${suggestionCount} destinatarios sugeridos`,
      priority: "suggestion",
      actionHref: "/destinatarios",
    });
  }

  // Signal: Overdue reminders
  const overdueRemindersCount = overdueRemindersRes.count ?? 0;
  if (overdueRemindersCount > 0) {
    signals.push({
      page: "pendientes",
      key: "overdue_reminders",
      count: overdueRemindersCount,
      label: overdueRemindersCount === 1
        ? "1 pendiente vencido"
        : `${overdueRemindersCount} pendientes vencidos`,
      priority: "action",
      actionHref: "/pendientes",
    });
  }

  // TODO Signal 3: Over-budget categories (needs Task 4 RPC)
  // const overBudgetCount = 0;

  // TODO Signal 4: Overdue recurring (needs JS occurrence computation via getOccurrencesBetween)
  // const overdueCount = 0;

  // TODO Signal 5: Upcoming recurring in 7 days (needs JS occurrence computation)
  // const upcomingCount = 0;

  const totalAction = signals
    .filter((s) => s.priority === "action")
    .reduce((sum, s) => sum + s.count, 0);

  const totalSuggestion = signals
    .filter((s) => s.priority === "suggestion")
    .reduce((sum, s) => sum + s.count, 0);

  const perPage: Partial<Record<AttentionPage, number>> = {};
  for (const signal of signals) {
    perPage[signal.page] = (perPage[signal.page] ?? 0) + signal.count;
  }

  return { signals, totalAction, totalSuggestion, perPage };
}

// ─── Public wrapper ───────────────────────────────────────────────────────────

export async function getAttentionSnapshot(): Promise<AttentionSnapshot> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) {
    return { signals: [], totalAction: 0, totalSuggestion: 0, perPage: {} };
  }
  try {
    const now = new Date();
    return await getAttentionSnapshotCached(
      accessToken,
      user.id,
      monthStartStr(now),
      monthEndStr(now),
      toColombiaDateString(now),
    );
  } catch (err) {
    console.error("Error computing attention snapshot:", err);
    return { signals: [], totalAction: 0, totalSuggestion: 0, perPage: {} };
  }
}
