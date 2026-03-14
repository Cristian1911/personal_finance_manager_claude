# Design: Burn Rate + Runway, Mobile FAB Evolution, Debt Salary Bar Chart

**Date:** 2026-03-14
**Status:** Draft
**Branch:** TBD (new feature branch per feature)

Three independent features designed together for visual/UX consistency but implemented separately.

---

## Feature 1: Burn Rate + Runway

### Problem

The dashboard shows current balances and pending obligations but nothing forward-looking. Users can't answer: "At my current spending pace, how long until I run out of money?"

### Design Decisions

- **Two modes:** "Disponible" (discretionary — excludes fixed expenses) and "Total" (all spending against liquid balance). Default: Disponible, toggle to switch.
- **No minimum data threshold.** Uses whatever months of transaction history are available. Average improves naturally as more data accumulates.
- **Dashboard placement:** New card section below the hero. Hero = "what I have now", this card = "where I'm headed."

### Data Model

No new database tables. Derived from existing `transactions` and `accounts`.

```typescript
interface BurnRateInput {
  liquidBalance: number           // sum of checking + savings balances
  disponible: number              // saldo total - fijos pendientes (from hero calc)
  transactions: Transaction[]     // spending transactions over available months
  pendingObligationIds: string[]  // recurring template IDs that contribute to "fijos pendientes"
}

interface BurnRateResult {
  mode: "total" | "discretionary"
  dailyAverage: number            // avg daily spend
  runwayDays: number              // balance / dailyAverage
  runwayDate: Date                // today + runwayDays
  trend: "accelerating" | "stable" | "decelerating"
  dataPoints: { date: Date; balance: number }[]  // for burndown chart
  monthsOfData: number            // how many months fed the average
}
```

### Fixed vs. Discretionary Classification

There is no "fixed category" concept in the database. Instead, we reuse the existing "fijos pendientes" logic from the dashboard hero:

- **Fixed expenses** = transactions matched to recurring outflow templates (same source as `getUpcomingRecurrences()` in `charts.ts`). The server action already computes this for the hero's "fijos pendientes" — we reuse the same recurring template IDs to filter transactions.
- **Discretionary expenses** = all other outflow transactions not matched to recurring templates.

This avoids introducing a new classification system and stays consistent with what the dashboard already shows.

### Calculation Logic

1. Fetch all spending transactions across available months.
2. **Total mode:** daily average = total spending / total days. Runway = liquid balance / daily average.
3. **Discretionary mode:** exclude transactions matched to recurring outflow templates. Runway = disponible / discretionary daily average.
4. **Trend:** compare last 14 days' daily average vs. overall average. If recent is >10% higher → "accelerating", >10% lower → "decelerating", else "stable".
5. **Chart data points:** computed by replaying transactions against the current balance. Start with today's liquid balance (or disponible), walk backwards through transactions to reconstruct daily balances for the current month. Then project forward linearly at the daily average rate to the zero crossing point.

### Server Action

New file: `webapp/src/actions/burn-rate.ts`

- `getBurnRate()`: fetches accounts (for liquid balance) + recent transactions in one query pass. Computes `BurnRateResult` for both modes, returns both. No round-trips for toggle.

### UI Component

New file: `webapp/src/components/dashboard/burn-rate-card.tsx`

**Layout (spacious style):**
- Header: "Ritmo de gasto" label + Disponible/Total toggle (pill-style)
- Headline: runway days as large number (e.g., "18 días") + trend indicator inline
- Subtitle: "Al ritmo actual, llegas a $0 el {date} · Promedio diario: {amount}"
- Chart: tall burndown chart (~120px) with:
  - Solid blue line: actual daily balance trajectory
  - Shaded area under actual line
  - Dashed blue line: projected decline to zero
  - "hoy" marker at the transition point
  - Red dot + date label at the projected zero point
  - Y-axis labels for balance reference
- Footer: date range labels (month start, today, projected end)

**Behavior:**
- Toggle switches between modes instantly (both results pre-fetched)
- Chart library: recharts via shadcn `ChartContainer` (consistent with existing dashboard charts like budget-pace, cashflow, etc.)
- Responsive: full-width card on both mobile and desktop

### Edge Cases

