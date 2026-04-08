# HANDOVER — 2026-04-08 (Performance Audit)

## 1. Session Summary

Performance audit triggered by slow "Ver detalle" navigation on the movimientos page. Traced root cause to missing loading states, eager data fetching, and a critical encryption compatibility bug where `createAdminClient()` in `"use cache"` functions returned NULL for all encrypted columns post-envelope-encryption. Fixed all 14 affected action files, introduced `createCachedClient(accessToken)` pattern, optimized `zeta_decrypt()` with DEK session caching, added Suspense splitting to the transaction detail page, and cached transaction queries. Also fixed a broken PostgREST join and updated the transaction row expanded view to use icon-only action buttons.

## 2. Changes Made

### Infrastructure — Cached client pattern
- **`webapp/src/lib/supabase/cached.ts`** — Created. New `createCachedClient(accessToken)` that creates a Supabase client with user JWT for use inside `"use cache"` functions.
- **`webapp/src/lib/supabase/auth.ts`** — Modified. `getAuthenticatedClient()` now returns `{ supabase, user, accessToken }` (backward-compatible addition). Fast path extracts token from `getSession()`.

### DB optimization — DEK caching
- **`supabase/migrations/20260408143011_optimize_zeta_decrypt_dek_cache.sql`** — Created. `zeta_decrypt()`, `zeta_encrypt()`, and `zeta_hmac()` now cache the decrypted DEK in a transaction-local session variable via `set_config('zeta.cached_dek', ...)`. First call does vault+DEK lookup; subsequent calls skip it. Benchmarked: accounts query 17.3ms → 8.4ms (-52%).

### Encryption compatibility — 14 action files fixed
All `"use cache"` functions that query encrypted views switched from `createAdminClient()` to `createCachedClient(accessToken)`:
- **`webapp/src/actions/accounts.ts`** — Restored `"use cache"` with token-based client
- **`webapp/src/actions/destinatarios.ts`** — Restored `"use cache"` for main reads; `fetchDestinatarioRules()` exported for shared use
- **`webapp/src/actions/categorize.ts`** — All 5 cached functions + `getDestinatarioSuggestionsForInbox()` updated
- **`webapp/src/actions/debt.ts`** — `getDebtOverviewCached` updated
- **`webapp/src/actions/recurring-templates.ts`** — All 4 cached functions updated
- **`webapp/src/actions/statement-snapshots.ts`** — Both cached functions updated
- **`webapp/src/actions/profile.ts`** — Both cached functions updated
- **`webapp/src/actions/debt-countdown.ts`** — `getDebtFreeCountdownCached` updated
- **`webapp/src/actions/cashflow-planner.ts`** — All cached functions updated
- **`webapp/src/actions/scenarios.ts`** — `getScenariosCached` updated
- **`webapp/src/actions/attention-items.ts`** — `getAttentionItemsCached` updated
- **`webapp/src/actions/payment-reminders.ts`** — `getUpcomingPaymentsCached` updated
- **`webapp/src/actions/income.ts`** — `getEstimatedIncomeCached` updated

### Transaction detail page — Suspense + loading
- **`webapp/src/app/(dashboard)/transactions/[id]/loading.tsx`** — Created. Skeleton matching page structure.
- **`webapp/src/app/(dashboard)/transactions/[id]/page.tsx`** — Rewritten. Only `getTransaction(id)` blocks initial render. Edit button (`TransactionEditAction`) and sidebar (`TransactionSidebar`) deferred via `<Suspense>`. Page now renders as PPR.

### Transaction caching + PostgREST fix
- **`webapp/src/actions/transactions.ts`** — `getTransactions()` and `getTransaction()` now use `"use cache"` with `cacheTag("transactions")`. Added `"transactions"` to `revalidateFinancialViews()`. PostgREST join fixed with explicit FK hints: `accounts!transactions_account_id_fkey`, `categories!transactions_category_id_fkey`, `destinatarios!transactions_destinatario_id_fkey`.

### UI — Transaction row expanded view
- **`webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx`** — Expanded view now uses icon-only action buttons (`UserRound`, `Hash`, `Pencil`) matching CategorizarDetail style. Category/destinatario shown as chips when present, as action links when missing.
- **`webapp/src/components/mobile/v2/movimientos/movimientos-herramientas.tsx`** — CategorizarDetail expanded view updated to same flat chip layout: `[Categoría picker] [👤] [#] ——— [✏️]`. CategoryZonePicker placeholder changed to "Categoría".

### CLAUDE.md rules
- **`CLAUDE.md`** — Added three new sections: **Performance Rules** (cache stable data, justify new queries, Suspense for non-critical data), **UI Rules** (no hardcoded colors, reuse design tokens from TOKENS.md, reuse existing components), and two Gotchas (PostgREST FK hints through encrypted views, `"use cache"` + encryption pattern).

