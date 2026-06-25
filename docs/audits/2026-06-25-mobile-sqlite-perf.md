# Zeta Mobile — SQLite + Sync Data-Layer Performance Audit

**Date:** 2026-06-25
**Scope:** `lib/db/*`, `lib/repositories/*`, `lib/sync/*`, `lib/dashboard/useDashboardData.ts`, `lib/profile.ts`, and hot-screen data-load hooks (Inicio / Plan / Movimientos / Subscriptions / Import).
**Out of scope:** render/UI (FlatList/memo/Reanimated) — covered by a separate render-perf pass.
**Symptom under investigation:** production Android (Hermes on) "feels slow" — not a debug-build artifact.

---

## Executive Summary

**46 findings** across 7 dimensions, severity-corrected after verification against real source.

| Severity | Count | Meaning |
|----------|-------|---------|
| **P0** | 2 | Blocks UI thread / full-table-scan-class waste on a hot path on every focus |
| **P1** | 15 | Significant over-fetch, N+1, missing hot-path index, or network-on-hot-path leak |
| **P2** | 16 | Moderate inefficiency / robustness gap |
| **P3** | 13 | Micro-opt / forward-compat hygiene |

### The systemic levers (fix these first — they dominate the felt slowness)

1. **PRAGMA tuning (one block, ~7 lines, app-wide).** The single cached connection sets only `journal_mode=WAL` + `foreign_keys=ON`. Missing `synchronous=NORMAL` means **every commit fsyncs** (write-heavy sync pull + every mutation), and missing `busy_timeout` turns transient WAL-checkpoint lock collisions into thrown errors. `synchronous=NORMAL` is the highest-value single line in this whole audit. (PRAGMA-1/2/3/4/5/6, dup as WTX-2/WTX-3.)

2. **500-row fetch → SQL aggregation.** Both the Home dashboard (`useDashboardData`) and Plan (`PlanRoot`) run `getTransactions({limit:500})` — `SELECT t.*` across 3 LEFT JOINs (~46 cols × 500 rows ≈ 23k cells over the Hermes bridge) — then do an **O(500) JS aggregation loop on every tab focus**. The data they actually need is per-day sums (already produced correctly by `getMonthlyAggregates`) plus a 20-row preview. ~95% bridge-volume reduction. (OF-1, OF-2, RB-3.)

3. **Missing aggregation/join indexes.** No `transactions(category_id)` (budget join scans the whole table per category on every Plan focus), no `(account_id, transaction_date)` composite (account-detail 5000-row pull does index-scan + filesort), no covering index for the month aggregation. (IDX-1, IDX-2, IDX-4.)

4. **Network-on-hot-path leaks (offline-first violations).** The Subscriptions screen reads `accounts` + `recurring_transaction_templates` **over the network on every focus** despite both being mirrored in local SQLite, and the PaymentSheet candidate search hits Supabase instead of SQLite. Blocks render and breaks offline. (RB-1/OF-3/RR-2, RB-2.)

5. **Sync network N+1s.** Push drains the queue one row at a time, and every UPDATE pays a **second** serial network round-trip (`isLocalFresh`) before the write — 2K RTTs to drain K offline edits. Pull fetches 20 tables strictly serially. `transaction_tags` is a full DELETE-ALL + re-fetch on every sync. These make the app slow-to-converge after edits. (sync-1/2/3/4, NP1-02.)

6. **No focus-reload gate.** Every `useFocusEffect` re-reads the full screen dataset on every tab return even with zero mutations. A module-level data-version flag eliminates the most-repeated redundant work in the app. (RR-1, plus RR-3/4/5/6.)

### Highest-ROI ordering
PRAGMA block (one line of real payoff: `synchronous=NORMAL`) → 3 indexes → 500-row→SQL refactor → Subscriptions local-read → focus gate → sync batching. PRAGMA + indexes are one-liners with big payoff and are independent of everything else.

---

## Dimension 1 — PRAGMA configuration

**Root finding:** the single cached connection (`lib/db/database.ts:4-22`, only `openDatabaseAsync` in the repo) sets PRAGMAs in `runMigrations()` (`database.ts:24-26`) but only `journal_mode=WAL` (persistent) and `foreign_keys=ON` (per-connection). Everything else is at its default.

