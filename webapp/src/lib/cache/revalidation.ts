import { revalidateTag } from "next/cache";

/**
 * Revalidate all financial Data Cache entries. Call after any mutation
 * that creates, updates, or deletes transactions.
 *
 * Does NOT invalidate Route Cache — volatile UI metrics use client-side
 * live refresh instead (see useLiveMetrics hook).
 *
 * Callers should add domain-specific extras after calling this:
 *   revalidateFinancialViews();
 *   revalidateTag("email-ingest", "zeta");   // domain extra
 *
 * NOTE: revalidateTag(tag, profile) — the second arg is the cacheLife
 * profile name ("zeta"), NOT a second tag. Always pass "zeta".
 */
export function revalidateFinancialViews() {
  revalidateTag("transactions", "zeta");
  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  revalidateTag("dashboard:cashflow", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("categorize", "zeta");
  revalidateTag("debt", "zeta");
  revalidateTag("budgets", "zeta");
  revalidateTag("attention", "zeta");
  revalidateTag("occurrences", "zeta");
}
