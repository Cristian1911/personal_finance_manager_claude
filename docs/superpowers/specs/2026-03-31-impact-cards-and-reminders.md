# Impact Cards & Financial Reminders — Design Spec

**Date:** 2026-03-31
**Branch:** `codex/action-first-ux`
**Status:** Approved

---

## Feature 1: Impact Cards ("Movimientos inteligentes")

### Purpose

When the user makes a significant positive financial event (debt payment, credit card payoff, loan abono), the app surfaces a contextual "impact card" that celebrates the win and shows the concrete effect on daily life. The goal is to reward good behavior and make the positive impact tangible.

### Trigger Conditions

An impact card is generated when:

1. **Statement import** — a new snapshot shows a reduced `remaining_balance` or `final_balance` vs the previous snapshot for the same account
2. **Recurring debt payment recorded** — user records a payment via `recordRecurringOccurrencePayment()` on a debt/credit account
3. **Significant utilization drop** — credit card utilization drops by 10+ percentage points between snapshots

### What Each Card Shows

Each impact card contains:

- **Event label** — e.g., "Abono a Visa Bancolombia"
- **Date** — when the event occurred
- **Amount paid** — the payment amount
- **Impact metrics** (computed from snapshot diff):
  - **Utilization change** — "Uso de cupo: 78% → 42%" (credit cards only)
  - **Monthly interest reduction** — "Interés mensual: -$85,000/mes" (using `estimateMonthlyInterest()` from `@zeta/shared/debt`)
  - **Timeline acceleration** — "Libre de deuda: 8 meses antes" (using debt simulator to compare old vs new payoff timeline)
  - **Available credit change** — "+$2,000,000 de cupo disponible" (credit cards only)

Only show metrics that are relevant to the account type and that changed meaningfully (skip zero-change lines).

### Data Source

- **No new database table** — impact cards are computed on-the-fly from existing `statement_snapshots` pairs
- Use `snapshot-diff` from `@zeta/shared` to diff consecutive snapshots per account
- Use `estimateMonthlyInterest()` and `calcUtilization()` from `@zeta/shared/debt` for metric calculations
- Use `debt-simulator` to compute timeline differences (months-to-freedom with old vs new balance)
- Filter to only "positive" diffs (balance decreased, utilization decreased, interest decreased)

### Where They Appear

1. **Dashboard widget** — "Movimientos recientes" section showing the last 2-3 impact events as compact cards. Placed in the dashboard grid alongside existing widgets.
2. **Debt page** — timeline of all impact events per account, most recent first. Integrated into the existing debt detail view.
3. **Toast celebration** — after recording a debt payment via the recurrentes page, show a brief celebratory toast with key metrics and a link to the full impact card.

### Server Action

```typescript
// webapp/src/actions/impact-events.ts
export async function getRecentImpactEvents(limit?: number): Promise<ImpactEvent[]>
export async function getAccountImpactEvents(accountId: string): Promise<ImpactEvent[]>
```

**`ImpactEvent` type:**
```typescript
interface ImpactEvent {
  accountId: string;
  accountName: string;
  accountType: string;
  date: string; // ISO date of the newer snapshot
  amountPaid: number; // abs(balance difference)
  currencyCode: string;
  metrics: {
    utilizationBefore?: number;
    utilizationAfter?: number;
    monthlyInterestBefore?: number;
    monthlyInterestAfter?: number;
    monthsToFreedomBefore?: number;
    monthsToFreedomAfter?: number;
    availableCreditBefore?: number;
    availableCreditAfter?: number;
  };
}
```

### Components

- `ImpactEventCard` — renders a single impact event with metrics
- `RecentImpactsWidget` — dashboard widget showing last 2-3 events
- `AccountImpactTimeline` — debt page timeline of all events for an account

### Cache Tags

- `"impact"` — revalidated by import-transactions, recurring payment recording
- Dashboard widgets use `"dashboard:hero"` tag (already revalidated by relevant mutations)

