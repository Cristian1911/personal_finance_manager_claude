"use server";

import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toISODateString } from "@/lib/utils/date";
import type { AttentionSignal, AttentionSnapshot, AttentionPage } from "@/types/attention";

// ─── Cached inner function ────────────────────────────────────────────────────

async function getAttentionSnapshotCached(
  userId: string
): Promise<AttentionSnapshot> {
  "use cache";
  cacheTag("attention");
  cacheLife("zeta");

  const supabase = createAdminClient();

  // Run queries in parallel
  const [uncategorizedRes, destinatarioRes, overdueRemindersRes] = await Promise.all([
    // Signal 1: Uncategorized transactions
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
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
      .eq("is_excluded", false),

    // Signal: Overdue reminders
    supabase
      .from("financial_reminders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_completed", false)
      .lt("due_date", toISODateString(new Date())),
  ]);

  const signals: AttentionSignal[] = [];

  // Signal 1: Uncategorized transactions
  const uncategorizedCount = uncategorizedRes.count ?? 0;
  if (uncategorizedCount > 0) {
    signals.push({
      page: "transactions",
      key: "uncategorized",
      count: uncategorizedCount,
      label:
        uncategorizedCount === 1
          ? "1 transacción sin categoría"
          : `${uncategorizedCount} transacciones sin categoría`,
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
  const { user } = await getAuthenticatedClient();
  if (!user) {
    return { signals: [], totalAction: 0, totalSuggestion: 0, perPage: {} };
  }
  try {
    return await getAttentionSnapshotCached(user.id);
  } catch (err) {
    console.error("Error computing attention snapshot:", err);
    return { signals: [], totalAction: 0, totalSuggestion: 0, perPage: {} };
  }
}
