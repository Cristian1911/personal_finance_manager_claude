import { updateTag, revalidateTag } from "next/cache";

const FINANCIAL_TAGS = [
  "transactions",
  "accounts",
  "dashboard:accounts",
  "dashboard:charts",
  "dashboard:budgets",
  "dashboard:cashflow",
  "dashboard:hero",
  "categorize",
  "debt",
  "budgets",
  "attention",
  "occurrences",
  "recurring",
  "analytics",
  // Transaction mutations can change a personal debt's math (an edited or
  // deleted repayment shifts outstanding_amount; a deleted origin shrinks the
  // principal), so the personas/shared-payment reads must expire with them.
  "personal-debts",
] as const;

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
  for (const tag of FINANCIAL_TAGS) updateTag(tag);
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
 * webhooks (`/api/webhooks/email-ingest`, telegram, cron jobs).
 *
 * `updateTag()` pairs Data Cache eviction with Router Cache eviction
 * for the *initiating client*, giving Server Action callers read-your-
 * own-writes on their very next navigation. Route Handlers have no
 * attached client (the webhook is initiated by Bancolombia / Telegram /
 * cron, not the user the data belongs to), so the Router Cache half of
 * `updateTag` no-ops. `revalidateTag(tag, "zeta")` persistently marks
 * the Data Cache entries stale; the user's subsequent navigation pays
 * one SWR refresh and sees fresh data.
 *
 * Do NOT call this from Server Actions — it skips the Router Cache
 * eviction that `updateTag` provides, so the action's own caller would
 * still see stale data until the next full reload.
 */
export function revalidateFinancialViewsFromWebhook() {
  for (const tag of FINANCIAL_TAGS) revalidateTag(tag, "zeta");
}
