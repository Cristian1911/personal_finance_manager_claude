# Parity fix scoping — Resumen del mes aggregates + Hero "ritmo"

Two ❌ CRITICAL findings from the live walkthrough (BACKLOG 2026-05-21, PR #260).

## Finding 1 — Resumen del mes aggregates diverge 7-33×

### Root cause (one bug per side, not a definition mismatch)

The walkthrough hypothesis — "different time window or different exclusion semantics" — turned out to be wrong. The INGRESOS / GASTOS filter logic is **identical** on both surfaces (both correctly exclude debt-account INFLOWs and `is_excluded` rows, both filter reconciled rows). The divergence is two separate bugs:

**Mobile bug — MOVIMIENTOS count includes excluded transactions**
- Where: `mobile/lib/repositories/transactions.ts:310`
- The raw `COUNT(*)` for the month omits the `is_excluded = 0` predicate that the totals queries (lines 311-316) correctly apply. So if the user has 1,259 excluded txns (transfers between own accounts, reconciliation-merged duplicates, etc.) plus 112 real txns, mobile reports **1,371**. The aggregates beside it are correct because those queries DO filter.
- Wait — the live walkthrough showed mobile=112 and webapp=1.371. The agent's spec table flipped these. Re-reading: the agent said "Mobile shows 1,371" while the walkthrough showed Mobile=112. **Verify by reading line 310 directly before fixing.**
- Fix size: **one-line SQL change** — add `AND is_excluded = 0` to the COUNT(*) clause.

**Webapp bug — aggregates computed from paginated `visibleTransactions`**
- Where: `webapp/src/app/(dashboard)/transactions/page.tsx:47-62`
- The page fetches 1 page of transactions via `getTransactionsCached()` (default 50 per page) then reduces `visibleTransactions` to compute MOVIMIENTOS / INGRESOS / GASTOS / Categorizar. So if the user has 112 txns spread across pages, the card shows page-1 numbers only, not month totals.
- This is what the live walkthrough actually saw: webapp page 1 totals (subset) vs mobile full-month totals (with the excluded-row bug).
- Fix size: **medium** — split the aggregate query from the paginated list query. Either:
  - Add a `getMonthlyAggregatesCached(month)` action that does one count + four sums, OR
  - Reuse `getMonthlyCashflowCached()` from `webapp/src/actions/charts.ts` which already has the canonical debt-INFLOW filter.

### Recommended approach

Extract a single shared helper, consume from both sides:

1. **`packages/shared/src/utils/monthly-aggregates.ts`** — new module
   - Inputs: array of transactions + `debtAccountIds: Set<string>` + month bounds
   - Returns: `{ count, totalInflow, totalOutflow, uncategorizedCount }`
   - Filters baked in (matching CLAUDE.md): exclude `is_excluded`, exclude `reconciled_into_transaction_id != null`, exclude debt-account INFLOWs from `totalInflow`, count uncategorized as `direction === 'OUTFLOW' && !category_id`
2. **Webapp wiring**: server action `getMonthlyAggregates(month)` that fetches the FULL month (no pagination) with only the columns the helper needs, passes through the shared helper, caches with `cacheTag("transactions")`. Replace the in-`page.tsx` reduce with a single call to this action. Page can still paginate the LIST independently.
3. **Mobile wiring**: drop the broken `COUNT(*)` SQL and the four sum-cases; instead call `getAllTransactionsForMonth(month)` from SQLite (already cheap — local DB) and pass through the shared helper. Same numbers as webapp by construction.

Estimated size: **~6 hours of focused work**:
- ~1h: write `monthly-aggregates.ts` + test
- ~2h: webapp action + page wiring + cache tag + verify
- ~2h: mobile repository + LECTURA card consumer + verify
- ~1h: regression-test against a known account, confirm both sides match the same numbers

### Webapp internal inconsistency (subitem of Finding 1)
`/accounts` shows "681 transacciones sin categorizar" and `/transactions` shows "0 Categorizar" in the same session. Once webapp's aggregate is fixed to query the FULL month (not the visible page), the /accounts widget should pull from the same shared helper. Net result: both webapp surfaces will agree, both platforms will agree.

### Dashboard "POR RESOLVER" (audit M23)
The same shared helper covers the POR RESOLVER count. Mobile's hardcoded `pendingEmails = 0` in `AttentionWidget.tsx` was the other half of that gap and is independent — needs its own one-liner fix to actually query the pending-email table.

---

## Finding 2 — Dashboard hero "ritmo": different product intent, not a bug

### Root cause: the two surfaces answer two different financial questions

The recon agent characterised it cleanly:

- **Mobile RITMO** = *predictive runway warning*. "If you keep spending at last week's pace for the rest of the month, will you outrun your liquid balance + expected income minus pending bills?"
  - Source: `mobile/lib/dashboard/useDashboardData.ts:165` (`avgLast7`), `mobile/components/inicio/widgets/RitmoWidget.tsx`, `mobile/components/inicio/widgets/PulseWidget.tsx`
  - Inputs: rolling 7-day OUTFLOW average × days remaining in month, vs liquid balance + pending occurrences
  - Verdict thresholds: "en camino" if projected ≤ available; else "fuera de ritmo"
  - Has a SEMANA / MES toggle that swaps the window

- **Webapp PULSO** = *allocation adherence check*. "Have you blown through your 50/30/20 categories yet this month?"
  - Source: `webapp/src/components/dashboard/zones/hero-zone.tsx:25`, `webapp/src/components/dashboard/status-headline.tsx:25`, `webapp/src/actions/allocation.ts:13` (`get503020Allocation`)
  - Inputs: month-to-date spend bucketed by category `expense_type` (needs / wants / savings), vs monthly income baseline
  - Verdict thresholds: "Vas bien" (<90%), "Cerca del límite" (≥90%), "Por encima del presupuesto" (>100%)
  - No period toggle

### Why this isn't a bug to "just fix"

Both formulae are internally consistent and product-meaningful — they just answer different questions. Picking the wrong one as canonical removes a real surface from the product. The recon agent's recommendation was to **surface both** on both platforms (two chips: "Pace" + "Budget status") rather than collapse to one.

### Options (need product decision)

**Option A — Mobile wins (predictive runway is canonical)**
- Port `useDashboardData` ritmo logic to `@zeta/shared`.
- Webapp `hero-zone` consumes it; allocation-based StatusHeadline becomes a secondary chip or moves to /presupuesto.
- Pro: simpler hero, "are you about to run out?" is the more universal question.
- Con: loses the 50/30/20 enforcement loop that webapp's StatusHeadline drove.

**Option B — Webapp wins (allocation adherence is canonical)**
- Port `get503020Allocation` + StatusHeadline thresholds to `@zeta/shared`.
- Mobile RitmoWidget reads the allocation result; SEMANA/MES toggle either disappears or becomes a secondary breakdown.
- Pro: aligns with webapp's existing 50/30/20 framing, drives users to use the budget feature.
- Con: feels backward-looking; doesn't warn the predictive case ("you'll run out in 5 days").

**Option C — Surface both (recon agent's recommendation)**
- Extract two shared helpers: `computeRitmoPace()` and `computeAllocationStatus()`.
- Show both as a small dual-status row on the dashboard hero on both platforms.
- Pro: tells complementary stories. Predictive + adherence.
- Con: more space on the hero, more eyebrow text, harder to digest at a glance.

### Estimated sizes
- Option A: ~1 day (port ritmo to shared, rewire webapp hero, deprecate StatusHeadline OR move it).
- Option B: ~1 day (port allocation to shared, rewire mobile, deprecate ritmo formula).
- Option C: ~1.5 days (both ports + design hero update).

---

## Recommended sequencing

1. **Ship Finding 1 first** (aggregates) — clear-cut bug, ~6 hours, no product decision needed. Land it as a single PR with the shared helper + both consumers. Immediate user-trust win.
2. **Decide Finding 2 direction before coding** — needs product input on Option A / B / C. The audit + walkthrough have collected enough evidence; the call is now about product framing, not engineering.

## Critical files (Finding 1)
- `packages/shared/src/utils/` — new `monthly-aggregates.ts`
- `webapp/src/app/(dashboard)/transactions/page.tsx:47-62` — replace inline reduce with action call
- `webapp/src/actions/transactions.ts` — add `getMonthlyAggregatesCached`
- `mobile/lib/repositories/transactions.ts:310-318` — replace the SQL-level `COUNT(*)` + `SUM(CASE WHEN…)` aggregates with a single `SELECT *` for the month + JS reduce via the shared helper
- `mobile/components/movimientos/MovimientosRoot.tsx` — consume the new mobile repo helper

## Critical files (Finding 2 — once direction is chosen)
- Mobile ritmo: `mobile/lib/dashboard/useDashboardData.ts`, `mobile/components/inicio/widgets/RitmoWidget.tsx`, `mobile/components/inicio/widgets/PulseWidget.tsx`
- Webapp pulso: `webapp/src/components/dashboard/zones/hero-zone.tsx`, `webapp/src/components/dashboard/status-headline.tsx`, `webapp/src/actions/allocation.ts`
- Shared destination: `packages/shared/src/utils/ritmo.ts` (Option A), `allocation.ts` (Option B), or both (Option C)
