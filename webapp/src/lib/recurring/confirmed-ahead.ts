import { isDebtAccountType } from "@/lib/utils/account-balance";

/**
 * How many months past the current one the Recurrentes month cursor may reach.
 * Normally 0 — but once a card/loan statement has been imported, its payment
 * due date is confirmed and often lands next month (cut on the 25th, pay by
 * the 10th). Then the user needs to see next month to plan that payment, so
 * the cursor opens exactly one month ahead. Never more: further months only
 * hold projections.
 */
export function recurringMonthsAhead(
  upcomingPayments: ReadonlyArray<{ account_type: string; payment_due_date: string }>,
  todayStr: string,
): 0 | 1 {
  const currentMonth = todayStr.slice(0, 7);
  return upcomingPayments.some(
    (p) => isDebtAccountType(p.account_type) && p.payment_due_date.slice(0, 7) > currentMonth,
  )
    ? 1
    : 0;
}
