"use server";

import { buildWeeklyDigest, type WeeklyDigest } from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  getDailySpending,
  getCategorySpending,
  getDailyBudgetPace,
} from "@/actions/charts";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import { toColombiaDateString } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";

/** Add `n` days to a YYYY-MM-DD string via UTC math (server-TZ-independent). */
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/**
 * Assemble the weekly-digest inputs from the existing cached chart/recurrence
 * actions and run the shared rule engine (`buildWeeklyDigest`). Channel-agnostic:
 * used by the in-app digest surface today and reused by the future
 * email/push cron. Composes already-cached actions (like `getRitmo`), so it is
 * NOT wrapped in `"use cache"` itself.
 *
 * NOTE: `topCategory` is month-scoped (top category this month) — a deliberate
 * proxy to avoid a new week-scoped query; revisit if week-accuracy matters.
 */
export async function getWeeklyDigest(
  currency: CurrencyCode = "COP",
): Promise<
  { success: true; data: WeeklyDigest } | { success: false; error: string }
> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    const todayStr = toColombiaDateString(new Date()); // YYYY-MM-DD (Colombia)
    const [cy, cm, cd] = todayStr.split("-").map(Number);
    const currentMonth = todayStr.slice(0, 7);
    const prevMonth =
      cm === 1
        ? `${cy - 1}-12`
        : `${cy}-${String(cm - 1).padStart(2, "0")}`;

    const [dailyCur, dailyPrev, categories, pace, upcoming] = await Promise.all([
      getDailySpending(currentMonth, currency),
      getDailySpending(prevMonth, currency),
      getCategorySpending(currentMonth, currency),
      getDailyBudgetPace(currentMonth, currency),
      getUpcomingRecurrences(7),
    ]);

    // Merge both months into a single date→OUTFLOW map for the 14-day window.
    const spendByDate = new Map<string, number>();
    for (const d of [...dailyPrev, ...dailyCur]) {
      spendByDate.set(d.date, (spendByDate.get(d.date) ?? 0) + d.amount);
    }
    const sumWindow = (startOffset: number, endOffset: number) => {
      let total = 0;
      for (let i = startOffset; i <= endOffset; i++) {
        total += spendByDate.get(addDays(todayStr, i)) ?? 0;
      }
      return total;
    };
    const thisWeekSpent = sumWindow(-6, 0); // last 7 days incl. today
    const lastWeekSpent = sumWindow(-13, -7); // the 7 days before that

    const top =
      categories.length > 0
        ? categories.reduce((a, b) => (b.amount > a.amount ? b : a))
        : null;
    const topCategory =
      top && top.amount > 0 ? { name: top.name, amount: top.amount } : null;

    const dayOfMonth = cd;
    const daysInMonth = new Date(Date.UTC(cy, cm, 0)).getUTCDate();

    const upcomingPayments = upcoming
      .filter((u) => u.template.direction === "OUTFLOW")
      .map((u) => ({
        label: u.template.merchant_name ?? "Pago",
        amount: u.template.amount,
        dueDate: u.next_date,
      }));
    const upcomingTotal = upcomingPayments.reduce((s, p) => s + p.amount, 0);

    const data = buildWeeklyDigest({
      currency,
      thisWeekSpent,
      lastWeekSpent,
      topCategory,
      monthlyBudget: pace.totalBudget,
      monthSpentSoFar: pace.totalSpent,
      dayOfMonth,
      daysInMonth,
      upcomingPayments,
      upcomingTotal,
    });

    return { success: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al cargar el resumen";
    return { success: false, error: message };
  }
}
