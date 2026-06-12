# Budget Builder — "Armar presupuesto" (composable budgets by lines)

**Date:** 2026-06-11 · **Status:** Approved design · **Scope:** webapp only (RN app follow-up noted)

## Problem

Setting a budget per category means inventing one number per group out of thin air. The natural way users think is bottom-up composition: "Hogar = Arriendo 1.200.000 + Servicios 220.000 + Mercado 450.000 + Internet 65.000". Zeta already has the data to seed those lines (active recurring templates with `category_id`, 3-month spending averages per category), but no surface composes them.

## Decisions (validated with user)

1. **A line is a `budgets` row on a subcategory.** No new tables. Lines track their own real spending for free (per-sub spend is already computed).
2. **Seeding is suggestion-only.** Lines are pre-filled/suggested from recurrentes + 3m averages, but everything saves as plain editable budget rows. Nothing auto-updates behind the user's back.
3. **Canonical flow = single-screen builder** (accordion of groups + sticky Σ-vs-ingreso footer) **+ the same group composer reachable from the presupuesto tab** (tap a group → composer sheet).
4. **Additive.** Planificar mes, BudgetWizard, and the Simular cambio sandbox are untouched. Merge decisions deferred.
5. **Bottom-up.** The sum of lines defines the group total. No per-group target/envelope, no mismatch states. The global control is the Σ-vs-ingreso bar.

## Data model rule (the core invariant)

> **Group total = parent's own budget row ("Base") + Σ budget rows of its subcategories.**

- No migration: existing budgets are groups where only "Base" has a value.
- Composing = adding subcategory rows (and optionally zeroing Base). De-composing = deleting line rows.
- "Base" renders as the first line of every expanded group (muted when 0 and other lines exist). It catches spending categorized directly at the parent.

## Components

### 1. Builder route — `/presupuesto/armar`

