# Zeta Mobile — SQLite/Sync Perf Fix Plan (ordered)

Sequenced so quick high-ROI wins (one-line PRAGMAs, index DDL) land first. Effort: **S** ≤30min, **M** ½–1 day, **L** >1 day.
Each item: **gap → fix → effort**. Independence noted; coupled items grouped.

---

## WAVE 0 — One-liners, big payoff, zero behavior change (do first, in one migration/commit)

These are independent of each other and of everything below. Land them immediately.

### 0.1 — PRAGMA block (PRAGMA-1/2/3/4/5/6, WTX-2/3) — **S**
**Gap:** single connection sets only WAL + foreign_keys; every commit fsyncs (FULL), no busy_timeout, ~2MB cache, no mmap, file temp store.
**Fix:** in `lib/db/database.ts` extract `applyConnectionPragmas(db)` called from `getDatabase()` right after `openDatabaseAsync` (before `runMigrations`):
```sql
PRAGMA busy_timeout = 5000;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;   -- highest single payoff; safe in WAL
PRAGMA foreign_keys = ON;
PRAGMA cache_size = -8000;
PRAGMA mmap_size = 67108864;
PRAGMA temp_store = MEMORY;
```
**Independent.** No data-loss risk (offline cache, source of truth = Supabase).

### 0.2 — Index DDL (IDX-1, IDX-2, IDX-3, IDX-4) — **S**, one migration
**Gap:** missing hot-path indexes; one redundant index.
**Fix (new `schema.ts` migration):**
```sql
CREATE INDEX IF NOT EXISTS idx_transactions_category_date
  ON transactions(category_id, transaction_date);                 -- IDX-1 (budget join, uncategorized)
CREATE INDEX IF NOT EXISTS idx_transactions_account_date
  ON transactions(account_id, transaction_date);                  -- IDX-2 (account-detail, pulse, reconcile)
DROP INDEX IF EXISTS idx_transactions_account;                    -- IDX-2 (prefix-subsumed)
DROP INDEX IF EXISTS idx_transactions_idempotency;               -- IDX-3 (UNIQUE autoindex covers it)
CREATE INDEX IF NOT EXISTS idx_transactions_month_agg
  ON transactions(transaction_date, reconciled_into_transaction_id,
                  is_excluded, direction, account_id, amount);     -- IDX-4 (covering month aggregation)
```
**Independent.** IDX-4 pairs with WAVE 2 (500-row refactor) but helps `getMonthlyAggregates` standalone now. (IDX-4 adds insert cost — keep only if the month-agg path stays SQL-side, which it will after WAVE 2.)

---

## WAVE 1 — P0/P1 hot-path structural wins