**Recommended per-connection block, in order:**
```sql
PRAGMA busy_timeout = 5000;   -- first; the WAL switch itself can lock
PRAGMA journal_mode = WAL;    -- already present
PRAGMA synchronous = NORMAL;  -- highest value; safe only because WAL is on
PRAGMA foreign_keys = ON;     -- already present
PRAGMA cache_size = -8000;    -- 8MB
PRAGMA mmap_size = 67108864;  -- 64MB
PRAGMA temp_store = MEMORY;
```
No data-loss risk for an offline cache whose source of truth is Supabase. Orthogonal and additive to the index/aggregation fixes.

| ID | Sev | Title |
|----|-----|-------|
| PRAGMA-1 | **P1** | Missing `synchronous=NORMAL` — every write pays a full fsync. Write-heavy sync pull (`pull.ts:199,225`), queue inserts (`queue.ts:14,28,41`), push acks (`push.ts:166`) each fsync on commit. Single highest-value change. Must follow the WAL line. |
| PRAGMA-2 | P2 | Missing `busy_timeout` (default 0) — SQLITE_BUSY throws instantly instead of retrying. With one serialized connection this is robustness vs. WAL-checkpoint contention more than throughput (downgraded from P1). Set FIRST. |
| PRAGMA-3 | P2 | Missing `cache_size` (~2MB default) — repeated 500-row scans + aggregation hit the same pages back-to-back on one mount. Raise to 8MB (~6MB cost). |
| PRAGMA-4 | P2 | Missing `mmap_size` — reads go through `read()` syscalls instead of mmap. Bounded 64MB; effective value capped by build `SQLITE_MAX_MMAP_SIZE` + file size (harmless if smaller). |
| PRAGMA-5 | P3 | Missing `temp_store=MEMORY` — GROUP BY/ORDER BY without covering index spill transient b-trees to disk. Month-windowed result sets are tiny so RAM cost negligible. |
| PRAGMA-6 | P3 | Consolidate per-connection PRAGMAs into one `applyConnectionPragmas(db)` helper called from `getDatabase()` after `openDatabaseAsync`. Correct today (single connection); future-proofs against a second connection silently reverting non-persistent PRAGMAs. |

---

## Dimension 2 — Index coverage

Cross-checked the 32 existing indexes against every WHERE/ORDER/JOIN in repos + dashboard + Plan.

| ID | Sev | Title & fix |
|----|-----|-------------|
| IDX-1 | **P1** | **No `transactions(category_id)` index.** `getBudgetProgress` (`budgets.ts:35-38`) LEFT JOINs transactions on `category_id` per category row on every Plan focus → per-category scan or transient AUTOMATIC INDEX. Also hits `getTransactions({categoryId})` and the `category_id IS NULL` uncategorized lookups. Fix: `CREATE INDEX idx_transactions_category_date ON transactions(category_id, transaction_date)` (SQLite indexes NULLs, so IS NULL benefits too). |
| IDX-2 | **P1** | **No `(account_id, transaction_date)` composite.** `getBalanceHistory` (`accounts-detail.ts:36-45`, LIMIT 5000) + `getSpendingPulse` + reconciliation candidates only get single-col `idx_transactions_account` → full account scan + filesort. Fix: `CREATE INDEX idx_transactions_account_date ON transactions(account_id, transaction_date)` then `DROP INDEX idx_transactions_account` (prefix subsumes it). |
| IDX-3 | P2 | **`idx_transactions_idempotency` is redundant** — `idempotency_key TEXT UNIQUE` already auto-indexes the column. Double b-tree maintenance on the highest-volume write path (import). Fix: `DROP INDEX idx_transactions_idempotency` (keep the UNIQUE constraint). |
| IDX-4 | P2 | **No covering index for the month aggregation.** `getMonthlyAggregates` does a row lookup per matching row. Fix: `CREATE INDEX idx_transactions_month_agg ON transactions(transaction_date, reconciled_into_transaction_id, is_excluded, direction, account_id, amount)` → index-only scan. Pairs with the OF-1/OF-2 refactor. (6-col index adds insert cost — moderate tradeoff.) |
| IDX-5 | P3 | `user_id`-prefixed composites unusable on single-user mobile (queries filter only the 2nd column). Dead weight on writes. Leave as-is unless tables grow; if so, re-key on the actually-filtered column. |
| IDX-6 | P3 | `occurrence_date`-only month queries (`getOccurrencesForMonth`, `getRecurringSummary`) have no usable index (existing ones are status-/template-prefixed). Optional `idx_recurring_occurrences_date(occurrence_date)`; table is small. |

---

## Dimension 3 — Over-fetch

