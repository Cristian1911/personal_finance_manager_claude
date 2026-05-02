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

/**
 * Wider sweep for actions that wipe (or replace) the entire user dataset:
 * reset_user_data, account import that touches every domain, etc.
 *
 * Includes everything in `revalidateFinancialViews()` plus the per-domain
 * tags that aren't transaction-driven (profile, destinatarios, tags,
 * wishlist, email-ingest, pdf-passwords, snapshots, capture-tokens,
 * reminders, cashflow-planner, categories, impact, dashboard-config).
 *
 * Intentionally omits `exchange-rates` — it's a global, non-user-scoped
 * cache populated from frankfurter.app and survives user data resets.
 */
export function revalidateAllUserData() {
  revalidateFinancialViews();
  updateTag("profile");
  updateTag("destinatarios");
  updateTag("dashboard-config");
  updateTag("tags");
  updateTag("wishlist");
  updateTag("email-ingest");
  updateTag("pdf-passwords");
  updateTag("snapshots");
  updateTag("capture-tokens");
  updateTag("reminders");
  updateTag("cashflow-planner");
  updateTag("categories");
  updateTag("impact");
}