### 1.1 — Subscriptions: network → local SQLite (OF-3 / RR-2 / RB-1) — **M**
**Gap:** `subscriptions.tsx:104-148` reads `accounts` + `recurring_transaction_templates` over the network on every focus; spinner for full RTT, broken offline.
**Fix:** replace the two `supabase.from()` reads with `getAllAccounts()` + new `getSubscriptionTemplates()` in `recurring.ts` (`WHERE category_id=? AND direction='OUTFLOW' AND is_active ORDER BY created_at DESC`, explicit columns). Reload from SQLite after writes; keep a background `void sync` to converge. Route writes through `sync_queue` (parity follow-up).
**Independent.** Run `mobile-webapp-parity` gate (touches a synced table's read/write path).

### 1.2 — Dashboard 500-row → SQL aggregation (OF-1 / RB-3) — **M**
**Gap:** `useDashboardData.ts:137` pulls ≤500 rows × 3 JOINs then O(500) JS loop on every focus; renders empty zeros until done.
**Fix:** (a) `getMonthlyAggregates({month})` → build `spentToday/Yesterday/trend7/trend30/totalOutflow/outflowByDate` from its `daysByDate`; (b) `getTransactions({month, limit:20})` for the recent feed. Drop the O(500) loop. Uses IDX-4 (0.2).
**Coupled to 0.2** (covering index). Independent of 1.3 but same pattern.

### 1.3 — PlanRoot slim joinless reader (OF-2) — **M**
**Gap:** `PlanRoot.tsx:81` pulls the 500-row/3-JOIN query but reads none of the joined columns.
**Fix:** add `getMonthTransactionsForPlan(month)` in `transactions.ts` (no JOINs, explicit ~8 cols: id, account_id, amount, direction, transaction_date, is_excluded, transfer_group_id, reconciled_into_transaction_id — verify `computeTimeline`'s exact reads first). Point PlanRoot at it.
**Independent** (verify timeline field needs).

### 1.4 — Focus-reload version gate (RR-1) — **M**
**Gap:** every tab focus re-reads the full dataset + re-aggregates with zero mutations.
**Fix:** module-level `dataVersion` in `engine.ts` (`getDataVersion`/`bumpDataVersion`); bump after `pullAll()` (`engine.ts:63`) + all local mutation paths (centrally after enqueue). Each Root: `loadedVersion` ref gating the focus effect; pull-to-refresh / post-mutation reloads call `load()` directly.
**Independent**, but amplifies 1.2/1.3/RR-3/RR-6 (multiplies their per-focus savings). Land after 1.2/1.3 so the gated load is already cheap.

### 1.5 — Push conditional-write (NP1-02 / sync-1) — **M**
**Gap:** every UPDATE pays a 2nd serial network RTT (`isLocalFresh`) before the write.
**Fix:** drop the pre-read; make the write conditional `sb.from(table).update(payload).eq('id', id).lte('updated_at', payload.updated_at)`; inspect returned row count for staleness. Halves UPDATE round-trips.
**Coupled to 1.6** (both rewrite the push loop — do together).

### 1.6 — Push batching (sync-2) — **M**
**Gap:** queue drains serially, one network call per row (60-line import = 60 RTTs).
**Fix:** group `pending` by (operation, table); `.insert(rowsArray)` in chunks ~500 (23505 → per-row fallback for that batch only), `.delete().in('id', ids)`; single batched `UPDATE sync_queue SET synced_at WHERE id IN (...)` (also covers WTX-4). `transaction_tags` REPLACE stays per-record.
**Coupled to 1.5.**

### 1.7 — `transaction_tags` windowed pull (sync-3) — **M**
**Gap:** full DELETE-ALL + re-fetch-ALL on every sync; unbounded.
**Fix:** window by `transaction_id IN (windowTxIds)` from the just-pulled transactions window; DELETE locally only those ids. Long-term: add `updated_at` for incremental cursor.
**Independent.**

### 1.8 — Import single-transaction wrap (WTX-1) — **M**
**Gap:** `createTransaction()` opens its own transaction per row (+ a 2nd for merges) → up to 2N fsyncs per import.
**Fix:** extract `insertTransactionInTx(db, params, now)` + `applyReconciliationMergeInTx(db, ...)` (no wrapper); wrap the whole loop in `import.tsx:758-851` / `capture-screenshot.tsx:210-230` in ONE `withTransactionAsync`. Keep public `createTransaction` for single-row callers.
**Independent** (but multiplies with 0.1's `synchronous=NORMAL`).

### 1.9 — Import reconciliation pool-once (NP1-01) — **M**
**Gap:** 2N SQLite queries per statement; `getReconciliationCandidateById` re-fetches an in-memory row.
**Fix:** add `getReconciliationPoolForAccount(accountId, monthSet)` (single query), loop parsed rows in JS via `findReconciliationCandidates`; have the matcher return the candidate object — delete `getReconciliationCandidateById`.
**Independent.** Combine with 1.8 (same import path / commit).

---

## WAVE 2 — P1/P2 sync + redundant-read polish

### 2.1 — Parallel pull fetch (sync-4) — **M**
**Gap:** 20 tables fetched serially → ~20×RTT even when empty.
**Fix:** two-phase — fan out fetches with `Promise.all` (concurrency cap ~5), then write serially in FK order inside per-table transactions (unchanged). Batch-load cursors once up front. **Independent.**

### 2.2 — Cursor = max server `updated_at` (sync-5) — **S**
**Gap:** cursor advanced with device clock vs server-clock filter → skew skips/re-pulls rows.
**Fix:** track `maxUpdatedAt` over fetched rows, write that (fall back to prior cursor on empty page). **Independent.** (Correctness + perf.)

### 2.3 — Movimientos split reference/feed loads (RR-3) — **M**
**Gap:** 5 session-invariant reference reads on every month/filter/search change.
**Fix:** `loadReference` (deps []) gated by the 1.4 version flag + `loadFeed` (deps [debouncedSearch, month, accountId]). **Coupled to 1.4.**

### 2.4 — Reference-table module caches (RR-4, RR-6) — **M**
**Gap:** categories/destinatarios/accounts re-scanned per focus.
**Fix:** mirror `profile.ts` cache; invalidate categories/destinatarios from `pull.ts` after those tables apply; invalidate accounts via `bumpDataVersion()`. **Coupled to 1.4/1.7.** Largely subsumed by 1.4 — do only if profiling still shows cost.

### 2.5 — `debtAccountIds` param (OF-7 / RR-5) — **S**
**Gap:** `getMonthlyAggregates` re-queries accounts for debt IDs every call.
**Fix:** optional `debtAccountIds?: Set<string>`; callers with accounts already loaded pass it; keep self-contained fallback. **Independent.**

### 2.6 — PaymentSheet candidate search → local (RB-2) — **S**
**Gap:** network read blocks the sheet on Plan→Pagar.
**Fix:** `getTransactions({month, limit:50})` + JS filter (add `is_excluded`). **Independent.**

### 2.7 — Pull multi-row upsert (NP1-03 / WTX-5 / sync-6) — **M**
**Gap:** per-row INSERT-OR-REPLACE → thousands of bridge round-trips on heavy sync.
**Fix:** chunked multi-row VALUES (≤ floor(999/colCount)) grouped by column-signature; per-batch row-by-row fallback preserves skip-invalid-row. **Independent.**

### 2.8 — `deleteAccount` set-based deletes (NP1-04) — **S**
**Gap:** 2N delete statements for child transactions.
**Fix:** `DELETE FROM sync_queue WHERE record_id IN (SELECT id FROM transactions WHERE account_id=?)` + `DELETE FROM transactions WHERE account_id=?`, wrapped in `withTransactionAsync` (add one — not currently wrapped). Verify remote FK ON DELETE CASCADE. **Independent.**

---

## WAVE 3 — P3 hygiene (opportunistic, when touching the file)

- **OF-4/OF-5/OF-6** — replace `SELECT *` with explicit column lists (recurring templates, planning, reference tables). **S each.**
- **PRAGMA-6** — already folded into 0.1's helper extraction.
- **IDX-5/IDX-6** — leave as-is; re-key only if those small tables grow. Optional `idx_recurring_occurrences_date`.
- **NP1-05/NP1-06** — correlated subqueries → derived-table GROUP BY joins; nested INSERT/DELETE loops → set-based. Tiny N. **S each.**
- **sync-7** — push `LIMIT 500` drain loop + attempt counter / dead-letter column. **M.**
- **WTX-4 (prune)** — `DELETE FROM sync_queue WHERE synced_at IS NOT NULL` periodically (bounds the table read fully every sync). Fold into 1.6. **S.**

---

## Dependency / independence summary

- **Fully independent (parallelizable now):** 0.1, 0.2, 1.1, 1.7, 1.8, 1.9, 2.1, 2.2, 2.5, 2.6, 2.7, 2.8, all WAVE 3.
- **Coupled pairs/groups:**
  - 0.2 (IDX-4) ⟷ 1.2 (Dashboard SQL agg) — index makes the refactor index-only.
  - 1.5 ⟷ 1.6 — both rewrite the push loop; do in one change.
  - 1.4 → 2.3, 2.4 — the version gate is the prerequisite for the split/cached reads.
  - 1.8 + 1.9 — same import path/commit.
- **Recommended first commit:** WAVE 0 (0.1 + 0.2) — pure config/DDL, no behavior change, immediate app-wide write+read speedup. Then 1.1 (worst offline-first leak), then 1.2/1.3 (kill the 500-row JS aggregation), then the push/sync batch (1.5/1.6/1.7), then the focus gate (1.4).