## 3. Key Decisions

- **`createCachedClient(accessToken)` over alternatives**: Considered (a) removing all caching, (b) passing supabase client directly, (c) impersonation via admin client. Chose token-based client because it preserves `"use cache"` cross-request caching while providing `auth.uid()` for decryption. Cache entries auto-expire with JWT rotation (~1h).
- **Explicit FK hints over schema reload**: PostgREST can't auto-detect FK relationships through `security_invoker` encrypted views. `NOTIFY pgrst, 'reload schema'` was tried but didn't help. Explicit `!fk_name` syntax is the reliable solution.
- **Suspense split over full page cache**: Transaction detail page defers accounts/categories/destinatarios/tags behind `<Suspense>` rather than loading everything eagerly. The hero renders with just `getTransaction()` (~3ms).
- **Icon-only action buttons**: User explicitly requested no text labels for Destinatario (👤) and Etiquetar (#). Pencil icon (✏️) pushed to the right with `flex-1` spacer.
- **Inline pickers deferred**: User wants 👤, #, and ✏️ to open drawer pickers inline instead of navigating to `/transactions/[id]`. Agreed to implement as follow-up.

## 4. Current State

- **Build**: `pnpm build` passes clean
- **Branch**: `feat/mobile-polish`
- **Migration**: `20260408143011_optimize_zeta_decrypt_dek_cache.sql` deployed to Supabase
- **Uncommitted changes**: ~30 files modified (this session + another agent's parallel work on plan/landing page)
- **Another agent** was working on plan page and landing page changes simultaneously — those files are also modified but untouched by this session

## 5. Open Issues & Gotchas

- **Remaining `createAdminClient` users are safe**: `charts.ts`, `categories.ts`, `budgets.ts`, `burn-rate.ts`, `exchange-rate.ts`, `attention.ts`, `email-pdf-ingest.ts`, `product-events.ts`, `plan-timeline.ts` still use `createAdminClient()` but only query non-encrypted columns. No action needed unless they start selecting encrypted fields.
- **PostgREST FK hints required everywhere**: Any new PostgREST join through an encrypted view MUST use `!fk_name` syntax. This is documented in CLAUDE.md Gotchas but easy to forget.
- **Transaction row actions are Links, not drawers**: The 👤, #, and ✏️ icon buttons currently navigate to `/transactions/[id]` instead of opening inline pickers. User explicitly requested inline drawers as follow-up.
- **`TransactionWithAccount` type may need update**: The `getTransactions` query now joins `category` and `destinatario`, but the `TransactionWithAccount` type in `domain.ts` may not reflect these new fields. The data arrives via `as unknown as TransactionWithAccount` cast. Check `webapp/src/types/domain.ts` for the type definition.
- **`plan-timeline.ts`** uses `createAdminClient()` outside `"use cache"` — it's a read helper, not cached. If it queries encrypted columns, it needs the same fix but with the authenticated client directly (no cache needed).

## 6. Suggested Next Steps

1. **Inline drawer pickers** — Create `LazyDestinatarioPicker` and `LazyTagPicker` that fetch data on open via server actions, render in a `<Drawer>`. Wire to the 👤 and # icon buttons in both `movimientos-transaction-row.tsx` and `movimientos-herramientas.tsx`. Consider a drawer edit form for ✏️ too.
2. **Update `TransactionWithAccount` type** — Add `category` and `destinatario` optional fields to match the new PostgREST join in `getTransactions()`.
3. **Verify movimientos page works** — The PostgREST FK hint fix + schema reload should restore the transaction list. Confirm visually that transactions load and the expanded row chips render correctly.
4. **Commit this work** — Large changeset across 30+ files. Consider splitting into 2-3 commits: (a) encryption compat + caching infra, (b) transaction detail perf, (c) UI polish.
5. **Audit other pages for eager loading** — The Suspense pattern used on `/transactions/[id]` could benefit other pages that load edit-form data eagerly (accounts detail, destinatario detail, etc.).

## 7. Context for Claude

- **Migration already deployed**: `20260408143011` is live on Supabase `tgkhaxipfgskxydotdtu`. Don't re-push.
- **`accessToken` is backward-compatible**: Adding it to `getAuthenticatedClient()` return type doesn't break existing `const { supabase, user } = ...` destructuring — the new field is simply ignored.
- **`"use cache"` key includes all args**: The `accessToken` (~1h JWT) becomes part of the cache key, so cache entries auto-expire on token refresh. This is intentional — not a bug.
- **`fetchDestinatarioRules`** is now exported from `destinatarios.ts` (was private `getDestinatarioRulesCached`). It accepts a `supabase` client parameter and is used by both `destinatarios.ts` and `categorize.ts`.
- **Design tokens**: `docs/design-system/TOKENS.md` is the canonical reference for all colors and spacing. CLAUDE.md now enforces this.
