# Dashboard Redesign — "Financial Command Center"

**Date:** 2026-03-06
**Status:** Approved
**Scope:** Webapp first, mobile adapts later
**Approach:** Complete redesign (Enfoque A — Financial Command Center)

## Problem Statement

The current dashboard is a vertical list of cards with no clear hierarchy. It fails to answer the three questions users ask when opening the app:

1. **How much can I actually spend?** — No distinction between total balance and money available after fixed obligations
2. **What payments are coming up?** — Upcoming payments are buried at position 8/9 in the scroll, easily missed
3. **Is my data fresh?** — No indicator of when account balances were last updated

Additionally, the visual identity does not match the product's quality — it lacks personality, interactive charts, and inline context that apps like Copilot Money deliver.

## Design Inspiration

- **Primary reference:** Copilot Money — clean, data-rich, charts with inline context
- **Visual principles:**
  - Widget-like cohesive blocks
  - Charts with inline badges/markers (no hover-dependency)
  - Multi-line comparative charts (ideal vs actual with semantic color)
  - Mini sparklines on accounts showing balance trends
  - Semantic color throughout (green/amber/red for states)

## Dashboard Layout (top to bottom)

### Section 1: Hero — "Tu dinero ahora"

Replaces: header, 4-5 InteractiveMetricCards, "Control de flujo" card.

**Structure:**
- Large primary number: "Disponible para gastar" = total liquid balance - pending fixed obligations
- 3 sub-cards:
  - **Saldo total** — sum of deposit accounts (savings, checking, wallets). Excludes debt
  - **Fijos pendientes** — unpaid recurring obligations for the month + count of pending payments
  - **Libre** — the difference (saldo - fijos)
- Freshness indicator based on account `updated_at`:
  - Green: updated today
  - Amber: 2-3 days stale
  - Red: 4+ days stale, with "Actualizar saldos" CTA button
- Month selector integrated in the header row

**Data sources:**
- Accounts table (current_balance, account_type, updated_at)
- Recurring templates / payment reminders (pending for current month)

### Section 2: Upcoming Payments

Replaces: UpcomingRecurringCard (was position 8/9), PaymentRemindersCard (merged here).

**Structure:**
- Grouped by temporal proximity: "Hoy", "Esta semana", "Este mes"
- Today/overdue items highlighted with red/amber color
- Each item shows: name, amount, due date
- "Total pendiente" footer — same number as "Fijos pendientes" in hero (connected)
- Empty state collapses to single line: "Todos los pagos del mes estan al dia"

**Interactions:**
- Click payment -> mark as paid (registers transaction) or snooze
- "Ver todos" link to full recurring/payments view

**Data sources:**
- Recurring templates (getUpcomingRecurrences)
- Payment reminders (getUpcomingPayments)

### Section 3: Accounts with Sparklines

Replaces: flat "Cuentas" card, "Deuda total" card.

**Structure:**
- Grouped: "Cuentas de deposito" and "Deuda"
- Each account row shows:
  - Freshness dot (green/amber/red)
  - Account name
  - Sparkline (last 30 days for deposits, last 6 months for debt)
  - Current balance
  - % change vs previous period

**Deposit accounts:**
- Sparkline + percentage change
- Semantic color: green (balance up/stable), amber (gradual decline), red (>30% drop in month)

**Credit cards:**
- Sparkline + utilization bar
- Color thresholds: green <30%, amber 30-60%, red >60%
- Shows: credit limit, used amount, utilization %

**Loans:**
- Sparkline + installment progress (cuota X de Y)
- Color: green (on track, balance decreasing), amber (stagnant), red (balance growing)

**Interactions:**
- Click account -> navigate to account detail

**Data sources:**
- Accounts table (current_balance, credit_limit, currency_code, updated_at)
- Statement snapshots (historical balance data for sparklines)

### Section 4: Analysis — Interactive Charts

Replaces: 3 status cards (flujo, presupuesto, calidad datos), 4 chart components, InteractiveMetricCards for income/expenses/savings rate.

**Chart 1: Daily Spending vs Budget**
- Solid line: actual cumulative spending
- Dotted line: ideal pace (budget / days in month)
- Orange dot on current day with inline badge showing today's value
- Color: green if below ideal line, red if above
- Footer: accumulated bar "Acumulado: $890K de $1.5M (59%)"

**Chart 2: Income vs Expenses (6 months)**
- Solid line: income
- Dotted line: expenses
- Badge on current month: income amount, expense amount, savings rate, trend vs previous month

**Chart 3: Spending by Category**
- Donut chart with top 5 categories
- Ordered list with color dot, category name, amount, percentage
- Click category -> filters to transactions for that category

**All charts:**
- Show context inline via badges and annotated points — no hover/tooltip dependency
- Responsive: stack vertically on narrow viewports

### Section 5: Recent Transactions

Kept from current design with minimal changes.

- Last 5 transactions
- Direction icon (inflow green, outflow orange)
- Merchant/description, date, formatted amount
- "Ver todas" link

## Elements Removed from Dashboard

| Current Element | Destination |
|---|---|
| PurchaseDecisionCard | Moves to transactions page or nav quick action |
| Plan de accion (3 links) | Eliminated — actions are implicit in payments + freshness |
| Card "Calidad de datos" | Subtle badge/chip in category section (e.g., "12 sin categoria") |
| Card "Control de flujo" | Absorbed by hero + daily spending chart |
| Card "Ejecucion presupuesto" | Absorbed by daily spending vs budget chart |
| Card "Deuda total" | Absorbed by accounts section |
| NetWorthHistoryChart | Optional in analysis section or moved to accounts page |

## Semantic Color System

| Context | Green | Amber | Red |
|---|---|---|---|
| Freshness | Updated today | 2-3 days stale | 4+ days stale |
| Deposit balance trend | Rising/stable | Gradual decline | >30% drop |
| Credit utilization | <30% | 30-60% | >60% |
| Loan progress | Balance decreasing | Stagnant | Balance growing |
| Spending vs budget | Below ideal pace | Approaching limit | Over budget |

## Platform Strategy

- **Webapp first:** Design and implement the full dashboard in Next.js
- **Mobile adapts:** Same data model and queries, adapted to React Native layout
- **Design doc covers both** conceptually, implementation plan starts with webapp

## Out of Scope (Future Ideas)

- Integrated calendar view (validated but needs design exploration)
- Pay stub import (gross salary -> net breakdown)
- Customizable widget grid layout
- Dark mode
