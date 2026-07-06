"use server";

import { getDashboardHeroData, getDailySpending } from "@/actions/charts";
import { getBudgetSummary } from "@/actions/budgets";
import { getReminders } from "@/actions/reminders";
import { toColombiaDateString, getColombiaDayOfMonth } from "@/lib/utils/date";
import type { PendingObligation } from "@/actions/charts";
import type { CurrencyCode, FinancialReminder } from "@/types/domain";

export interface QuickViewData {
  /** Liquid balance minus pending obligations */
  availableToSpend: number;
  /** Total liquid account balances */
  totalLiquid: number;
  /** Total spent today */
  spentToday: number;
  /** Daily allowance = remaining budget / days left in month */
  dailyAllowance: number;
  /** Remaining budget for the month */
  remainingBudget: number;
  /** Budget progress percentage */
  budgetProgress: number;
  /** Next 5 upcoming obligations sorted by due date */
  upcomingObligations: PendingObligation[];
  /** Pending financial reminders (up to 5) */
  pendingReminders: FinancialReminder[];
  /** Currency code */
  currency: CurrencyCode;
}

export async function getQuickViewData(): Promise<QuickViewData> {
  const [hero, dailySpending, budgetSummary, pendingReminders] = await Promise.all([
    getDashboardHeroData(),
    getDailySpending(undefined, undefined, { liquidOnly: true }),
    getBudgetSummary(),
    getReminders("pending"),
  ]);

  const now = new Date();
  const todayStr = toColombiaDateString(now);
  const todayEntry = dailySpending.find((d) => d.date === todayStr);
  const spentToday = todayEntry?.amount ?? 0;

  const [yearStr, monthStr] = todayStr.split("-");
  const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const daysLeft = daysInMonth - getColombiaDayOfMonth(now) + 1; // include today
  const remainingBudget = Math.max(0, budgetSummary.totalTarget - budgetSummary.totalSpent);
  const dailyAllowance = daysLeft > 0 ? remainingBudget / daysLeft : 0;

  // Upcoming obligations sorted by due date, limited to 5
  const upcoming = hero.pendingObligations
    .filter((o) => o.due_date >= todayStr)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  return {
    availableToSpend: hero.availableToSpend,
    totalLiquid: hero.totalLiquid,
    spentToday,
    dailyAllowance,
    remainingBudget,
    budgetProgress: budgetSummary.progress,
    upcomingObligations: upcoming,
    pendingReminders: pendingReminders.slice(0, 5),
    currency: hero.currency as CurrencyCode,
  };
}
