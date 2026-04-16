import { updateTag } from "next/cache";

/**
 * Immediately expire all financial Data Cache entries. Call after any
 * mutation that creates, updates, or deletes transactions.
 *
 * Uses `updateTag` (not `revalidateTag`) for read-your-own-writes —
 * the user sees their change immediately, no stale-while-revalidate.
 * Also clears the client Router Cache so cross-page navigation is fresh.
 *
 * Callers should add domain-specific extras after calling this:
 *   revalidateFinancialViews();
 *   updateTag("email-ingest");   // domain extra
 */
export function revalidateFinancialViews() {
  updateTag("transactions");
  updateTag("accounts");
  updateTag("dashboard:accounts");
  updateTag("dashboard:charts");
  updateTag("dashboard:budgets");
  updateTag("dashboard:cashflow");
  updateTag("dashboard:hero");
  updateTag("categorize");
  updateTag("debt");
  updateTag("budgets");
  updateTag("attention");
  updateTag("occurrences");
  updateTag("recurring");
}
