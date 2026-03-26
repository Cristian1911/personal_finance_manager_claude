# Dashboard Metrics & Visualizations Redesign

**Date:** 2026-03-18
**Status:** Review
**Scope:** Widget system, hero redesign, new KPI metrics, cash flow visualizations, gamified health score, spending heatmap, budget 50/30/20, debt countdown, mobile alignment

---

## 1. Widget System

### Architecture

The dashboard is organized into **fixed sections**, each with a curated set of widgets the user can toggle on/off and reorder within that section. Sections cannot be reordered or removed. Widgets cannot move between sections.

### Sections (top to bottom)

| # | Section | Default Widgets (on) | Optional Widgets (off by default) |
|---|---------|---------------------|----------------------------------|
| 1 | **Hero** | Disponible + Cash Flow Mini | — |
| 2 | **Niveles** | Gamified health meters (compact) | — |
| 3 | **Flujo de Caja** | Waterfall (current month) | Income vs Expenses (line/bar toggle, 6mo) |
| 4 | **Presupuesto** | Budget Pace, 50/30/20 Allocation | Category Donut |
| 5 | **Patrimonio y Deuda** | Debt-Free Countdown, Debt Progress Bars | Net Worth History |
| 6 | **Actividad** | Upcoming Payments, Recent Transactions | Spending Heatmap |

### Data Model

The codebase already has a widget configuration system:
- `dashboard_config` JSONB column on `profiles` table
- `DashboardConfig` type in `types/dashboard-config.ts` with `WidgetConfig[]` containing `{ id, visible, order }`
- `useDashboardConfig` hook with optimistic localStorage + fire-and-forget DB sync
- Default configs in `lib/dashboard-config-defaults.ts`

**We extend this existing system** rather than creating a new table. The existing `WidgetConfig` already supports `id`, `visible`, and `order` — exactly what we need. We add new widget IDs to the defaults config and register new section groupings.

Changes to existing system:
- Add a `section` field to `WidgetConfig` type: `{ id: string, visible: boolean, order: number, section: DashboardSection }`
- Add new widget IDs to `dashboard-config-defaults.ts` (e.g., `"waterfall"`, `"health-meters"`, `"heatmap"`, `"allocation-5030"`, `"debt-countdown"`)
- Group widgets by section in the dashboard renderer

No new database table, no migration, no new RLS policy. The existing JSONB + localStorage optimistic pattern already handles persistence.

### Defaults

On first dashboard load, `useDashboardConfig` falls back to the defaults from `dashboard-config-defaults.ts`. The user can toggle widgets via a settings gear icon per section. Toggling updates the JSONB config optimistically via the existing hook.

### Paywall

Free users get default widgets only. Premium unlocks the full widget catalog per section. The toggle UI shows locked widgets with a premium badge. Implementation detail: a `is_premium` flag on the user profile (or subscription status) gates the toggle.

**Not in scope for v1:** drag-and-drop reorder. v1 uses a fixed sort order. Reorder can be added later as a premium feature.

---

## 2. Hero Section

### Design

The hero combines the current "Disponible para gastar" simplicity with a micro cash flow breakdown showing where the number comes from.

### Layout

```
┌─────────────────────────────────────────────┐
│ DISPONIBLE PARA GASTAR                      │
│ $2,340,000                    En COP        │
│                                             │
│ Ingresos → Fijos → Variable → Queda        │
│ $6.8M    → -$2.8M → -$1.7M → $2.3M        │
│                                             │
│ Saldo: $4.2M  │  Fijos pend: $1.8M  │  ... │
└─────────────────────────────────────────────┘
```

### Components

- **Headline**: "Disponible para gastar" + large number (current `DashboardHero` logic)
- **Flow strip**: Horizontal flow showing Income → Fixed Expenses → Variable Expenses → Remaining. Uses existing `getDashboardHeroData` for totalLiquid/totalPending, plus `getMonthlyCashflow` for income/expense breakdown. Pure CSS (flow nodes + arrows), no chart library needed.
- **Sub-KPIs**: Keep existing 3 sub-cards (Saldo total, Fijos pendientes, Libre) below the flow strip.

### Data Requirements

- `getDashboardHeroData` — already provides totalLiquid, totalPending, availableToSpend
- `getMonthlyCashflow` — already provides income, expenses for current month
- New: split expenses into fixed vs variable using `categories.expense_type` column (already exists: `'fixed'` | `'variable'` | null — lowercase values)

