# Tendencias — Interactive Exploration (drill-down + search) + Mobile Fix

**Date:** 2026-06-26
**Branch:** `feat/tendencias-drilldown-search` (off `main`)
**Status:** Approved design → implementation

## Problem

`/tendencias` only *shows* aggregates. Every card is read-only: no row is
clickable, there is zero search/filter input. Concrete failure: user wants
spend on **Hogar › Mascotas** (a *subcategory*), but the "Gasto por categoría"
card shows only the top-8 *parent* categories — the subcategory is unreachable.
The page is also near-unusable on mobile: the hero 3-stat grid clips COP
amounts; the lens tablist squeezes its labels.

## Goal

Make `/tendencias` answer "how much on X, and what made it up?" for **any**
category or recipient — including beyond the visible top-N — without leaving
the page, and make it usable at 375px.

## Approved decisions

- **Drill-down = inline expand** (no navigation away).
- **Find target = search box + expandable parents**, on **both** the category
  card and the recipient card.
- **"Ver todas (N)"** on both cards to reveal beyond the default top-N.
- **Recipient drill-down included** (needs a small backend filter add).
- Search filters **categories on the category card**, **recipients on the
  recipient card** (two contextual inputs, not one global search).
- Drilled transaction rows are **read-only** (display only).

## Interaction model

### Gasto por categoría (2-level accordion)
```
Gasto por categoría
[🔍 buscar categoría…]               ← client filter over ALL categories
──────────────────────────────
▾ 🟣 Hogar             $3.870.603     ← parent: chevron → subcategorías
   › Mascotas           $ 420.000     ← leaf: chevron → its movimientos
       Petys            $  85.000
       Agrocampo        $ 120.000
   › Servicios        $1.200.000
▸ 🔵 Transporte       $1.642.919
[ Ver todas (23) ]
```

Rules (keep every transaction-level query a single `categoryId`):
- **Parent (has children):** expands to subcategory subtotals only. No
  direct-to-transactions (avoids parent → `IN(descendants)` query).
- **Leaf (subcategory, or childless parent):** expands to its transactions —
  single `categoryId` filter, scoped to the active period window.
- **Parent's directly-assigned tx** (no subcategory): surfaced as a synthetic
  leaf row "<Parent> (directo)" using the parent's own id → still single-id.
- **Default:** top 8 parents; **"Ver todas (N)"** reveals the rest.
- **Search:** ignores the cap, filters the full category set (parents + subs).

### ¿A dónde va? · destinatarios (1-level accordion)
```
¿A dónde va? · Top destinatarios
[🔍 buscar destinatario…]
──────────────────────────────
▾ Compras Amazon       $3.861.520     ← chevron → its movimientos
       …tx rows…
▸ Hermanita            $1.750.080
[ Ver todas (47) ]
```
- Default top N; **"Ver todas (N)"** reveals the full ranked list.
- Each row expands → its transactions (single `destinatarioId` filter, period
  window).
- Search filters the full recipient set.

## Architecture / components

### Data layer
1. **`getTendenciasDataset` (webapp/src/actions/analytics.ts)** — extend:
   - Ship the **full per-category breakdown** (parent + leaf windowed totals),
     not just the top 20. ~43 small rows; needed for search + sub-expansion
     with zero per-tap fetch.
   - Ship the **full recipient ranking** (drop the `limit=5` for the payload;
     the card slices for display, search/ver-todas use the full set).
     `ponytail:` cap at top ~150 recipients by spend; upgrade to on-demand
     search-fetch only if a user ever exceeds that.
2. **`getDrilldownTransactions` (new cached action)** — fetch transactions for a
   single `categoryId` **or** `destinatarioId` + `dateFrom`/`dateTo` +
   `currency`. `"use cache"` + `cacheTag` + `cacheLife("zeta")`, via
   `createCachedClient(accessToken)`. Returns minimal display rows
   (id, date, merchant/clean description, amount, currency, account label).
   Reuse `getTransactions` internals where possible.
3. **`destinatarioId` filter on the transactions query** (~4 edits):
   - `transactionFiltersSchema` (src/lib/validators/transaction.ts): add
     `destinatarioId: uuidStr().optional()`.
   - `getTransactionsCached` (src/actions/transactions.ts): accept param.
   - Add `if (destinatarioId) query = query.eq("destinatario_id", destinatarioId)`.
   - Add `destinatarioId` to the cache-key tuple.

### UI layer
4. **`category-trend-list.tsx`** — rework into the 2-level accordion + search +
   "Ver todas". Parent/leaf rollup from extended dataset.
5. **`top-recipients-card.tsx`** — 1-level accordion + search + "Ver todas".
6. **Shared `DrilldownTransactions` subcomponent** — renders the on-tap
   transaction list (loading + empty + rows). Used by both cards. Wrapped in
   `<Suspense>`; data via `getDrilldownTransactions`.

### Reuse (ponytail)
- **`AnimatedAccordion`** (shared) for every expand — keeps content mounted
  during close (known footgun: `feedback_expand_animation_keep_content_mounted`).
- Existing **transaction-row component** from the `/transactions` mobile list
  for the inline rows → consistent look, no new row UI.
- `rangeToWindow(range)` (webapp/src/lib/analytics/range.ts) for the period
  window so drilled totals match the card numbers.
- Input/search styling from existing tokens (no new component, no new tokens).

## Mobile fixes (independent, ship regardless)
- **`verdict-header.tsx`** hero: `grid grid-cols-3` + `text-lg` clips COP →
  `grid-cols-2 sm:grid-cols-3`, value `text-base sm:text-lg`, add
  `min-w-0 tabular-nums`. Reuse `PANEL_INSET_CLASS`.
- **`tendencias-shell.tsx`** lens tablist: add `overflow-x-auto` + `shrink-0`
  on chips (mirror `period-control.tsx`).
- Sweep category/recipient/cambios rows for missing `min-w-0`/`truncate`.

## Data-flow notes / correctness
- Drilled list MUST use the active range's `dateFrom`/`dateTo`, or row totals
  won't match the card's windowed number (the one non-obvious correctness
  detail from the map).
- Cache: `getDrilldownTransactions` is a read → `"use cache"`. No mutations in
  this feature, so no `updateTag` needed.

## Out of scope
- Anomalies, projection, fijos-vs-variables stay read-only.
- `/transactions` filter-bar redesign untouched.
- Inline edit/recategorize of drilled transactions.
- Mobile (React Native) app — webapp only.

## Verification gates
- `pnpm build` clean (no dev server running — safe).
- `zetas-front-guy` (tokens, reuse, mobile), `perf-auditor` (no uncached query
  on render path, Suspense placement), `server-action-reviewer` (new action +
  filter: auth, defense-in-depth, cache).
- Manual: at 375px the hero no longer clips; search finds Mascotas; expanding a
  subcategory shows period-scoped transactions; recipient expand works.