Two P0s share one root cause; both Dashboard and Plan pull 500 joined rows then aggregate in JS.

| ID | Sev | Title & fix |
|----|-----|-------------|
| OF-1 | **P0** | **Dashboard pulls ≤500 rows × ~46 cols (SELECT t.* + 3 JOINs) then O(500) JS aggregation on every focus** (`useDashboardData.ts:137,194-231,302-322`). Only the first 20 rows use the joins (recent feed); the rest is per-day OUTFLOW sums. Fix: `getMonthlyAggregates({month})` for totals/per-day buckets + `getTransactions({month, limit:20})` for the feed. ~95% bridge reduction, removes the O(500) loop. |
| OF-2 | **P0** | **PlanRoot pulls the same 500-row/3-JOIN query but reads NONE of the joined columns** (`PlanRoot.tsx:81,146-166`); `computeTimeline` receives accounts separately. Fix: add a slim joinless `getMonthTransactionsForPlan(month)` returning only the ~8 columns the discretionary loop + timeline read. |
| OF-3 | P1 | **Subscriptions reads `accounts` + `recurring_transaction_templates` over the NETWORK every focus** (`subscriptions.tsx:114-130,145-149`) despite local SQLite copies. Fix: `getAllAccounts()` + a local `getSubscriptionTemplates()`. (Mutations also bypass `sync_queue` — see sync dimension.) |
| OF-4 | P2 | 5× `SELECT *` on `recurring_transaction_templates` (`recurring.ts:83,92,102,114,757`). Replace with a shared explicit column-list const matching `RecurringTemplateRow`. |
| OF-5 | P2 | `SELECT *` on planning periods/entries/assignments (`planning.ts:55,69,82`). Swap for the enumerated row-shape columns. |
| OF-6 | P3 | Reference-table `SELECT *` (categories `:19`, tag_groups `:33`, accounts `:62`). Small tables; restrict to rendered columns opportunistically. |
| OF-7 | P3 | `getMonthlyAggregates` issues a 2nd unscoped `SELECT id FROM accounts WHERE account_type IN (...)` per call (`transactions.ts:359-362`). Accept optional `debtAccountIds?: Set<string>` from callers that already loaded accounts. |

**Confirmed good patterns (do not change):** `getMonthlyAggregates`, `getBudgetProgress`, `getRecurringSummary` (SQL SUM/GROUP BY), `MovimientosRoot` (paginated PAGE_SIZE=25 + SQL aggregates + `getTopUncategorized(limit:5)`). These are the templates the P0 fixes should mirror.

---

## Dimension 4 — N+1

| ID | Sev | Title & fix |
|----|-----|-------------|
| NP1-01 | **P1** | **Import preview runs 2N SQLite queries per statement** (`import.tsx:633-682`): per row `getReconciliationCandidates` (re-scans the same account+month pool N times) + `getReconciliationCandidateById` (re-fetches a row already in memory — pure waste). Fix: fetch the candidate pool ONCE per statement, match in JS, and have the matcher return the candidate object instead of just an id. |
| NP1-02 | **P1** | **Push freshness check is a network N+1**: every UPDATE awaits `isLocalFresh()` (a `select('updated_at')`) before the `.update()` → 2K serial RTTs for K edits. Fix: batch freshness with one `.in('id', ids)` per table, OR drop the pre-read and make the write conditional `.update(payload).lte('updated_at', payload.updated_at)`. (Same as sync-1.) |
| NP1-03 | P2 | **Pull upserts row-by-row** (`pull.ts:208-239`) — up to ~2000 single INSERT-OR-REPLACE statements per sync (one commit, but N prepared-statement round-trips). Fix: chunked multi-row VALUES (≤ floor(999/colCount) rows), per-batch row-by-row fallback for a throwing batch. |
| NP1-04 | P2 | **`deleteAccount` deletes child transactions one row at a time** (`accounts.ts:205-211`) — 2N statements. Fix: two set-based deletes via `WHERE ... IN (SELECT id FROM transactions WHERE account_id=?)`, wrapped in `withTransactionAsync` (not currently wrapped). |
| NP1-05 | P3 | Correlated per-row subqueries in `getAllDestinatarios` (COUNT) and `getActivePersonalDebts` (SUM). Bounded N + indexed probes. Convert to derived-table GROUP BY joins when convenient. |
| NP1-06 | P3 | Nested per-tag INSERT loops + per-occurrence DELETE loops in recurring payment / paid-off cleanup. Tiny N inside one transaction. Optional multi-row INSERT + set-based DELETE. |