### Mobile

Same layout, flow strip wraps to 2 rows if needed. Flow nodes are compact (abbreviate amounts).

---

## 3. Gamified Health Meters (Niveles Section)

### Concept

Four financial health meters with salary-aware contextual copy. Two display modes:

- **Compact** (default dashboard view): Horizontal gradient bars with pin marker + level tag
- **Expanded** (on click/tap): Speedometer semicircle gauge with full roast copy and breakdown

### Meters

| Meter | Metric | Formula | Scale |
|-------|--------|---------|-------|
| Gasto | Expense ratio | `expenses / income * 100` | 0-100% (lower = better) |
| Deuda | DTI | `monthly_debt_payments / monthly_income * 100` | 0-50%+ (lower = better) |
| Ahorro | Savings rate | `(income - expenses) / income * 100` | 0-50%+ (higher = better) |
| Colchon | Emergency fund | `liquid_savings / monthly_essential_expenses` | 0-12+ months (higher = better) |

### Level Classification

Each meter maps its value to a level with associated color, tag, and copy tone:

| Level | Tag | Color | Gasto | Deuda | Ahorro | Colchon |
|-------|-----|-------|-------|-------|--------|---------|
| Excelente | EXCELENTE | New token `z-excellent` = `#3D9E6E` | <50% | <15% | >35% | >12m |
| Solido | SOLIDO | `z-income` (#5CB88A) | 50-60% | 15-25% | 20-35% | 6-12m |
| Atento | ATENTO | `z-alert` | 60-70% | 25-36% | 10-20% | 3-6m |
| Alto | ALTO | `z-expense` | 70-85% | 36-43% | 5-10% | 1-3m |
| Critico | CRITICO | `z-debt` | >85% | >43% | <5% | <1m |

### Compact View (Dashboard)

A single card containing all 4 meters stacked vertically. Each meter row:
- Label + value + level tag (right-aligned)
- Horizontal gradient bar with white pin at the user's position
- Reference marks at key thresholds

Below all 4 meters: a summary "roast" sentence contextualizing the overall picture against the user's salary.

### Expanded View (Click/Tap)

Opens as a modal or navigates to a detail view (mobile: full-screen sheet). Contains:
- Speedometer semicircle gauge (SVG arc + CSS needle)
- Large value + level tag
- Full contextual roast paragraph (salary-aware)
- Breakdown table (e.g., for Deuda: per-account monthly payment)
- Actionable recommendation (e.g., "pay $200K extra/month to Visa Gold → drop to 35% DTI in 4 months")

### Copy System

Roast messages are template strings with variables:

```typescript
type RoastContext = {
  value: number;
  level: Level;
  monthlyIncome: number;
  monthlyExpenses: number;
  currency: CurrencyCode;
  // meter-specific extras
};
```

Templates are deterministic (no AI). One template per meter per level, with salary-range variants for Gasto and Ahorro (thresholds: <$4M, $4-10M, >$10M COP).

### Data Requirements

- Gasto: `getMonthlyCashflow` (income, expenses) — expense ratio = expenses / income
- Deuda: DTI = sum of minimum payments from latest snapshots of CREDIT_CARD + LOAN accounts / monthly income. Inputs: debt accounts from `getAccounts()` filtered by type, latest snapshot `minimum_payment` per account, income from `getEstimatedIncome()` (from `actions/income.ts`)
- Ahorro: derived from income - expenses (same data as Gasto)
- Colchon: liquid account balances (CHECKING + SAVINGS) / monthly essential expenses. **Prerequisite:** `getCategorySpending` must be extended to include `categories.expense_type` in its select and return, so we can sum expenses where `expense_type = 'fixed'` to get "essential monthly expenses."
- Monthly income: `getEstimatedIncome()` from `actions/income.ts` (falls back to `profiles.monthly_salary` if insufficient transaction history)

**Salary fallback for roast copy:** When `getEstimatedIncome()` returns null and `profiles.monthly_salary` is not set, the roast copy omits salary-relative comparisons and uses generic level-based messages instead.

New server action: `getHealthMeters(currency: CurrencyCode)` → returns all 4 meter values, levels, and roast context. Cached with `React.cache()`.

---

## 4. Cash Flow Visualizations (Flujo Section)

### 4a. Waterfall Chart (Default Widget)

Shows a single month's cash flow as: Income → (category deductions) → Net Remaining.

**Bars (left to right):**
1. Income (green, full height = 100%)
2. Top 4-5 expense categories (orange/red, proportional height)
3. Net remaining (green outline, height = income - expenses)

**Implementation:** Custom Recharts `BarChart` with floating bars (each bar's base = running subtotal). Alternatively, pure CSS div bars (simpler, no library dependency for this specific chart).

**Data:** `getCategorySpending` (already exists) + `getMonthlyCashflow` for income total.

### 4b. Income vs Expenses Trend (Optional Widget)

The existing `IncomeVsExpensesChart` (line) with an added toggle to switch to bar chart view (`MonthlyCashflowChart` — currently orphaned).

**Implementation:** Merge both orphaned and existing charts into a single component with a view toggle (line | bar). Both use `getMonthlyCashflow` data which already exists.

---

## 5. Category Spending Visualizations (Presupuesto Section)

### 5a. Category Donut (Optional Widget)

Recharts `PieChart` with `innerRadius` (donut) + legend list showing category name, color dot, and formatted amount.

**Center text:** Total spending amount.
**Legend:** Sorted by amount descending. Max 6 categories + "Otros" bucket.
**Data:** `getCategorySpending` (already exists).

### 5b. Current Stacked Bar (Stays in Budget Pace widget)

Remains as-is in the `DashboardBudgetBar` component. No changes needed.

---

## 6. Spending Heatmap (Actividad Section — Optional Widget)

### Design

GitHub-style calendar grid. Each cell = one day. Color intensity = spending amount relative to the user's daily average.

### Layout

```
        Lun  Mar  Mie  Jue  Vie  Sab  Dom
Sem 1   [ ]  [ ]  [ ]  [ ]  [##] [##] [#]
Sem 2   [#]  [ ]  [ ]  [#]  [##] [##] [#]
...
```

Color scale: 5 levels using `z-expense` at different opacities (0%, 20%, 40%, 60%, 100%).

### Thresholds

- Level 0: $0 spending
- Level 1: < 0.5x daily average
- Level 2: 0.5-1x daily average
- Level 3: 1-2x daily average
- Level 4: > 2x daily average

### Pattern Detection

Below the heatmap, show detected patterns:
- Weekend vs weekday ratio: "Gastas {X}x mas los {dias}"
- Highest spending day of week
- Spending-free days count

### Data

`getDailySpending` (already exists in `charts.ts`). New: aggregate by day-of-week for pattern stats.

### Implementation

Pure CSS grid (no chart library). Each cell is a `<div>` with background color based on level. Responsive: cells shrink on mobile.

---

## 7. 50/30/20 Allocation View (Presupuesto Section — Default Widget)

### Design

Three horizontal progress bars showing spending allocation against the 50/30/20 framework:
- **Necesidades (50%)**: Fixed/essential expenses
- **Deseos (30%)**: Variable/discretionary expenses
- **Ahorro/Deuda (20%)**: Savings + debt payments

Each bar shows: actual % | actual amount | target dashed line at the framework threshold.

### Category Mapping

Uses the existing `categories.expense_type` column (lowercase values):
- `'fixed'` → Necesidades
- `'variable'` → Deseos
- `null` (untagged) → defaults to Deseos
- Savings/debt (20%): `income - total_expenses` + debt payments to CREDIT_CARD/LOAN accounts

Categories without `expense_type` default to Deseos. The budget page should prompt users to classify untagged categories.

### Data

- Income: `getMonthlyCashflow`
- Category spending with expense_type: extend `getCategorySpending` to join and return `categories.expense_type`, then group by type. **Note:** `getCategorySpending` currently selects `categories!category_id(name_es, name, color)` without `expense_type` — this must be added to the select.
- Debt payments: OUTFLOW transactions to CREDIT_CARD/LOAN accounts. **Note:** these ARE included in the `expenses` total from `getMonthlyCashflow` (it's debt INFLOWs that are excluded at `charts.ts:162-171`). The 50/30/20 query must actively separate debt-payment outflows by joining `accounts.account_type` on the transaction's `account_id`.

---

## 8. Debt-Free Countdown (Patrimonio Section — Default Widget)

### Design

A motivational card showing:
- **Headline**: "Libre de deudas en **{N} meses**" (large number)
- **Projected date**: "Mayo 2027 al ritmo actual"
- **Progress bar**: Original total debt → current remaining → $0
- **Extra payment nudge**: "Pagando $X extra/mes → libre en {N-Y} meses (ahorras $Z en intereses)"

### Calculation

```
For each debt account:
  remaining = current_balance (from account or latest snapshot)
  rate = interest_rate (from latest snapshot, monthly = annual/12)
  min_payment = minimum_payment (from latest snapshot)

  months_to_zero = solve for N where:
    remaining * (1+rate)^N - payment * ((1+rate)^N - 1) / rate = 0

Total: max of individual payoff months (if paying minimums)
       OR sum-based if using avalanche/snowball
```

Debt payoff math already exists in `@zeta/shared/debt.ts`. Reuse it.

### Extra Payment Scenario

Show one "what-if": adding 10% of the highest-rate debt's minimum payment as extra. Use `compareStrategies(accounts, extraMonthlyPayment)` from `@zeta/shared/debt-simulator.ts` which returns a `bestStrategy` (avalanche or snowball) with projected months and total interest. Display the `bestStrategy` result.

**Edge cases:**
- No debt accounts → hide the widget entirely
- Accounts missing interest rate or minimum payment → exclude from projection, show note "datos incompletos para {account}"
- All debts paid off → show celebratory state "Libre de deudas!"

### Data

- Debt accounts: `getAccounts()` filtered to CREDIT_CARD + LOAN
- Latest snapshots: query `statement_snapshots` for most recent per account to get `interest_rate`, `minimum_payment`, `remaining_balance`, `initial_amount`
- Payoff math: `compareStrategies()` and `simulateSingleAccount()` from `@zeta/shared/debt-simulator.ts`

---

## 9. Additional KPI Widgets

These are available as optional widgets in their respective sections. Each follows the existing `KPIWidget` component pattern.

### 9a. Tasa de Ahorro (Presupuesto Section)

- Value: `(income - expenses) / income * 100`
- Trend: vs previous month (pp change)
- Progress bar: 0% → value → 50% scale, 20% target marker
- Data: `getMonthlyCashflow`

### 9b. Fondo de Emergencia (Patrimonio Section)

- Value: `liquid_savings / monthly_essential_expenses` (months)
- Visual: segmented bar (current | gap to 3m min | gap to 6m ideal)
- Data: liquid account balances + fixed-category expenses

### 9c. Intereses Pagados (Patrimonio Section)

- Value: sum of `statement_snapshots.interest_charged` for current month
- Trend: vs previous month
- YTD accumulation line
- Data: `statement_snapshots` aggregation (new query)

### 9d. Progreso Pago Deudas (Patrimonio Section)

- Per-account progress bars: `(initial_amount - remaining_balance) / initial_amount * 100`
- Data: loan snapshots with `initial_amount` and `remaining_balance`

### 9e. Patrimonio Neto (Patrimonio Section)

- Wire orphaned `NetWorthHistoryChart` component
- Data: `getNetWorthHistory` (already exists in charts.ts)
- Lowest priority of all KPIs

---

## 10. Mobile Experience

### Principle

Mobile mirrors the section-based widget layout. Sections stack vertically. Compact display by default, tap-to-expand for detail.

### Section Rendering on Mobile

1. **Hero**: Full width. Flow strip uses abbreviated amounts ($6.8M not $6,800,000).
2. **Niveles**: Compact horizontal bars in a single card. Tap any meter → bottom sheet with speedometer + roast.
3. **Flujo**: Waterfall chart adapts to screen width (fewer category bars if narrow). Trend chart hidden by default (optional widget).
4. **Presupuesto**: 50/30/20 bars full width. Budget pace below. Donut hidden by default.
5. **Patrimonio**: Debt countdown card. Progress bars stacked.
6. **Actividad**: Payments list. Heatmap hidden by default (optional widget, premium flex).

### Section Collapse

On mobile, sections after Hero and Niveles are collapsible. Default: first 3 sections open, rest collapsed with a summary line (e.g., "Presupuesto: 68% usado").

---

## 11. Existing Components to Wire or Merge

| Component | File | Status | Action |
|-----------|------|--------|--------|
| `NetWorthHistoryChart` | `charts/net-worth-history-chart.tsx` | Orphaned (built, not rendered) | Wire into Patrimonio section as `net-worth` widget |
| `MonthlyCashflowChart` | `charts/monthly-cashflow-chart.tsx` | Orphaned | Merge into `CashFlowViewToggle` as the bar view |
| `IncomeVsExpensesChart` | `charts/income-vs-expenses-chart.tsx` | **Active** (rendered on dashboard) | Merge into `CashFlowViewToggle` as the line view. This replaces the active component. |
| `EnhancedCashflowChart` | `charts/enhanced-cashflow-chart.tsx` | Orphaned | Cannibalize the toggle pattern; can be deleted after merge |
| `DailySpendingChart` | `charts/daily-spending-chart.tsx` | Orphaned | Data logic useful for heatmap; component itself likely unused |

---

## 12. Not In Scope (Explicitly Deferred)

- Sankey diagram (detail drill-down — future version)
- Treemap for categories (very optional)
- Monthly report flow (concept approved, implementation needs rethinking)
- Widget drag-and-drop reorder
- Subscription/paywall implementation (only the widget gating logic is in scope)
- Cross-currency net worth aggregation
- Goal-based savings tracking
- Interest rate history chart (rejected)

---

## 13. Database Changes

### No new tables required

Widget preferences use the existing `profiles.dashboard_config` JSONB column via the `useDashboardConfig` hook. No migration needed for widget storage.

### No other schema changes required

All metrics use existing tables (transactions, accounts, statement_snapshots, categories, profiles). The `expense_type` column on categories already exists.

### New design token

Add `--z-excellent: #3D9E6E` to `globals.css` `:root` for the "Excelente" health level color.

---

## 14. New Server Actions

| Action | Purpose | Cache |
|--------|---------|-------|
| `getHealthMeters(currency)` | Returns 4 meter values, levels, roast context | `React.cache()` |
| — | Widget preferences handled by existing `useDashboardConfig` hook | localStorage + JSONB |
| `get503020Allocation(month, currency)` | Returns needs/wants/savings breakdown | `React.cache()` |
| `getInterestPaid(month, currency)` | Sum interest_charged from snapshots | `React.cache()` |
| `getDebtFreeCountdown(currency)` | Payoff projection + extra payment scenario | `React.cache()` |
| `getSpendingHeatmap(month, currency)` | Daily spending amounts + pattern stats | `React.cache()` |

---

## 15. New Components

| Component | Type | Chart Library |
|-----------|------|--------------|
| `CashFlowHeroStrip` | Server | None (CSS) |
| `HealthMetersCard` | Client | None (CSS gradients) |
| `HealthMeterExpanded` | Client | SVG (speedometer arc + needle) |
| `WaterfallChart` | Client | CSS div bars or Recharts BarChart |
| `CategoryDonut` | Client | Recharts PieChart |
| `SpendingHeatmap` | Client | None (CSS grid) |
| `AllocationBars5030` | Server | None (CSS bars) |
| `DebtFreeCountdown` | Server | None (CSS progress bar) |
| `SavingsRateWidget` | Server | None (KPIWidget pattern) |
| `EmergencyFundWidget` | Server | None (KPIWidget pattern) |
| `InterestPaidWidget` | Server | None (KPIWidget pattern) |
| `DebtProgressWidget` | Server | None (CSS progress bars) |
| `CashFlowViewToggle` | Client | Recharts (wraps line + bar views) |
| `DashboardSection` | Client | None (collapsible section wrapper) |
| `WidgetTogglePanel` | Client | None (settings popover per section) |

---

## 16. Success Criteria

1. Dashboard loads with sensible defaults — no blank canvas, no setup wizard
2. All 4 health meters calculate correctly against real transaction data
3. Roast copy references the user's actual salary and amounts (or falls back to generic level copy when salary unknown)
4. Waterfall chart correctly shows income flowing through categories to net
5. Spending heatmap renders for the current month with pattern detection
6. 50/30/20 bars correctly classify categories by expense_type
7. Debt-free countdown matches `@zeta/shared/debt.ts` payoff math
8. Widget toggle persists across sessions via existing `dashboard_config` JSONB + localStorage
9. Mobile sections collapse/expand correctly with summary lines
10. `pnpm build` passes clean with no type errors
