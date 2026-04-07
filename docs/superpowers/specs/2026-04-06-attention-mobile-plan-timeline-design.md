# Attention Mobile + Plan Timeline — Design Spec

**Date:** 2026-04-06
**Scope:** Two mobile-focused features from MANUAL_TODOS.md items #15 and #18.

---

## 1. Attention Section — Mobile Dashboard

### What it replaces

`InicioFocus` (`components/mobile/v2/inicio/inicio-focus.tsx`) — currently shows only the first attention signal as a single link. Replaced with a grid of 3 expandable chips with inline actions.

### Signals (3 only)

| Signal | Data source | Accent color | Actions |
|--------|------------|-------------|---------|
| **Pendientes vencidos** | `reminders` where `is_completed = false` AND `due_date < today` | Red (`#ef4444`) | Marcar hecho, Posponer |
| **Próximos pagos (7 días)** | `recurring_templates` upcoming within 7 days | Brass (`#b7a57a`) | Registrar pago |
| **Emails sin revisar** | `email_transactions` where `status = 'pending'` | Sage (`#8ea882`) | Importar, Descartar |

Signals removed from attention: uncategorized transactions, destinatario suggestions. These remain accessible from their respective pages and the movimientos herramientas section.

### Layout

- **Pattern:** Identical to `MovimientosHerramientas` — `grid grid-cols-3` chips + accordion panel below.
- **Position:** Replaces `InicioFocus` in `InicioRoot`, between `InicioMetricsGrid` and `InicioDiscovery`.
- **Accordion:** Participates in the global `useExpandableZone` of `InicioRoot` — only one section expanded at a time across the entire page.

### Chip anatomy

Each chip shows:
- **Count** — large number (22px, font-weight 680), colored by signal type
- **Label** — 10px muted text (e.g., "Vencidos", "Pagos", "Emails")
- **Subtitle** — 9px context line (e.g., "por resolver", "en 7 días", "sin revisar")
- Active chip has colored border + gradient background (same pattern as MovimientosHerramientas)
- Chip with count 0 uses neutral styling (no colored dot)

### Expanded panel

- Up to 5 items shown per panel
- Each item: icon + description + secondary info (date, amount) + action button(s)
- Footer: count ("3 de 5") + link to full page ("Ir a pendientes →")

**Per-signal actions:**

| Signal | Primary action | Secondary action |
|--------|---------------|-----------------|
| Vencidos | "Hecho" (marks reminder complete) | "Posponer" (defers due date +1 day) |
| Pagos | "Registrar" (records payment) | — |
| Emails | "Importar" (approves email tx) | "✕" / Descartar (dismisses) |

### Visibility rules

- If all 3 signals have count 0: the entire section is hidden (returns `null`).
- Individual chips always render if the section is visible (even if their count is 0).

### Data flow

```
dashboard/page.tsx (Server Component)
├─ getAttentionItems()  →  new server action, returns typed data for all 3 signals
└─ InicioRoot
   └─ InicioAttention (new component, replaces InicioFocus)
      ├─ chips (client state)
      └─ expanded panels with server actions for mutations
```

### New server action: `getAttentionItems()`

Returns the actual items (not just counts) for the 3 signals:

```typescript
type AttentionItems = {
  overdueReminders: Array<{
    id: string;
    title: string;
    amount: number | null;
    due_date: string;
  }>;
  upcomingPayments: Array<{
    id: string;
    name: string;
    amount: number;
    next_date: string;
    direction: "INFLOW" | "OUTFLOW";
  }>;
  pendingEmails: Array<{
    id: string;
    merchant: string;
    amount: number;
    direction: "INFLOW" | "OUTFLOW";
    date: string;
    card_last4: string | null;
  }>;
};
```

This is separate from the existing `getAttentionSnapshot()` which returns counts for nav badges. The snapshot continues to power the sidebar/topbar; this new action provides the item-level data needed for inline actions.

### Mutation actions (reuse existing)

- `completeReminder(id)` — from `actions/reminders.ts`
- `postponeReminder(id, newDate)` — from `actions/reminders.ts`
- `registerRecurringPayment(templateId)` — from `actions/recurring-templates.ts`
- `approveEmailTransaction(id)` — from `actions/email-ingest.ts`
- `dismissEmailTransaction(id)` — from `actions/email-ingest.ts`

### Files to create/modify