- **No transactions yet:** Show card with "Importa tu primer extracto para ver tu ritmo de gasto" message
- **Zero spending days:** Exclude from average (don't deflate the rate)
- **Only 1 month of data:** Show result with a subtle note "Basado en {N} días de datos"
- **Negative disponible:** Show "0 días" with a warning color

---

## Feature 2: Mobile FAB Evolution

### Problem

The current FAB is a floating circle with sub-buttons that feel generic and disconnected. Contextual actions exist but lack interactivity. The three transaction types (expense/income/transfer) take up slots that could be consolidated.

### Design Decisions

- **Bottom sheet pattern.** Tap FAB → sheet slides up from bottom with drag handle. Proven iOS/Android pattern.
- **Consolidated transaction action.** "Transacción" (gasto o ingreso) as one action. Transfer is rare enough to move inside the transaction form as a type selector.
- **Two primary actions:** Transacción + Importar PDF. Shown as a 2-column grid with icon + label + subtitle.
- **Contextual actions section.** "En esta página" header with page-specific actions in a list. Richer than current pills — each has icon + label.
- **Mobile only.** No desktop equivalent; desktop users have the full sidebar/nav.

### Component Architecture

Replaces: `webapp/src/components/mobile/fab-menu.tsx`

```typescript
// Updated action types
type PrimaryAction = "transaction" | "import-pdf"
type ContextAction = {
  id: string
  icon: React.ReactNode
  label: string
  description?: string
}

interface FabMenuProps {
  onPrimaryAction: (action: PrimaryAction) => void
  contextActions?: ContextAction[]
  onContextAction?: (id: string) => void
}
```

### UI Structure

**Closed state:**
- Same position as current FAB: fixed bottom center, primary color, Plus icon
- `lg:hidden`, safe-area aware

**Open state (bottom sheet):**
- Backdrop overlay (40% black)
- Sheet with rounded top corners, drag handle
- Section 1: "Acciones rápidas" — 2-column grid
  - Left: Transacción (icon + "Gasto o ingreso")
  - Right: Importar PDF (icon + "Extracto bancario")
- Section 2: "En esta página" — vertical list of contextual actions (if any)
- Dismiss: backdrop tap, swipe down, Escape key, route change

**Animation:**
- Sheet slides up with spring easing (~300ms)
- FAB Plus icon rotates 45° to become X (existing behavior, keep)
- Stagger contextual items by 40ms

### Migration

- `FabAction` type simplified: remove "expense" | "income" | "transfer", add "transaction" | "import-pdf"
- Parent components that pass `onAction` updated to handle new action types
- **Transaction form update:** `MobileTransactionForm` currently requires `defaultDirection` and `isTransfer` props. It needs a new "no preset" mode where the user picks the direction (Gasto/Ingreso/Transferencia) as the first step inside the form. Add a direction selector at the top of the form when no `defaultDirection` is provided.
- **Import PDF routing:** The "Importar PDF" action navigates to `/import` (uses `router.push`), not a sheet. The sheet closes, then navigation occurs.
- `contextActions` interface stays similar but gains optional `description` field

---

## Feature 3: Debt Salary Bar Chart

### Problem

Users see debt totals and interest costs but lack an intuitive "feel" for how debt consumes their income. The psychological insight — "almost nothing is left for me" — is missing, as is the motivating vision of how that ratio improves over time.

### Design Decisions

- **Two components sharing one engine:**
  - Simple bar (deudas page): single stacked bar for current month
  - Full timeline (scenario planner): monthly bar chart showing evolution
- **Income source:** auto-detect from income transactions, user can override/confirm
- **Toggle in timeline view:** "Simple" (freed money = libre) vs. "Cascada" (freed money shows redirection with striped pattern)

### Shared Calculation Engine

New utility in `packages/shared/src/utils/salary-breakdown.ts`:

```typescript
interface SalaryBreakdownInput {
  monthlyIncome: number
  debtPayments: { accountId: string; name: string; amount: number; color: string }[]
}

interface SalarySegment {
  accountId: string | "libre" | "redirected"
  name: string
  amount: number
  percentage: number
  color: string
  redirectedTo?: string  // only in cascade mode
}

interface MonthlyBreakdown {
  month: Date
  income: number
  segments: SalarySegment[]
  freePercentage: number
  paidOffThisMonth?: string[]  // account names that reached zero
}

// For the simple single-bar on deudas page
function getCurrentSalaryBreakdown(input: SalaryBreakdownInput): MonthlyBreakdown

// For the timeline in scenario planner — takes scenario results (not SimulationResult)
function getTimelineSalaryBreakdown(
  income: number,
  scenarioResult: ScenarioResult,  // from packages/shared/src/utils/scenario-types.ts
  mode: "simple" | "cascade"
): MonthlyBreakdown[]
```

### Income Detection

New server action: `webapp/src/actions/income.ts`

- `getEstimatedIncome()`: query transactions with direction = "income" over available months, compute monthly average. Return both the estimate and the individual income transactions so the user can confirm/adjust.
- Stored nowhere — computed on demand. If we later add a profile field for manual income, it overrides the estimate.

### Debt Payment Amount Source (Simple Bar)

For the simple bar on the deudas page, `debtPayments[].amount` comes from `getMinPayment()` (from `packages/shared/src/utils/scenario-engine.ts`), which returns the account's `minimum_payment` or a calculated fallback. This is the same source used by the simulation engine, ensuring consistency between the simple bar and the timeline chart.

### UI: Simple Bar (Deudas Page)

New component: `webapp/src/components/debt/salary-bar.tsx`

**Layout:**
- Header row: "Tu salario hoy" + amount on left, free percentage (large, green) on right
- Single stacked horizontal bar (~40px tall):
  - One colored segment per debt (warm colors: red, orange, amber, purple)
  - Green "Libre" segment at the end
  - Debt names as labels inside segments (if wide enough)
- Legend below: colored dots with debt name + monthly payment amount
- CTA card: "¿Quieres ver cómo crece lo libre mes a mes? Simular →" linking to scenario planner

### UI: Timeline Chart (Scenario Planner)

New component: `webapp/src/components/debt/salary-timeline-chart.tsx`

Integrated as a new view/tab within the existing scenario planner detail step.

**Layout:**
- Header: "Distribución del salario" + Simple/Cascada toggle
- Vertical stacked bar chart: one bar per month, all bars same height (100% = income)
  - Segments stacked bottom-to-top: debts (warm colors) then libre (green)
  - Month labels below each bar
  - When a debt is paid off, its segment disappears → green grows
- **Cascade mode differences:**
  - Freed money shows as a striped/hatched segment in the color of the debt it's redirected to
  - Visual distinction: solid = regular payment, striped = redirected cascade payment
- Payoff milestone pills below chart: "● Nu se paga en Jul", "● M/Card en Sep", etc.
- Summary banner: "En {month} {year} eres libre de deuda. Tu salario pasa de {start}% libre → 100% libre en {N} meses"

**Behavior:**
- Toggle between Simple/Cascada is instant (re-renders from same simulation data)
- Bars are not interactive (no drill-down) — the detail step already provides month-by-month tables
- Chart uses recharts `BarChart` with stacked bars via shadcn `ChartContainer` (consistent with other charts in the app)
- Horizontal scroll if timeline exceeds ~12 months on mobile

### Color Palette for Debts

Consistent across both components. Colors are assigned **per account** (stable across views and re-simulations), not by payoff order. Use a deterministic hash of the account ID to pick from this palette:

1. `#dc2626` (red)
2. `#ea580c` (orange)
3. `#d97706` (amber)
4. `#7c3aed` (purple)
5. `#6366f1` (indigo)
6. `#0891b2` (cyan)

Green (`#22c55e`) is always "libre." This ensures the same account always gets the same color regardless of strategy or scenario changes.

---

## Non-Goals

- **No new database tables** for any of these features
- **No new charting library** — use existing recharts via shadcn ChartContainer
- **No desktop FAB** — mobile only
- **No income profile settings page** — income is auto-detected with future override option
- **No real-time updates** — data refreshes on page load / navigation

## Dependencies Between Features

None — these are fully independent:

- Burn Rate uses dashboard data (accounts + transactions)
- FAB Evolution is a standalone component swap
- Salary Bar Chart uses debt data + simulation results from existing engine

They can be implemented in any order on separate branches.