- `webapp/src/app/(dashboard)/presupuesto/armar/page.tsx`, server component fetching via the existing cached actions (`getCategoriesWithBudgetData`, `getEstimatedIncome`); client builder component receives props.
- **Focus mode:** add to `FOCUS_MODE_PATHS` (`webapp/src/lib/constants/mobile-nav.ts`). `MobileHeader variant="sub" backStyle="exit" backHref="/plan?tab=presupuesto"`. Dirty-draft guard on exit (confirm discard), same semantics the sandbox apply sheet uses.
- Desktop: same route, column centered `lg:mx-auto lg:max-w-md` (sandbox pattern).
- Layout: accordion of OUTFLOW parent groups (order: groups with budget first, then by `display_order`). Expanded group shows:
  - **Base** line (parent's own amount, editable).
  - One editable line per subcategory that has a budget row (prefilled).
  - **Suggestion chips** for subcategories with no budget where `recurring > 0` or `avg3m > 0`: label "Nombre · recurrente $X" (exact monthly recurring amount, preferred) or "Nombre · prom $X" (rounded 3m average). Tapping converts the chip to a prefilled editable line.
  - **"+ Otra línea…"**: picker of remaining subcategories + "Crear subcategoría" inline (existing category-create action with `parent_id`). This is how free-form concepts ("Netflix") become lines.
- Sticky footer: `Σ asignado` vs `ingreso` (from `getEstimatedIncome`), % bar, "quedan $X sin asignar" (or over-income warning in `text-z-debt`), needs/wants split via `is_essential` as a secondary line.
- **Guardar:** diffs draft vs initial state → calls `applyBudgetComposition` (below). Success → toast + router to `/plan?tab=presupuesto`. Failure → toast, draft retained.

### 2. Group composer in the tab

- New client component `BudgetComposerSheet` (bottom Sheet) sharing the line-list UI with the builder (extract `BudgetGroupLines` as the shared piece).
- `MobileBudgetList` (shipped 2026-06-11) routing on row tap:
  - Group **has child lines** → `BudgetComposerSheet` (lines with real spend per line: "Servicios $180k / $220k", traffic-light per line via existing `childrenSpent`).
  - Group **has only Base** → today's `BudgetEditorSheet`, which gains a "Convertir en líneas" ghost action that swaps to the composer.
- Desktop grid: totals reflect the rollup (no UI change in v1 beyond a small "N líneas" hint on composed cards).

### 3. View rollup — `getCategoriesWithBudgetData` (`webapp/src/actions/categories.ts`)

The only behavioral change to existing reads:

- `budget = parentRow + Σ childRows` (today child budget rows are ignored).
- `percentUsed = totalSpent / combined budget` (spend already rolls up).
- Enrich per-child data following the existing `childrenSpent` pattern with parallel maps: `childBudgets`, `childAvg3m`, `childRecurring` (`Record<childId, number>`). Raw data is already in the same queries — no new round-trips. `committedRecurring` (parent-keyed) additionally sums child-template amounts into the parent.
- **Extract the rollup as a pure function** (e.g. `lib/utils/budget-rollup.ts`) with vitest unit tests before wiring it in.
- **`getBudgetSummaryCached` fix (`webapp/src/actions/budgets.ts`):** `totalTarget` (Σ all rows) stays correct automatically, but the spent filter `.in("category_id", budgetedCategoryIds)` must also include the **parent ids of budgeted subcategories** — otherwise transactions categorized at the parent stop counting once a group is composed without Base.

### 4. Server action — `applyBudgetComposition`

New action in `webapp/src/actions/budgets.ts`:

```ts
applyBudgetComposition(input: {
  upserts: { category_id: string; amount: number }[];   // changed/new lines incl. Base
  deletes: string[];                                    // category_ids cleared to 0
}): Promise<ActionResult<null>>
```

- Auth via `getAuthenticatedClient()`, defense-in-depth `user_id` filters, `UUID_RE` validation on every id, amounts `> 0` for upserts.
- Implementation: one `upsert` batch (reuse `bulkUpsertBudgets` internals) + one batched delete (`.in("category_id", deletes)` + `.eq("user_id", ...)` + `.eq("period", "monthly")`). Sequential, not transactional — same level of atomicity as `applyBudgetScenario`; on partial failure return error so the client keeps the draft.
- Invalidation: `updateTag("budgets")`, `updateTag("dashboard:budgets")`, `updateTag("attention")` once at the end.

### 5. Entry points

- Presupuesto tab (mobile): "Armar presupuesto" brass-ghost button near the hero (above `ScenarioEntryPoint`).
- Presupuesto tab (desktop): button next to "Planificar mes".
- Empty/no-budget state: primary CTA.
- BudgetWizard: untouched (decision #4).

## Error handling

- Save failure → Spanish toast with the action error, draft preserved, no optimistic apply (the builder is a deliberate flow; correctness over optimism).
- Exit with dirty draft → confirm dialog ("Descartar cambios?").
- Income unavailable (no estimate) → Σ bar shows only the assigned total, no ratio; builder still works.

## Testing

- **Unit (vitest):** rollup pure function — parent-only, subs-only, mixed, zero/null budgets, percentUsed edge cases; diff function of the builder (upserts/deletes computation).
- **Manual QA:** compose a group from scratch via chips; convert an existing simple budget; zero out a line; verify tab totals, dashboard budget bar, and `getBudgetSummary` agree; verify Planificar mes and sandbox still behave identically; verify parent-categorized spending counts with and without Base.

## Out of scope / follow-ups

- RN mobile app: budgets schema is unchanged so sync is unaffected, but the RN budget display likely shows parent rows only — needs a parity check before composed budgets look right there (`mobile-webapp-parity` gate when that work starts).
- Named reusable templates ("Mudanza" for budgets) — the sandbox already covers what-if templates; revisit after usage.
- Per-group envelopes/targets (top-down) — rejected for v1 (decision #5).
- Merging builder with Planificar mes / wizard / sandbox — explicitly deferred (decision #4).

## Addendum (planning, 2026-06-11)

Three correctness consequences surfaced while writing the implementation plan:

1. **Sandbox apply cleans child lines.** `applyBudgetScenario` writes group-level amounts to parent rows; on a composed group that would yield `total = scenario + surviving lines` (inflated). Rule: scenario wins — applying a group amount deletes that group's child budget rows so the result equals what the user saw. (Not a UX change to the sandbox.)
2. **Planificar mes and the desktop grid prefill from `baseBudget`,** not the (now combined) `budget` — otherwise saving would write the combined total into the Base row and double-count. Both editors keep editing only the Base row; behavior on non-composed groups is identical to today.
3. **`MobileHeader` sub variant gains `onBackClick?: () => void`** so the builder's dirty-draft guard can intercept the back tap (today the back affordance is an un-interceptable `Link`/history-back). Additive chrome change; also unblocks the sandbox's known back-bypasses-confirm flaw later.
