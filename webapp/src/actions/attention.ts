"use server";

import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { monthEndStr, monthStartStr, parseMonth, toColombiaDateString } from "@/lib/utils/date";
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
  const [
    uncategorizedRes,
    destinatarioRes,
    overdueRemindersRes,
    overduePersonalDebtsRes,
    settledObligationsRes,
  ] = await Promise.all([
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
      .is("reconciled_into_transaction_id", null)
      // Exclude personal-debt movements (standalone debt origins + repayments).
      // The shared-payment tx itself has personal_debt_id null, so it stays — and
      // in "new" mode it is uncategorized, so it correctly surfaces here.
      .is("personal_debt_id", null),

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

    // Signal: Personal debts past their due date. Setting a due date on a loan
    // produced no reminder anywhere before — the user had to open the page and
    // notice a badge.
    supabase
      .from("personal_debts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active")
      .not("due_date", "is", null)
      .lt("due_date", todayStr),

    // Signal: obligaciones activas con saldo cero. Archivarlas apaga sus
    // plantillas recurrentes, así que el usuario debe confirmarlo — pero el
    // único camino estaba en el menú "···" de /accounts/[id], a cinco pasos.
    supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("current_balance", 0)
      .in("account_type", ["CREDIT_CARD", "LOAN"]),
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

  // Signal: Overdue personal debts
  const overduePersonalDebtsCount = overduePersonalDebtsRes.count ?? 0;
  if (overduePersonalDebtsCount > 0) {
    signals.push({
      page: "deudas-personales",
      key: "overdue_personal_debts",
      count: overduePersonalDebtsCount,
      label:
        overduePersonalDebtsCount === 1
          ? "1 deuda personal vencida"
          : `${overduePersonalDebtsCount} deudas personales vencidas`,
      priority: "action",
      actionHref: "/deudas-personales",
    });
  }

  // Signal: obligaciones saldadas que siguen activas. El parámetro las abre
  // expandidas en /accounts, con el botón de archivar ya a la vista.
  const settledObligationsCount = settledObligationsRes.count ?? 0;
  if (settledObligationsCount > 0) {
    signals.push({
      page: "cuentas",
      key: "obligaciones-saldadas",
      count: settledObligationsCount,
      label:
        settledObligationsCount === 1
          ? "1 obligación saldada sin archivar"
          : `${settledObligationsCount} obligaciones saldadas sin archivar`,
      priority: "action",
      actionHref: "/accounts?saldadas=1",
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
    // Anchor month bounds to Bogotá's calendar, not the server's TZ (UTC in
    // Docker). On the last day of the month, server UTC has already rolled to
    // the next month while Bogotá is still in the prior one — without this
    // anchor, monthStart/monthEnd would silently shift and the uncategorized
    // count would jump to next-month's (empty) bucket.
    const now = new Date();
    const todayStr = toColombiaDateString(now);
    const monthAnchor = parseMonth(todayStr.substring(0, 7));
    return await getAttentionSnapshotCached(
      accessToken,
      user.id,
      monthStartStr(monthAnchor),
      monthEndStr(monthAnchor),
      todayStr,
    );
  } catch (err) {
    console.error("Error computing attention snapshot:", err);
    return { signals: [], totalAction: 0, totalSuggestion: 0, perPage: {} };
  }
}
