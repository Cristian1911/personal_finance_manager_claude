"use server";

import { getDashboardHeroData, getDailySpending } from "@/actions/charts";
import { getBudgetSummary } from "@/actions/budgets";
import { toISODateString } from "@/lib/utils/date";
import type { PendingObligation } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

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
  /** Currency code */
  currency: CurrencyCode;
}

export async function getQuickViewData(): Promise<QuickViewData> {
  const [hero, dailySpending, budgetSummary] = await Promise.all([
    getDashboardHeroData(),
    getDailySpending(),
    getBudgetSummary(),
  ]);

  const now = new Date();
  const todayStr = toISODateString(now);
  const todayEntry = dailySpending.find((d) => d.date === todayStr);
  const spentToday = todayEntry?.amount ?? 0;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1; // include today
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
    currency: hero.currency as CurrencyCode,
  };
}
