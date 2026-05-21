import { updateTag, revalidateTag } from "next/cache";

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

/**
 * Route-Handler-safe variant of `revalidateFinancialViews()`. Used by
 * webhooks (`/api/webhooks/email-ingest`, telegram, cron jobs) where
 * `updateTag()` doesn't work as expected — its read-your-own-writes
 * semantics are request-scoped to the current Server Action, but a
 * webhook's request ends before any client navigates, so the user's
 * NEXT request never sees the invalidation. `revalidateTag(tag, "zeta")`
 * marks the cache entries stale for subsequent reads (stale-while-
 * revalidate is acceptable here — eventual consistency is fine for
 * background-ingested data).
 *
 * Discovered 2026-05-21 when an email-imported transaction appeared on
 * /transactions + /accounts/[id] but was missing from the dashboard
 * hero. Both surfaces are tagged `"transactions"`, but only the former
 * was getting invalidated because `getRitmo` / hero queries are read by
 * subsequent navigations, not the webhook's own response.
 */
export function revalidateFinancialViewsFromWebhook() {
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
  revalidateTag("recurring", "zeta");
}