| Action | File |
|--------|------|
| Create | `components/mobile/v2/inicio/inicio-attention.tsx` |
| Create | `actions/attention-items.ts` (new server action) |
| Modify | `components/mobile/v2/inicio/inicio-root.tsx` (swap InicioFocus → InicioAttention) |
| Modify | `app/(dashboard)/dashboard/page.tsx` (pass attention items data) |
| No change | `actions/attention.ts` (snapshot stays as-is — still powers desktop card + nav badges) |
| Modify | `types/attention.ts` (add AttentionItems type) |
| Delete | `components/mobile/v2/inicio/inicio-focus.tsx` (replaced) |

---

## 2. Plan Timeline — "Show the Point"

### What it replaces

`PlanFlowChart` (`components/mobile/v2/plan/plan-flow-chart.tsx`) — currently shows a simple bar chart of projected income/expenses from recurring templates only. Replaced with a timeline that combines real past data with projected future data, plus a cumulative balance line.

### Visual design

- **Bars:** Vertical, centered on each active day along the X axis
  - Above zero line: income (green `#10b981`)
  - Below zero line: expenses (red `#ef4444`)
- **Zero line:** Horizontal brass line (`#b7a57a`, opacity 0.4, stroke-width 1.5) — "the point"
- **Today marker:** Vertical dashed line separating past from future
- **Past bars:** Full opacity (0.85 income, 0.75 expense)
- **Future bars:** Reduced opacity (0.35) + dashed stroke border
- **Cumulative balance line:** Brass polyline — solid for past, dashed for future
- **Danger zone:** Subtle red gradient overlay where projected balance goes below zero
- **Warning chip:** Below chart when negative balance is projected, stating the date range

### Data sources

**Past (real transactions):**
- Query transactions for the current month, aggregate by day
- Group by direction: INFLOW vs OUTFLOW
- Source: existing `getTransactions()` or new lightweight query

**Future (projected):**
- From `planData.recurring.upcoming` (already available in plan page)
- Same data the current PlanFlowChart uses

**Cumulative balance:**
- Start from account balance at start of month (or current balance minus MTD transactions)
- Add/subtract each day's net to compute running total
- This is what draws the brass line and determines the danger zone

### Summary row

Below the chart, 3 metrics in a horizontal row:
- **Ingresos** (green) — total income (real + projected)
- **Gastos** (red) — total expenses (real + projected)
- **Neto** (brass) — difference

### New server action: `getPlanTimelineData()`

```typescript
type PlanTimelineData = {
  days: Array<{
    day: number;
    income: number;
    expense: number;
    isReal: boolean; // true for past, false for projected
  }>;
  cumulativeBalance: Array<{
    day: number;
    balance: number;
  }>;
  startingBalance: number;
  totalIncome: number;
  totalExpense: number;
  dangerZone: { startDay: number; endDay: number } | null;
  daysInMonth: number;
  dayOfMonth: number;
};
```

### Component structure

The new `PlanFlowChart` keeps the same interface but adds:
- `realTransactions` prop (past data) alongside existing `upcoming` (future data)
- `startingBalance` prop for cumulative line calculation
- Internal computation merges both into the day-by-day view

### SVG approach

Custom SVG (no recharts) — same as current implementation. The chart needs precise control over opacity, dashing, gradient overlays, and the balance polyline that recharts doesn't provide cleanly.

### View toggle (deferred)

A tab/toggle between "Timeline" and "Distribución" will be added when the distribution view design is defined. For now, the component renders only the timeline view. The component accepts an optional `view` prop for future extensibility.

### Files to create/modify

| Action | File |
|--------|------|
| Rewrite | `components/mobile/v2/plan/plan-flow-chart.tsx` |
| Create | `actions/plan-timeline.ts` (server action for combined real+projected data) |
| Modify | `app/(dashboard)/plan/page.tsx` (pass timeline data) |
| Modify | `actions/plan.ts` (integrate timeline data into getPlanPageData or call separately) |

---

## 3. Desktop scope

Desktop attention section redesign is **explicitly deferred**. The existing `AttentionCard` continues to work on desktop. Only the mobile `InicioFocus` → `InicioAttention` replacement is in scope.

The plan timeline change applies to the mobile plan view. The desktop plan page can consume the same component if desired, but is not a requirement for this iteration.

---

## 4. What's NOT changing

- `getAttentionSnapshot()` continues to provide counts for nav badges (sidebar, topbar, quick-view)
- `AttentionCard` (desktop dashboard) unchanged
- `AttentionHub` (`/gestionar` page) unchanged
- `MovimientosHerramientas` unchanged (reference pattern, not modified)
- Distribution view for plan (deferred until visual examples provided)
