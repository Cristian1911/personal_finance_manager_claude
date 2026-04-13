# Income-Aware Runway & Daily Budget

> Dashboard metrics should reflect upcoming income — budget in pay cycles, not calendar months.

## Problem

Current "gasto diario" divides available balance by days remaining in the month. If the user gets paid on the 15th and it's the 10th, the metric spreads the balance over ~20 days instead of 5. This is overly pessimistic when income is configured, and overly optimistic after income lands (suddenly the denominator jumps to 25+ days).

The runway chart projects a single downward slope to $0 with no awareness that income will replenish the balance.

## Core Concept: Pay-Cycle Budgeting

Replace calendar-month division with **pay-cycle windows**. The budget window is always **now → next income date**, regardless of month boundaries.

- A user paid biweekly on the 1st and 15th sees two windows per month
- A user paid on the 28th sees a window that crosses into the next month (28th → next month's first income)
- Obligations are only counted if they fall within the current window

## Data Sources

### Next income date (priority order)

1. **Recurring INFLOW occurrences** — query `recurring_occurrences` for next `pending` INFLOW occurrence where account is not CREDIT_CARD/LOAN. Use `occurrence_date >= today`, ordered ascending, limit 1.
2. **No income configured fallback** — use end of current month (existing behavior).

### Obligations within window

Query `recurring_occurrences` for `pending` OUTFLOW occurrences where `occurrence_date` is between today and next income date. Only count those where `account_type !== "CREDIT_CARD"` (credit card obligations don't reduce liquid balance).

### Available balance

`liquidBalance` — sum of CHECKING + SAVINGS accounts in base currency (unchanged from current).

## Daily Budget Formula

```
nextIncomeDate  = nearest future INFLOW recurring occurrence (non-debt account)
                  OR end of month if none configured
daysUntilIncome = max(daysBetween(today, nextIncomeDate), 1)
obligationsDue  = sum of pending OUTFLOW occurrences between today and nextIncomeDate
                  (excluding CREDIT_CARD account obligations)
available       = liquidBalance - obligationsDue
availablePerDay = available / daysUntilIncome
```

## Dashboard Hero Changes

### Breakdown display

Current:
```
Ingresos del mes: X
− Gastos fijos pendientes: Y
− Ya gastado: Z
= Disponible: W
÷ N días = W/día
```

New:
```
Saldo líquido: X
− Obligaciones pendientes (hasta [nextIncomeDate]): −Y
= Disponible: Z
÷ N días (hasta [formatted date]) = W/día
```

Key differences:
- Shows liquid balance, not monthly income as the starting point
- Obligations scoped to the pay-cycle window, not full month
- Days denominator is until next income, not end of month
- Date label makes the window explicit

### No-income nudge

When no recurring INFLOW templates exist and fallback is active, show a subtle banner:

> "Configura tus ingresos recurrentes para un presupuesto diario más preciso"

With a link to /plan?tab=recurrentes (or the recurring form directly).

### Next income indicator

Show a small annotation near the daily budget:

> "Próximo ingreso: [amount] el [date]"

This gives context for why the window ends where it does. Hidden when no income configured.

## Runway Chart Changes

### Single-segment model

The runway chart shows **one segment**: from today's balance, sloping down to the next income date.

- **X-axis**: today → next income date
- **Y-axis**: balance
- **Slope**: based on daily spending average (from `computeBurnRate` existing logic)
- **End point**: projected balance at next income date (may be > 0)

This replaces the current "slope to $0" model. The chart answers "how much will I have left when I get paid?" not "when does my money run out?"

### Obligation markers

Small dot markers on the slope at each obligation's due date:
- Position: x = due date, y = projected balance at that point
- Label on hover/tap: obligation name + amount
- Visual: small circle, muted color, not a sharp drop in the line

The slope itself stays smooth (based on average spending). Markers annotate known upcoming events without distorting the trendline.

### CTA to plan

Below the chart, a link:

> "Ver plan mensual completo →"

Links to /plan for the full envelope-based view with multi-segment detail.

### No income configured

Falls back to current behavior: slope from today to projected $0 based on spending average. Same nudge as hero.

## Interface Changes

### `DashboardHeroData` additions

```typescript
// Added fields
nextIncomeDate: string | null;        // ISO date of next INFLOW occurrence
nextIncomeAmount: number;             // Expected amount
daysUntilIncome: number;              // Computed window size
windowObligations: number;            // Sum of obligations in window
incomeConfigured: boolean;            // Whether user has recurring income
```

### `LiveDashboardData.hero` changes

```typescript
hero: {
  availablePerDay: number;            // Now: available / daysUntilIncome
  availableTotal: number;             // Now: liquidBalance - windowObligations
  daysRemaining: number;              // Now: daysUntilIncome (renamed semantics)
  nextIncomeDate: string | null;
  nextIncomeAmount: number;
  incomeConfigured: boolean;
  breakdown: {
    totalLiquid: number;              // Liquid balance (was monthlyIncome)
    fixedExpenses: number;            // Window obligations (was full month)
    alreadySpent: number;             // Unchanged
  };
};
```

### `BurnRateResponse` additions

```typescript
// Added fields
nextIncomeDate: string | null;
nextIncomeAmount: number;
obligations: {                        // For chart markers
  date: string;
  name: string;
  amount: number;
}[];
```

## Files to Modify

| File | Change |
|------|--------|
| `actions/charts.ts` → `getDashboardHeroData()` | Query next INFLOW occurrence, scope obligations to window, expose new fields |
| `actions/live-dashboard.ts` | Use `daysUntilIncome` instead of `daysRemaining` in month, pass through income fields |
| `actions/burn-rate.ts` | Single-segment chart data ending at next income date, add obligation markers |
| `components/mobile/v2/inicio/inicio-hero.tsx` | Updated breakdown labels, next income annotation, nudge |
| `components/dashboard/dashboard-hero.tsx` | Updated breakdown, nudge, next income indicator |
| `components/dashboard/burn-rate-card.tsx` | Obligation markers, single segment, plan CTA |
| `components/dashboard/burndown-expandable.tsx` | Same as burn-rate-card for mobile |

## What Does NOT Change

- **Plan page** — keeps its own envelope-driven detail, no coupling to dashboard
- **`getEstimatedIncome()`** — untouched, used by plan page only
- **Monthly cashflow calculations** — untouched, still calendar-month based
- **50/30/20 allocation** — untouched
- **Recurring template management** — untouched

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No recurring income configured | Fallback to end-of-month + nudge |
| Income is today | `daysUntilIncome = 1`, show today's available as daily budget |
| Income overdue (past occurrence not paid) | Skip past occurrences, use next future one |
| Multiple incomes same day | Use that date, sum amounts for display |
| Negative available (obligations > balance) | Show negative, pressure state "critical" |
| All obligations are credit card | `windowObligations = 0` (CC obligations don't reduce liquid) |
| Income lands on last day of month | Window may be 1 day, next window crosses to next month |
