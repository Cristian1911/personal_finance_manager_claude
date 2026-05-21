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
 * webhooks (`/api/webhooks/email-ingest`, telegram, cron jobs).
 *
 * `updateTag()` is the right call from Server Actions because it pairs
 * Data Cache eviction with Router Cache eviction for the *initiating
 * client* — the user gets read-your-own-writes on their very next
 * navigation. Route Handlers have no such client attachment: the
 * webhook is initiated by Bancolombia / Telegram / cron, not the user
 * the data belongs to, so there is no Router Cache to flush in the
 * same request. `revalidateTag(tag, "zeta")` persistently marks the
 * Data Cache entries stale; the user's subsequent navigation pays one
 * SWR refresh and sees fresh data. Eventual consistency is acceptable
 * for background-ingested rows.
 *
 * Do NOT call this from Server Actions — it bypasses the Router Cache
 * eviction that `updateTag` provides, so the action's own caller would
 * still see stale data until the next full reload. The `updateTag`
 * path in `revalidateFinancialViews()` is correct for those.
 *
 * Discovered 2026-05-21 when an email-imported transaction appeared on
 * /transactions + /accounts/[id] but was missing from the dashboard
 * hero, because the prior webhook code reused `updateTag` and silently
 * no-op'd outside a Server Action context.
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