**Not N+1 (verified):** `transactions.ts`, `debt.ts`, `planning.ts`, `ledger-helpers.ts`, `budgets.getBudgetProgress` — single set-based queries. The Dashboard/Plan 500-row aggregation is over-fetch (single query), not N+1.

---

## Dimension 5 — Redundant reads

| ID | Sev | Title & fix |
|----|-----|-------------|
| RR-1 | **P1** | **Every tab focus re-reads the full dataset + re-aggregates with no dirty/version gate** (`useDashboardData.ts:375-379`, `PlanRoot.tsx:186-190`, `MovimientosRoot.tsx:157-161`). Fix: module-level `dataVersion` in `engine.ts`, `bumpDataVersion()` after `pullAll()` (`engine.ts:63`) + local mutations; gate each focus effect with a `loadedVersion` ref. Pull-to-refresh / post-mutation reloads call `load()` directly. |
| RR-2 | **P1** | Subscriptions network read on every focus (same as OF-3 / RB-1). Run `mobile-webapp-parity` gate. |
| RR-3 | P2 | **Movimientos re-reads 5 session-invariant reference datasets on every month/filter/search change** (`MovimientosRoot.tsx:103-155`). Fix: split `loadReference` (deps []) from `loadFeed` (deps [debouncedSearch, month, accountId]). |
| RR-4 | P2 | No module cache for immutable-per-session reference tables (categories, destinatarios). Fix: mirror the `lib/profile.ts` cache pattern with invalidators fired from `pull.ts` after those tables apply. |
| RR-5 | P2 | `getMonthlyAggregates` re-queries accounts for debt IDs even when the caller already holds accounts (`transactions.ts:359-362`; MovimientosRoot reads accounts twice per reset). Optional `debtAccountIds` param (same as OF-7). |
| RR-6 | P3 | `getAllAccounts` re-read by all three Roots per tab switch. Back with a module cache invalidated by the same `bumpDataVersion()` signal. Largely subsumed by RR-1's gate. |

**Only existing cache:** `getPreferredCurrency` (`profile.ts:67-79`) — local + in-memory. Use as the template.

---

## Dimension 6 — Render-blocking (offline-first leaks)

| ID | Sev | Title & fix |
|----|-----|-------------|
| RB-1 | **P1** | Subscriptions screen gates the whole screen behind 2 Supabase reads on every focus (`subscriptions.tsx:104-148`); spinner for full RTT, non-functional offline. Fix: local SQLite reads (same as OF-3/RR-2). |
| RB-3 | **P1** | Dashboard hook awaits a 500-row local read + full O(n) JS aggregation before first paint, on every focus, with no skeleton — renders empty zeros until done (`useDashboardData.ts:135-235,302-322`). Fix: SQL `GROUP BY transaction_date` for trends (~30 rows) + separate `limit 20` recent list + `idx_transactions_month_agg` covering index. (Same refactor as OF-1.) |
| RB-2 | P2 | PaymentSheet candidate search blocks the sheet on a network `supabase.from('transactions')` read (`PaymentSheet.tsx:102-169`) instead of local `getTransactions({month, limit:50})`. Interaction-triggered (lower severity) but a real offline-first leak on Plan→Pagar. Add `is_excluded` to the JS filter. |

**Verified local-first (no finding):** `_layout.tsx` onboarding (local + background re-check), `layout-storage.loadDashboardLayout`, `getPreferredCurrency`, `periodo.tsx`.

---

## Dimension 7 — Write-transaction efficiency

| ID | Sev | Title & fix |
|----|-----|-------------|
| WTX-1 | **P1** | **Batch import inserts one row per SQLite transaction** — `createTransaction()` opens its own `withTransactionAsync` per row (`transactions.ts:198`), and the PDF path adds a 2nd transaction per merge row (`applyReconciliationMerge`, `:490`). A 100-row import = up to 2N fsyncs. Fix: extract no-transaction inner helpers and wrap the WHOLE import loop (`import.tsx:758-851`, `capture-screenshot.tsx:210-230`) in ONE `withTransactionAsync` → one fsync. |
| WTX-2 | **P1** | `synchronous` defaults to FULL — every mutation fsyncs. Set `NORMAL` (safe in WAL). One line, app-wide. (Same as PRAGMA-1; optionally add `wal_autocheckpoint=1000`.) |
| WTX-3 | P3 | No `busy_timeout` (downgraded from P2 — single serialized expo-sqlite connection makes cross-writer SQLITE_BUSY largely a non-issue; cheap defensive add). (Same as PRAGMA-2.) |
| WTX-4 | P3 | Push stamps each row synced in its own UPDATE (`push.ts:164-171`) — one commit/fsync per pushed row. Batch the stamp via `WHERE id IN (...)` after the loop. Network RTT dominates the per-row fsync, so wall-clock win is marginal; the real issue is unbounded `sync_queue` growth (read fully every sync at `push.ts:85`) — add a prune of `synced_at IS NOT NULL` rows. |
| WTX-5 | P3 | Pull uses per-row INSERT-OR-REPLACE inside the (good) per-table transaction (`pull.ts:318`) — bridge/CPU overhead only; fsync already amortized. Optional multi-row VALUES batching. (Same as NP1-03.) |

