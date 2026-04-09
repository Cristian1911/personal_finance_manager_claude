import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Revalidate all financial view caches. Call after any mutation that
 * creates, updates, or deletes transactions, or changes data that
 * feeds dashboard/plan/budget views.
 *
 * Uses both revalidateTag (Data Cache) and revalidatePath (Route Cache)
 * to ensure both same-page and cross-page freshness.
 *
 * Callers should add domain-specific extras after calling this:
 *   revalidateFinancialViews();
 *   revalidateTag("email-ingest", "zeta");   // domain extra
 */
export function revalidateFinancialViews() {
  // Data Cache — invalidate cached "use cache" function results
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

  // Route Cache — force full re-render on next visit to these pages
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/categorizar");
  revalidatePath("/plan");
}
