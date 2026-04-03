# Debt Page Quick Stats Redesign

## Problem

The debt page has hidden value. Key metrics like monthly interest, total monthly payment, and credit card utilization are either buried in verbose insight blocks or missing entirely. The `DebtInsights` section generates up to 5 text-heavy blocks that restate what the cards already show. The page answers "how much do I owe?" but not "how much am I paying monthly?" or "where is my money going?"

## Solution

Replace the current hero row (3 separate cards) and insights section with a dense hero + categorized quick stats grid. Every tile supports click/hover popovers for per-account breakdowns.

## Page Structure (top to bottom)

### 1. Hero Section

A single container (`rounded-2xl` outer card) with two sub-cards side by side in a `2fr 1fr` grid:

**Left sub-card (2/3) — Debt + Payment:**
- Left: icon + "Deuda total" + total debt amount (large)
- Right: "Pagas al mes" + total monthly payment (second-largest)
- Secondary currencies shown below if multi-currency (existing behavior)

**Right sub-card (1/3) — Interest Banner:**
- Flame icon + "Intereses / mes" label (uppercase, small)
- Monthly interest estimate (large, `text-z-expense`)
- Subtitle: "Dinero que no reduce tu deuda"
- Visually distinct: stronger expense gradient + border than the left card

### 2. Metrics Section

A single container with 3 labeled rows, each with 3 tiles. Category labels are uppercase, small, with an icon and category color.

**Row 1 — General** (neutral color label):

| Tile | Primary value | Subtitle | Popover |
|------|--------------|----------|---------|
| Mayor cuota | Highest `getMinPayment(a)` formatted | Account name | All debts ranked by monthly payment |
| Deuda mas cara | Highest `interestRate` + "EA" | Account name | All debts ranked by interest rate |
| Proximo pago | `daysUntilPayment()` min + "dias" | Account name (amber if <=5 days) | Next 2-3 upcoming payments with dates |

**Row 2 — Tarjetas de credito** (purple label, `#8b5cf6`):

| Tile | Primary value | Subtitle | Popover |
|------|--------------|----------|---------|
| Uso de tarjetas | `overallUtilization`% with SVG ring | Used / Limit amounts | Per-card utilization % + amounts |
| Tarjetas / mes | Sum of `getMinPayment(a)` for credit cards | "N tarjetas" count | Per-card monthly payment |
| Intereses TC / mes | Sum of `estimateMonthlyInterest()` for credit cards | "de N tarjetas" | Per-card interest amount |

**Row 3 — Prestamos** (blue label, `#3b82f6`):

| Tile | Primary value | Subtitle | Popover |
|------|--------------|----------|---------|
| Prestamos / mes | Sum of `getMinPayment(a)` for loans | "N prestamos" count | Per-loan monthly payment |
| Plazo restante | Estimated months remaining (min across loans) | Account name | Per-loan remaining months |
| Progreso | % of original loan paid off (with progress bar) | "pagado" | Per-loan % paid + amounts |

**Tile design:** Dark inner background (`bg-[#0f0f11]`), subtle border, consistent padding. Each tile has a small info icon or `cursor-pointer` to signal interactivity.

**Popover design:** Same Popover component used by SalaryBar. Content is always a per-account list: account name, relevant number, secondary detail. No paragraphs or advice text.

### 3. Unchanged sections (below metrics)

- **ExchangeRateNudge** — shown between metrics and salary bar when multi-currency
- **SalaryBar** — stays exactly as-is
- **Account cards** — grouped by type (Tarjetas / Prestamos), unchanged
- **AccountImpactTimeline** — stays at bottom

## Components Changed

| Component | Action |
|-----------|--------|
| `DebtHeroCard` | Rewrite: now includes total monthly payment alongside total debt |
| `InterestCostCard` | Delete: data moves into interest banner sub-card within hero |
| `UtilizationGauge` | Delete: replaced by compact SVG ring tile in metrics grid |
| `DebtInsights` | Delete: replaced entirely by metrics grid |
| **NEW** `DebtQuickStats` | New component: the metrics section with 3 categorized rows |
| **NEW** `StatTile` | New component: individual tile with popover support |

## Data Changes

No new server actions or data fetching. All metrics derive from existing `getDebtOverview()` return values:

- `totalDebt`, `monthlyInterestEstimate`, `overallUtilization`, `totalCreditLimit` — already returned
- Total monthly payment: `accounts.reduce((sum, a) => sum + getMinPayment(a), 0)`
- By type: filter `accounts` by `type` before aggregating
- Highest payment: `accounts.reduce((max, a) => ...)` by `getMinPayment(a)`
- Highest rate: `accounts.reduce((max, a) => ...)` by `interestRate`
- Next payment: `accounts.reduce((min, a) => ...)` by `daysUntilPayment(a.paymentDay)`
- Credit card interest: sum `estimateMonthlyInterest()` for credit cards only
- Plazo restante: estimated from `balance / monthlyPayment` (rough)
- Progreso: for loans, `creditLimit` stores the original principal amount. Progress = `1 - (balance / creditLimit)`. If `creditLimit` is null, hide the Progreso tile.
- Plazo restante: `balance / getMinPayment(a)` rounded up to months. Rough estimate that ignores interest — acceptable for a quick stat. If `monthlyPayment` is null, hide the tile.

**Note on Plazo restante / Progreso:** These are estimates, not amortization-table-accurate. The popover should note "estimado" to set expectations.

The `insights` field stays in the `DebtOverview` type but is no longer rendered. `generateInsights()` in `@zeta/shared` stays as dead code for now.

## Responsive Behavior

- **Desktop (lg+):** Hero 2fr+1fr grid, metrics 3-column rows
- **Tablet (sm-lg):** Hero stacks to single column (debt card full width, interest banner full width). Metrics stay 3-column.
- **Mobile (<sm):** Hero stacks. Metrics rows become 1-column (tiles stack vertically within each category). Category labels stay as row headers.

## Edge Cases

- **No credit cards:** Hide the "Tarjetas de credito" row entirely
- **No loans:** Hide the "Prestamos" row entirely
- **Only one debt type:** General row + one type row (2 rows total)
- **No interest rate data:** "Deuda mas cara" tile shows "Sin datos" / is hidden
- **No payment day data:** "Proximo pago" tile hidden
- **Zero balance on all debts:** Show success state (existing pattern)
- **Single account:** "Mayor cuota" popover just shows the one account; still useful as headline number