---

## Feature 2: Financial Reminders ("Pendientes")

### Purpose

A lightweight, one-time financial todo/reminder system. Not subscriptions, not recurring — simple tasks the user must remember to do, with optional due dates and amounts.

Examples: "Pagarle a Cami", "Pagar el JRE", "Pagar el SOAT antes del viernes"

### Database Schema

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_financial_reminders.sql

CREATE TABLE financial_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric(15,2),
  currency_code text DEFAULT 'COP',
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE financial_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminders"
  ON financial_reminders FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Indexes
CREATE INDEX idx_financial_reminders_user_pending
  ON financial_reminders (user_id, is_completed, due_date)
  WHERE NOT is_completed;
```

### Server Actions

```typescript
// webapp/src/actions/reminders.ts

export async function getReminders(filter?: "pending" | "completed"): Promise<Reminder[]>
export async function createReminder(formData: FormData): Promise<ActionResult<Reminder>>
export async function toggleReminder(id: string): Promise<ActionResult<null>>
export async function deleteReminder(id: string): Promise<ActionResult<null>>
```

**Validation (Zod):**
- `title`: string, 1-200 chars, required
- `amount`: number, positive, optional
- `currency_code`: string, optional (defaults to COP)
- `due_date`: date string, optional

**Cache tag:** `"reminders"` — revalidated on create/toggle/delete

### Where They Appear

#### 1. Standalone page — `/pendientes`

- Simple list view with sections: "Pendientes" (sorted by due_date, overdue first) and "Completados" (last 10)
- Inline add form at top: title input + optional amount + optional due date + submit
- Each item shows: title, amount (if set), due date (if set), complete checkbox
- Overdue items: red accent border/text on the due date
- Complete action: checkbox toggle → `toggleReminder()` → item moves to completed section with strikethrough animation
- Delete: small trash icon, visible on hover

#### 2. Dashboard widget — `PendientesWidget`

- Compact card in dashboard grid
- Shows next 3-5 pending items sorted by: overdue first, then nearest due date, then creation date
- Each item: title + due date (if set) + checkbox to complete inline
- Quick-add input at bottom: title-only for speed, due date/amount can be added from full page
- "Ver todos" link to `/pendientes`
- Empty state: "Sin pendientes" with a subtle add prompt

#### 3. Attention system integration

- In `getAttentionSnapshot()`, add a new signal:
  - **Signal type:** `"overdue_reminders"`
  - **Page:** `"pendientes"`
  - **Priority:** `"action"`
  - **Count:** number of reminders where `due_date < today AND NOT is_completed`
  - **Label:** "X pendiente(s) vencido(s)"
  - **Action href:** `/pendientes`
- 5 overdue reminders surfaces in attention card on dashboard and bandeja/gestionar

### Components

- `RemindersList` — full page list with sections and inline add
- `ReminderItem` — single reminder row (checkbox, title, amount, due date, delete)
- `ReminderQuickAdd` — inline form (used in both page and widget)
- `PendientesWidget` — dashboard widget (compact view + quick add)

### Route

- `/pendientes` — new route under `(dashboard)` layout group
- Add to sidebar navigation and mobile bottom nav

---

## Implementation Order

1. **Reminders first** — new table + CRUD + standalone page + dashboard widget + attention integration
2. **Impact cards second** — computed from existing data, no schema changes, dashboard widget + debt page integration + toast

Reminders are self-contained (new table, new page). Impact cards depend on existing snapshot infrastructure and benefit from having the reminders widget already in place on the dashboard (establishes the widget pattern).

---

## Out of Scope

- Push notifications / email reminders (future)
- Recurring reminders (use recurring templates instead)
- Reminder categories or tags (keep it simple)
- Impact cards for non-debt events (e.g., savings milestones — future)
- Persisting impact events in a table (compute on-the-fly from snapshots)