**Confirmed good (no finding):** all ledger mutations (`registerPayment`/`createTransfer`/`reconcile`/`recordRecurringOccurrencePayment`) wrap writes + balance update + enqueue in ONE transaction; `pull.ts` wraps per-table upserts in one transaction; single-row repo writes coalesce their enqueue.

---

## Dimension 8 — Sync-engine efficiency

Architecture is sound (push-before-pull, incremental `updated_at` cursor, windowed transactional tables, paginated fetch, FK-off during pull). Problems are in the network round-trip pattern, not the SQLite writes. None block the UI thread (`syncAll` is fire-and-forget), so severities cap at P1.

| ID | Sev | Title & fix |
|----|-----|-------------|
| sync-1 | **P1** | Push freshness check = 2 serial RTTs per UPDATE (`push.ts:49-76,115-131`). Fix: conditional write `.update(payload).lte('updated_at', payload.updated_at)` (direction correct: local wins when localTime≥remoteTime) — eliminates the pre-read atomically. (Same as NP1-02.) |
| sync-2 | **P1** | Push queue drains serially, one network call per row (`push.ts:93-175`); a 60-line import = 60 serial RTTs. Fix: group by (operation, table); array `.insert()` in chunks of ~500, `.in('id', ids)` delete, batched `synced_at` stamp. (REPLACE rows for `transaction_tags` stay per-record.) |
| sync-3 | **P1** | **`transaction_tags` full-replaced (DELETE ALL + re-fetch ALL) on every sync** — in `FULL_REPLACE_TABLES`, not windowed, no `updated_at` (`pull.ts:61-67,206`). Unbounded, never shrinks. Fix: window by `transaction_id IN (windowTxIds)`, or add an `updated_at` for the incremental cursor. Largest recurring payload per sync. |
| sync-4 | P2 | Pull fetches 20 tables strictly serially (`pull.ts:118-119`) → ~20×RTT even on empty deltas. FKs are OFF during pull so fetch order is unconstrained. Fix: two-phase — parallel fetch (concurrency cap ~5) then serial FK-ordered writes. |
| sync-5 | P2 | Cursor advanced with **client wall-clock** (`pull.ts:252`) but filters server `updated_at` (`:179`) → clock-skew silently skips rows (device behind) or re-pulls (device ahead). Fix: advance to max observed server `updated_at`, fall back to prior cursor on empty page. (Correctness + perf.) |
| sync-6 | P2 | Pull upserts row-by-row (`pull.ts:318`) — bridge round-trips; fsync amortized by the transaction. Multi-row chunked INSERT with per-batch fallback. (Same as NP1-03/WTX-5.) |
| sync-7 | P3 | Push has no batch cap (`push.ts:85`, unbounded drain) and permanently-failing rows (RLS reject) re-network every sync forever. Fix: `LIMIT 500` + drain loop; attempt counter + dead-letter after N failures. |

---

## Cross-dimension overlap map (fix once, credit many)

- **`synchronous=NORMAL`** = PRAGMA-1 = WTX-2 (one line).
- **`busy_timeout`** = PRAGMA-2 = WTX-3.
- **500-row → SQL aggregation** = OF-1 + OF-2 + RB-3 (Dashboard + Plan).
- **Subscriptions local read** = OF-3 = RR-2 = RB-1.
- **Push conditional-write** = NP1-02 = sync-1.
- **Pull multi-row batching** = NP1-03 = WTX-5 = sync-6.
- **`debtAccountIds` param** = OF-7 = RR-5.
- **Multi-row upsert** in pull repeated across NP1-03/WTX-5/sync-6.
