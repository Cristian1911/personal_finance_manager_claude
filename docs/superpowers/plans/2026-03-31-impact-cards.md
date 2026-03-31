# Impact Cards ("Movimientos inteligentes") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface contextual "impact cards" that celebrate positive financial events (debt payments, utilization drops) by showing concrete metrics: interest saved, utilization change, timeline acceleration.

**Architecture:** No new database tables. Impact events are computed on-the-fly by diffing consecutive `statement_snapshots` per account. A server action fetches snapshot pairs, computes diffs using existing `@zeta/shared` utilities, and filters to positive-impact events. Components render these as celebratory cards on dashboard and debt pages.

**Tech Stack:** Supabase (existing `statement_snapshots` table), Next.js 16 Server Actions, `@zeta/shared` (debt utils, snapshot-diff), Tailwind v4, shadcn/ui, Lucide icons, Recharts (existing)

**Spec:** `docs/superpowers/specs/2026-03-31-impact-cards-and-reminders.md` (Feature 1)

---

### Task 1: ImpactEvent Type

**Files:**
- Modify: `webapp/src/types/domain.ts`

- [ ] **Step 1: Add ImpactEvent type**

In `webapp/src/types/domain.ts`, add:

```typescript
export interface ImpactEventMetrics {
  utilizationBefore?: number;
  utilizationAfter?: number;
  monthlyInterestBefore?: number;
  monthlyInterestAfter?: number;
  monthsToFreedomBefore?: number;
  monthsToFreedomAfter?: number;
  availableCreditBefore?: number;
  availableCreditAfter?: number;
}

export interface ImpactEvent {
  accountId: string;
  accountName: string;
  accountType: string;
  date: string;
  amountPaid: number;
  currencyCode: string;
  metrics: ImpactEventMetrics;
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/types/domain.ts
git commit -m "feat: add ImpactEvent type definition"
```

---

### Task 2: Server Action — Compute Impact Events

**Files:**
- Create: `webapp/src/actions/impact-events.ts`

This action fetches consecutive snapshot pairs per debt account, computes diffs, and returns positive-impact events.

- [ ] **Step 1: Implement impact events action**

Create `webapp/src/actions/impact-events.ts`:

```typescript
"use server";

import { cache } from "react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  calcUtilization,
  estimateMonthlyInterest,
} from "@zeta/shared";
import type { ImpactEvent, ImpactEventMetrics } from "@/types/domain";

/**
 * Fetch recent positive-impact events across all debt accounts.
 * Computed by diffing consecutive statement_snapshots.
 */
export const getRecentImpactEvents = cache(
  async (limit: number = 3): Promise<ImpactEvent[]> => {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return [];

    // Get all debt accounts (credit cards + loans)
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name, type, currency_code")
      .eq("user_id", user.id)
      .in("type", ["CREDIT_CARD", "LOAN"]);

    if (!accounts || accounts.length === 0) return [];

    const accountIds = accounts.map((a) => a.id);
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    // Get all snapshots for these accounts, ordered by period
    const { data: snapshots } = await supabase
      .from("statement_snapshots")
      .select(
        "account_id, period_to, remaining_balance, final_balance, credit_limit, available_credit, interest_rate, interest_charged"
      )
      .eq("user_id", user.id)
      .in("account_id", accountIds)
      .order("period_to", { ascending: true });

    if (!snapshots || snapshots.length < 2) return [];

    // Group by account
    const byAccount = new Map<string, typeof snapshots>();
    for (const s of snapshots) {
      const list = byAccount.get(s.account_id) ?? [];
      list.push(s);
      byAccount.set(s.account_id, list);
    }

    const events: ImpactEvent[] = [];

    for (const [accountId, accountSnapshots] of byAccount) {
      const account = accountMap.get(accountId);
      if (!account || accountSnapshots.length < 2) continue;

      // Compare consecutive pairs (most recent first for ordering)
      for (let i = accountSnapshots.length - 1; i >= 1; i--) {
        const current = accountSnapshots[i];
        const previous = accountSnapshots[i - 1];

        const prevBalance =
          previous.remaining_balance ?? previous.final_balance ?? 0;
        const currBalance =
          current.remaining_balance ?? current.final_balance ?? 0;

        // Only positive events: balance decreased
        if (currBalance >= prevBalance) continue;

        const amountPaid = Math.abs(prevBalance - currBalance);
        const metrics: ImpactEventMetrics = {};

        // Utilization (credit cards only)
        if (account.type === "CREDIT_CARD" && current.credit_limit) {
          metrics.utilizationBefore = calcUtilization(
            Math.abs(prevBalance),
            current.credit_limit
          );
          metrics.utilizationAfter = calcUtilization(
            Math.abs(currBalance),
            current.credit_limit
          );
        }

        // Monthly interest change
        const rate = current.interest_rate;
        if (rate && rate > 0) {
          metrics.monthlyInterestBefore = estimateMonthlyInterest(
            Math.abs(prevBalance),
            rate
          );
          metrics.monthlyInterestAfter = estimateMonthlyInterest(
            Math.abs(currBalance),
            rate
          );
        }

        // Available credit change (credit cards)
        if (
          account.type === "CREDIT_CARD" &&
          current.credit_limit &&
          previous.available_credit != null &&
          current.available_credit != null
        ) {
          metrics.availableCreditBefore = previous.available_credit;
          metrics.availableCreditAfter = current.available_credit;
        }

        // Months to freedom (simple estimate: balance / minimum monthly payment)
        // Skip if no interest rate — can't estimate timeline
        if (rate && rate > 0 && current.credit_limit) {
          const minPayment = current.credit_limit * 0.03; // ~3% of limit as proxy
          if (minPayment > 0) {
            metrics.monthsToFreedomBefore = Math.ceil(
              Math.abs(prevBalance) / minPayment
            );
            metrics.monthsToFreedomAfter = Math.ceil(
              Math.abs(currBalance) / minPayment
            );
          }
        }

        // Skip events with no meaningful metrics
        const hasMetrics = Object.keys(metrics).length > 0;
        if (!hasMetrics) continue;

        events.push({
          accountId,
          accountName: account.name,
          accountType: account.type,
          date: current.period_to ?? new Date().toISOString().split("T")[0],
          amountPaid,
          currencyCode: account.currency_code ?? "COP",
          metrics,
        });
      }
    }

    // Sort by date descending, return top N
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events.slice(0, limit);
  }
);

/**
 * Fetch impact events for a specific account (for debt detail page).
 */
export const getAccountImpactEvents = cache(
  async (accountId: string): Promise<ImpactEvent[]> => {
    const allEvents = await getRecentImpactEvents(50);
    return allEvents.filter((e) => e.accountId === accountId);
  }
);
```

