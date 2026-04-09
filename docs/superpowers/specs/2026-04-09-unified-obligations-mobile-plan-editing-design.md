# Mobile Plan Editing + Color-Coded Envelopes

**Date:** 2026-04-09 (updated after materialized occurrences implementation)
**Branch:** `feat/materialized-recurring-occurrences` (continuing on same branch)

## Problem

Two remaining issues after the materialized occurrences work:

1. **Mobile Periodo view is read-only** — `MobilePeriodoView` hardcodes "Pendiente" on all expense rows, ignores `entry.status`, and has no CRUD or assignment capabilities. Desktop has full editing via `EnvelopeBoard`, `EntryFormDialog`, `EditEntryDialog`, `AssignmentDialog`, and `AutoAssignButton`.

2. **No visual link between income sources and expenses** — envelope assignments exist in the data but the UI doesn't color-code which income pays which expense, making the envelope system hard to parse at a glance.

## Already Done (Part 1 — materialized occurrences)

The hero inflation bug and single-source-of-truth rule were fully resolved by the materialized occurrences implementation:

- `recurring_occurrences` table is the single source of truth for pending obligations
- `getUpcomingPayments()` removed from all obligation calculations
- `obligation_skips` table dropped, replaced by `status` column on `recurring_occurrences`
- CLAUDE.md rule added under "Recurring Obligations"
- All transaction creation paths auto-link to pending occurrences

## Design

### Part 2: Mobile Periodo — status display + toggle

**File:** `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx`

#### `ExpenseRow` changes:

- Accept `entry` as full `PlanningEntryWithRelations` (it already does)
- Show status badge using the same map as desktop:
  - `PLANNED` → "Pendiente", amber badge
  - `COMPLETED` → "Pagado", green badge
  - `SKIPPED` → "Omitido", muted + strikethrough on label
- Badge is tappable — calls `toggleEntryStatus(entry.id, nextStatus)` cycling PLANNED → COMPLETED → SKIPPED → PLANNED
- Row gets `opacity-50` when status is `SKIPPED`

#### `IncomeCard` changes:

- Add status indicator (checkmark icon, like desktop's `IncomeEnvelopeCard`)
- Tap to toggle PLANNED ↔ COMPLETED (no SKIPPED for income)
- Call `toggleEntryStatus` on tap

#### Props expansion:

- `MobilePeriodoView` becomes a client component (it already is `"use client"`)
- No new props needed for Part 2 alone — `entry.status` is already in the data

### Part 3: Mobile Plan editing — full parity

**File:** `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx`

#### New props needed:

```typescript
interface MobilePeriodoViewProps {
  planData: PeriodPlanData;
  timelineData: PlanTimelineData;
  currency: CurrencyCode;
  isExpired: boolean;
  // NEW:
  accounts: Pick<Account, "id" | "name" | "icon" | "color">[];
  categories: Pick<Category, "id" | "name" | "name_es" | "icon" | "color">[];
}
```

These are already fetched in `PlanTabPeriodo` — just pass them through.

#### Section headers — add entry buttons:

- **Ingresos header:** Add `EntryFormDialog` with `defaultType="INCOME"` and the period's ID
- **Gastos header:** Add `EntryFormDialog` with `defaultType="EXPENSE"` + `AutoAssignButton` when there are unassigned expenses and income envelopes with remaining capacity

#### Expense row — interactive:

- Tap row to expand inline action bar (similar pattern to `mobile-recurrentes-view.tsx`'s expandable rows):
  - **Status toggle** — cycle button
  - **"Asignar"** — opens `AssignmentDialog`
  - **"Editar"** — opens `EditEntryDialog`
  - **"Eliminar"** — calls `deletePlanningEntry` with toast
- Track expanded row via `useState<string | null>`
- Track `assignTarget` and `editTarget` state for dialogs (same pattern as `EnvelopeBoard`)

#### Income card — interactive:

- Add status toggle (checkmark, tap to cycle PLANNED ↔ COMPLETED)
- Add `⋯` menu or tap-to-expand with:
  - "Editar" → `EditEntryDialog`
  - "Eliminar" → `deletePlanningEntry`
- Expandable assignments list showing assigned expenses with amount and remove button (same as desktop's `IncomeEnvelopeCard`)

#### Assignment data:

- Compute `assignedPerExpense` map from `income_envelopes[].assignments` (same logic as `EnvelopeBoard` lines 28-37)
- Pass `incomeEnvelopes` and `existingAssignedToExpense` to `AssignmentDialog`
- Derive `unassigned_expenses` from `planData.unassigned_expenses` for auto-assign visibility

#### Period management:

- `PeriodSetupDialog` is already rendered on mobile for empty/expired states
- For active periods, add a small settings/gear icon in the period summary bar that opens the dialog (to create a replacement period)

#### Dialog reuse:

- `EntryFormDialog`, `EditEntryDialog`, `AssignmentDialog` are all `Dialog`-based components
- On mobile, shadcn Dialog renders as a bottom sheet (via vaul) — no mobile-specific reimplementation needed

### Part 4: Color-coded income envelopes

**Applies to both desktop and mobile.**

#### Color palette:

Define a fixed palette of 6 visually distinct colors in a shared constant. These should contrast well against the dark theme and not clash with `z-expense`/`z-debt` reds:

```typescript
// webapp/src/lib/constants/envelope-colors.ts
export const ENVELOPE_COLORS = [
  { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30", hex: "#60a5fa" },
  { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30", hex: "#a78bfa" },
  { bg: "bg-teal-500/15", text: "text-teal-400", border: "border-teal-500/30", hex: "#2dd4bf" },
  { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", hex: "#fbbf24" },
  { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30", hex: "#f472b6" },
  { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/30", hex: "#22d3ee" },
] as const;

export function getEnvelopeColor(index: number) {
  return ENVELOPE_COLORS[index % ENVELOPE_COLORS.length];
}
```

**Color source:** Derived from the income envelope's index in the `income_envelopes` array. Stable within a period since entries are sorted by `expected_date`. No DB migration needed.

#### Desktop changes:

**`income-envelope-card.tsx`:**
- Accept `colorIndex: number` prop
- Use `getEnvelopeColor(colorIndex)` for:
  - Left border accent on the card
  - Progress bar color (replace generic `z-income` green)
  - Assignment list header color

**`expense-entry-row.tsx`:**
- Accept `assignments` data with their income colors
- Show small colored chips next to amount, one per income source:
  - Each chip shows the income's color + assigned amount
  - Format: colored dot + abbreviated amount (e.g., "362K") or full amount if space allows

**`assignment-dialog.tsx`:**
- Show colored dot next to each income option in the list

**`envelope-board.tsx`:**
- Pass `colorIndex` (loop index from `income_envelopes.map`) to each `IncomeEnvelopeCard`
- Build a color map `Map<incomeEntryId, colorIndex>` and pass it to expense rows

#### Mobile changes:

**`mobile-periodo-view.tsx`:**
- Same color logic applied to `IncomeCard` (colored left border, progress accent)
- Same colored chips on `ExpenseRow` for assigned amounts
- Assignment dialog shows colored dots

## Data flow summary

```
recurring_occurrences (DB)
  └─ ensureCurrentOccurrences() [idempotent generation]
  └─ getPendingOccurrences() [cached, "occurrences" tag]
       ├─ Hero: getDashboardHeroData → totalPending, availableToSpend
       └─ Attention items: upcoming payments
  └─ getOccurrencesForMonth() [cached, "occurrences" tag]
       └─ Plan Recurrentes: useRecurringMonth → pending/completed

Planning Entries (DB)
  └─ getPeriodPlanData [cached, "cashflow" tag]
       ├─ Desktop: EnvelopeBoard (full CRUD + assignments)
       └─ Mobile: MobilePeriodoView (full CRUD + assignments — NEW)
```

## Files touched

| File | Change |
|------|--------|
| `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx` | Status toggle + full CRUD + colored envelopes |
| `webapp/src/components/plan/tabs/plan-tab-periodo.tsx` | Pass accounts/categories to mobile view |
| `webapp/src/components/cashflow-planner/envelope-board.tsx` | Pass color indices to cards/rows |
| `webapp/src/components/cashflow-planner/income-envelope-card.tsx` | Color accent |
| `webapp/src/components/cashflow-planner/expense-entry-row.tsx` | Assignment color chips |
| `webapp/src/components/cashflow-planner/assignment-dialog.tsx` | Color dots on income options |
| `webapp/src/lib/constants/envelope-colors.ts` | NEW — color palette constant |
## No DB migration needed

- Colors are derived from index position (no new column)
- All server actions already exist (`toggleEntryStatus`, `createPlanningEntry`, `updatePlanningEntry`, `deletePlanningEntry`, `createAssignment`, `deleteAssignment`, `autoAssignExpenses`)

## Testing

- Verify hero `totalPending` matches Plan page's pending amount for the same window
- Verify mobile periodo shows correct Pendiente/Pagado/Omitido states
- Verify mobile CRUD operations (create/edit/delete entry, toggle status, assign/unassign)
- Verify envelope colors are consistent between desktop and mobile
- Verify assignment color chips update when assignments change
- `pnpm build` must pass clean