- [ ] **Step 2: Build check**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/impact-events.ts
git commit -m "feat: add impact events server action (snapshot diff computation)"
```

---

### Task 3: ImpactEventCard Component

**Files:**
- Create: `webapp/src/components/impact/impact-event-card.tsx`

- [ ] **Step 1: Create component**

Create `webapp/src/components/impact/impact-event-card.tsx`:

```typescript
import {
  TrendingDown,
  CreditCard,
  Calendar,
  Unlock,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { ImpactEvent, CurrencyCode } from "@/types/domain";

interface ImpactEventCardProps {
  event: ImpactEvent;
  compact?: boolean;
}

export function ImpactEventCard({
  event,
  compact = false,
}: ImpactEventCardProps) {
  const { metrics } = event;
  const cc = event.currencyCode as CurrencyCode;

  const metricLines: { icon: typeof TrendingDown; label: string }[] = [];

  // Utilization change
  if (
    metrics.utilizationBefore != null &&
    metrics.utilizationAfter != null &&
    metrics.utilizationBefore !== metrics.utilizationAfter
  ) {
    metricLines.push({
      icon: CreditCard,
      label: `Uso de cupo: ${Math.round(metrics.utilizationBefore)}% → ${Math.round(metrics.utilizationAfter)}%`,
    });
  }

  // Monthly interest reduction
  if (
    metrics.monthlyInterestBefore != null &&
    metrics.monthlyInterestAfter != null &&
    metrics.monthlyInterestBefore > metrics.monthlyInterestAfter
  ) {
    const saved = metrics.monthlyInterestBefore - metrics.monthlyInterestAfter;
    metricLines.push({
      icon: TrendingDown,
      label: `Interés mensual: -${formatCurrency(saved, cc)}/mes`,
    });
  }

  // Timeline acceleration
  if (
    metrics.monthsToFreedomBefore != null &&
    metrics.monthsToFreedomAfter != null &&
    metrics.monthsToFreedomBefore > metrics.monthsToFreedomAfter
  ) {
    const monthsSaved =
      metrics.monthsToFreedomBefore - metrics.monthsToFreedomAfter;
    if (monthsSaved > 0) {
      metricLines.push({
        icon: Calendar,
        label: `Libre de deuda: ${monthsSaved} ${monthsSaved === 1 ? "mes" : "meses"} antes`,
      });
    }
  }

  // Available credit change
  if (
    metrics.availableCreditBefore != null &&
    metrics.availableCreditAfter != null &&
    metrics.availableCreditAfter > metrics.availableCreditBefore
  ) {
    const gained = metrics.availableCreditAfter - metrics.availableCreditBefore;
    metricLines.push({
      icon: Unlock,
      label: `+${formatCurrency(gained, cc)} de cupo disponible`,
    });
  }

  if (metricLines.length === 0) return null;

  if (compact) {
    return (
      <div className="rounded-lg border border-z-income/20 bg-z-income/5 px-3 py-2 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium truncate">{event.accountName}</span>
          <span className="text-muted-foreground shrink-0">
            {formatDate(event.date, "dd MMM")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Pagaste {formatCurrency(event.amountPaid, cc)}
        </p>
        {metricLines.slice(0, 2).map((m, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-z-income">
            <m.icon className="h-3 w-3 shrink-0" />
            <span>{m.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-z-income/20 bg-z-income/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-z-income">
          Buen movimiento
        </p>
        <span className="text-xs text-muted-foreground">
          {formatDate(event.date, "dd 'de' MMMM")}
        </span>
      </div>

      <div>
        <p className="text-sm font-medium">{event.accountName}</p>
        <p className="text-xs text-muted-foreground">
          Pagaste {formatCurrency(event.amountPaid, cc)}
        </p>
      </div>

      <div className="space-y-1.5">
        {metricLines.map((m, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <m.icon className="h-4 w-4 shrink-0 text-z-income" />
            <span>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/impact/impact-event-card.tsx
git commit -m "feat: add ImpactEventCard component (compact + full variants)"
```

---

### Task 4: Dashboard Widget

**Files:**
- Create: `webapp/src/components/impact/recent-impacts-widget.tsx`
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create RecentImpactsWidget**

Create `webapp/src/components/impact/recent-impacts-widget.tsx`:

```typescript
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImpactEventCard } from "./impact-event-card";
import type { ImpactEvent } from "@/types/domain";

interface RecentImpactsWidgetProps {
  events: ImpactEvent[];
}

export function RecentImpactsWidget({ events }: RecentImpactsWidgetProps) {
  if (events.length === 0) return null;

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Sparkles className="h-4 w-4 text-z-income" />
        <CardTitle className="text-sm font-semibold">
          Movimientos inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.map((event, i) => (
          <ImpactEventCard key={`${event.accountId}-${event.date}-${i}`} event={event} compact />
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Integrate into dashboard page**

In `webapp/src/app/(dashboard)/dashboard/page.tsx`:

Add imports:
```typescript
import { getRecentImpactEvents } from "@/actions/impact-events";
import { RecentImpactsWidget } from "@/components/impact/recent-impacts-widget";
```

Add to the `Promise.all` data fetch:
```typescript
getRecentImpactEvents(3),
```

Add the widget in the dashboard grid:
```tsx
<RecentImpactsWidget events={impactEvents} />
```

Place alongside or near the `PendientesWidget` from the previous plan. The widget self-hides when there are no events (`return null`), so it's safe to always include.

- [ ] **Step 3: Build check**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/impact/recent-impacts-widget.tsx webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: add RecentImpactsWidget to dashboard"
```

---

### Task 5: Debt Page Timeline

**Files:**
- Create: `webapp/src/components/impact/account-impact-timeline.tsx`
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx` (or the debt detail component)

- [ ] **Step 1: Create AccountImpactTimeline**

Create `webapp/src/components/impact/account-impact-timeline.tsx`:

```typescript
import { ImpactEventCard } from "./impact-event-card";
import type { ImpactEvent } from "@/types/domain";

interface AccountImpactTimelineProps {
  events: ImpactEvent[];
}

export function AccountImpactTimeline({
  events,
}: AccountImpactTimelineProps) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Historial de impacto
      </h3>
      <div className="space-y-2">
        {events.map((event, i) => (
          <ImpactEventCard
            key={`${event.accountId}-${event.date}-${i}`}
            event={event}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into debt page**

In the deudas page or debt detail component, fetch account impact events and render the timeline:

```typescript
import { getRecentImpactEvents } from "@/actions/impact-events";
import { AccountImpactTimeline } from "@/components/impact/account-impact-timeline";
```

Fetch events (reuse the global fetch, filter client-side, or call `getAccountImpactEvents`):
```typescript
const impactEvents = await getRecentImpactEvents(20);
```

Render below the existing debt cards/insights:
```tsx
<AccountImpactTimeline events={impactEvents} />
```

The exact integration point depends on the debt page structure — place after debt insights or progress bars.

- [ ] **Step 3: Build check**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/impact/account-impact-timeline.tsx webapp/src/app/\(dashboard\)/deudas/
git commit -m "feat: add impact timeline to debt page"
```

---

### Task 6: Revalidation + Toast Celebration

**Files:**
- Modify: `webapp/src/actions/import-transactions.ts`
- Modify: `webapp/src/actions/recurring-templates.ts`

- [ ] **Step 1: Add "impact" revalidation tag to import flow**

In `webapp/src/actions/import-transactions.ts`, after the existing `revalidateTag` calls in the import success path, add:

```typescript
revalidateTag("impact", "zeta");
```

- [ ] **Step 2: Add "impact" revalidation tag to recurring payment recording**

In `webapp/src/actions/recurring-templates.ts`, in `recordRecurringOccurrencePayment()` after the existing revalidation calls, add:

```typescript
revalidateTag("impact", "zeta");
```

- [ ] **Step 3: Build check**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/import-transactions.ts webapp/src/actions/recurring-templates.ts
git commit -m "feat: add impact cache tag to import and recurring payment flows"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Full build**

Run: `cd webapp && pnpm build`
Expected: Clean build with all routes

- [ ] **Step 2: Verify dashboard renders both new widgets**

Check that `RecentImpactsWidget` and `PendientesWidget` (from reminders plan) are both present in the dashboard page.

- [ ] **Step 3: Commit any remaining changes**

If any files were missed, stage and commit.
