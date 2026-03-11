# Dashboard Alerts, Balance Chart & Staleness Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add time range selector to balance history chart, an extensible dismissible alerts section on the dashboard, and per-account staleness indicators.

**Architecture:** Three independent UI features with no DB changes. The balance chart adds client-side filtering with a toggle group. The alerts section uses a producer pattern for extensibility, with localStorage-based dismissal. The staleness indicator adds a label to existing account rows.

**Tech Stack:** React, Recharts, shadcn/ui (ToggleGroup, Card), localStorage, Next.js Server Actions

**Spec:** `docs/plans/2026-03-11-dashboard-alerts-balance-chart-design.md`

---

## Task 1: Add ToggleGroup component (shadcn)

**Files:**
- Create: `webapp/src/components/ui/toggle-group.tsx`

- [ ] **Step 1: Add shadcn ToggleGroup component**

Run: `cd webapp && pnpm dlx shadcn@latest add toggle-group`

If the CLI prompts, accept defaults. This creates the component file.

- [ ] **Step 2: Verify the component exists**

Run: `ls webapp/src/components/ui/toggle-group.tsx`

Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/ui/toggle-group.tsx
git commit -m "chore: add shadcn ToggleGroup component"
```

---

## Task 2: Balance history chart — time range selector

**Files:**
- Modify: `webapp/src/components/charts/balance-history-chart.tsx`

- [ ] **Step 1: Add useState and time range filtering**

Replace the entire `balance-history-chart.tsx` with:

```tsx
"use client";

import { useState, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { Tables } from "@/types/database";

interface Props {
  snapshots: Tables<"statement_snapshots">[];
  currency: Tables<"accounts">["currency_code"];
}

const chartConfig = {
  balance: {
    label: "Saldo",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

type TimeRange = "3m" | "6m" | "1y" | "all";

const RANGE_MS: Record<Exclude<TimeRange, "all">, number> = {
  "3m": 90 * 24 * 60 * 60 * 1000,
  "6m": 180 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
};

export function BalanceHistoryChart({ snapshots, currency }: Props) {
  const [range, setRange] = useState<TimeRange>("all");

  const allData = useMemo(() => {
    return [...snapshots]
      .filter((s) => s.final_balance !== null && s.period_to !== null)
      .sort(
        (a, b) =>
          new Date(a.period_to!).getTime() - new Date(b.period_to!).getTime()
      )
      .map((s) => ({
        date: s.period_to as string,
        balance: s.final_balance as number,
      }));
  }, [snapshots]);

  const data = useMemo(() => {
    if (range === "all") return allData;
    const cutoff = Date.now() - RANGE_MS[range];
    const filtered = allData.filter(
      (d) => new Date(d.date).getTime() >= cutoff
    );
    // Fall back to all data if filtered has fewer than 2 points
    return filtered.length >= 2 ? filtered : allData;
  }, [allData, range]);

  if (allData.length < 2) {
    return null;
  }

  const minBalance = Math.min(...data.map((d) => d.balance));

  const formatYAxis = (v: number) => {
    if (Math.abs(v) >= 1_000_000)
      return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return String(v);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Historial de Saldo</CardTitle>
          <CardDescription>
            Evolución del saldo según tus extractos
          </CardDescription>
        </div>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(v) => {
            if (v) setRange(v as TimeRange);
          }}
          className="gap-0.5"
        >
          <ToggleGroupItem value="3m" className="h-7 px-2 text-xs">
            3M
          </ToggleGroupItem>
          <ToggleGroupItem value="6m" className="h-7 px-2 text-xs">
            6M
          </ToggleGroupItem>
          <ToggleGroupItem value="1y" className="h-7 px-2 text-xs">
            1A
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="h-7 px-2 text-xs">
            Todo
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[240px] w-full overflow-hidden"
        >
          <AreaChart
            data={data}
            accessibilityLayer
            margin={{ top: 10, left: -20, right: 12, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="fillBalance"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-balance)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-balance)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("es-CO", {
                  month: "short",
                  year: "2-digit",
                });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[minBalance > 0 ? 0 : "dataMin", "auto"]}
              tickFormatter={formatYAxis}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
                    <p className="font-medium mb-1.5 text-muted-foreground">
                      {formatDate(d.date)}
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: "var(--color-balance)",
                        }}
                      />
                      <span className="font-medium">
                        {formatCurrency(d.balance, currency)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Area
              dataKey="balance"
              type="monotone"
              fill="url(#fillBalance)"
              fillOpacity={1}
              stroke="var(--color-balance)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Build to verify no type errors**

Run: `cd webapp && pnpm build`

Expected: Clean build, no errors

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/charts/balance-history-chart.tsx
git commit -m "feat: add time range selector to balance history chart"
```

---

## Task 3: Server action — getLatestSnapshotDates

**Files:**
- Modify: `webapp/src/actions/statement-snapshots.ts`

- [ ] **Step 1: Add getLatestSnapshotDates function**

Append to `webapp/src/actions/statement-snapshots.ts`:

```typescript
/**
 * Get the most recent snapshot created_at per account.
 * Used by the dashboard alerts to determine import staleness.
 */
export async function getLatestSnapshotDates(): Promise<
  Record<string, string>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return {};

  const { data } = await supabase
    .from("statement_snapshots")
    .select("account_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!data) return {};

  // Keep only the most recent per account
  const result: Record<string, string> = {};
  for (const row of data) {
    if (!result[row.account_id]) {
      result[row.account_id] = row.created_at;
    }
  }
  return result;
}
```

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/statement-snapshots.ts
git commit -m "feat: add getLatestSnapshotDates server action"
```

---

## Task 4: Dashboard alerts component

**Files:**
- Create: `webapp/src/components/dashboard/dashboard-alerts.tsx`

- [ ] **Step 1: Create the DashboardAlerts component**

Create `webapp/src/components/dashboard/dashboard-alerts.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, FileUp, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

// --- Alert types ---

export type DashboardAlert = {
  key: string;
  priority: number;
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

type AlertContext = {
  accounts: {
    id: string;
    name: string;
    account_type: string;
    updated_at: string | null;
  }[];
  latestSnapshotDates: Record<string, string>;
};

// --- Dismissal helpers (localStorage) ---

const STORAGE_KEY = "zeta_dismissed_alerts";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getDismissedMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function dismissAlert(key: string) {
  const map = getDismissedMap();
  map[key] = Date.now() + SNOOZE_MS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function isDismissed(key: string): boolean {
  const map = getDismissedMap();
  const snoozedUntil = map[key];
  if (!snoozedUntil) return false;
  if (Date.now() > snoozedUntil) {
    // Expired — clean up
    delete map[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return false;
  }
  return true;
}

// --- Alert producers ---

const IMPORTABLE_TYPES = new Set(["CREDIT_CARD", "LOAN", "SAVINGS"]);
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function staleImportAlerts(ctx: AlertContext): DashboardAlert[] {
  const now = Date.now();
  const alerts: DashboardAlert[] = [];

  for (const account of ctx.accounts) {
    if (!IMPORTABLE_TYPES.has(account.account_type)) continue;

    const lastDate =
      ctx.latestSnapshotDates[account.id] ?? account.updated_at;
    if (!lastDate) continue;

    const ageMs = now - new Date(lastDate).getTime();
    if (ageMs < STALE_THRESHOLD_MS) continue;

    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    alerts.push({
      key: `stale_import:${account.id}`,
      priority: 10,
      icon: FileUp,
      title: account.name,
      description: `Hace ${days} días que no importas un extracto`,
      actionLabel: "Importar extracto",
      actionHref: "/import",
    });
  }

  return alerts;
}

const ALERT_PRODUCERS = [staleImportAlerts];

// --- Component ---

const MAX_VISIBLE = 3;

interface DashboardAlertsProps {
  accounts: {
    id: string;
    name: string;
    account_type: string;
    updated_at: string | null;
  }[];
  latestSnapshotDates: Record<string, string>;
}

export function DashboardAlerts({
  accounts,
  latestSnapshotDates,
}: DashboardAlertsProps) {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ctx: AlertContext = { accounts, latestSnapshotDates };

  const allAlerts = ALERT_PRODUCERS.flatMap((producer) => producer(ctx))
    .sort((a, b) => a.priority - b.priority);

  const visibleAlerts = mounted
    ? allAlerts
        .filter((a) => !isDismissed(a.key) && !dismissedKeys.has(a.key))
        .slice(0, MAX_VISIBLE)
    : [];

  const handleDismiss = useCallback((key: string) => {
    dismissAlert(key);
    setDismissedKeys((prev) => new Set(prev).add(key));
  }, []);

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.key}
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30"
        >
          <alert.icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{alert.title}</p>
            <p className="text-xs text-muted-foreground">
              {alert.description}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {alert.actionHref && (
              <Link href={alert.actionHref}>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  {alert.actionLabel}
                </Button>
              </Link>
            )}
            <button
              onClick={() => handleDismiss(alert.key)}
              className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              aria-label={`Ocultar alerta: ${alert.title}`}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

Expected: Clean build (component not yet used in a page)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/dashboard/dashboard-alerts.tsx
git commit -m "feat: add extensible DashboardAlerts component with stale import alerts"
```

---

## Task 5: Wire alerts into dashboard page

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Add imports**

At top of `dashboard/page.tsx`, add:

```typescript
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { getLatestSnapshotDates } from "@/actions/statement-snapshots";
```

- [ ] **Step 2: Add getLatestSnapshotDates to the parallel fetch**

Change the `Promise.all` block from:

```typescript
const [heroData, accountsData, budgetPaceData, cashflowData, categoryData, allAccountsResult] =
    await Promise.all([
      getDashboardHeroData(month),
      getAccountsWithSparklineData(),
      getDailyBudgetPace(month),
      getMonthlyCashflow(month),
      getCategorySpending(month),
      getAccounts(),
    ]);
```

To:

```typescript
const [heroData, accountsData, budgetPaceData, cashflowData, categoryData, allAccountsResult, latestSnapshotDates] =
    await Promise.all([
      getDashboardHeroData(month),
      getAccountsWithSparklineData(),
      getDailyBudgetPace(month),
      getMonthlyCashflow(month),
      getCategorySpending(month),
      getAccounts(),
      getLatestSnapshotDates(),
    ]);
```

- [ ] **Step 3: Insert DashboardAlerts between payments/accounts and analysis**

In the desktop dashboard JSX, between the `{/* 2. Payments + Accounts */}` grid and `{/* 3. Analysis */}`, insert:

```tsx
          {/* 2.5 Alerts */}
          <DashboardAlerts
            accounts={allAccounts.map((a) => ({
              id: a.id,
              name: a.name,
              account_type: a.account_type,
              updated_at: a.updated_at,
            }))}
            latestSnapshotDates={latestSnapshotDates}
          />
```

- [ ] **Step 4: Build to verify**

Run: `cd webapp && pnpm build`

Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: wire DashboardAlerts into dashboard page"
```

---

## Task 6: Per-account staleness indicator

**Files:**
- Modify: `webapp/src/components/dashboard/accounts-overview.tsx`

- [ ] **Step 1: Add staleness label to AccountRow**

In `accounts-overview.tsx`, inside the `AccountRow` component, after the `installmentProgress` block (after line 66), add:

```tsx
          {(() => {
            const importableTypes = new Set(["CREDIT_CARD", "LOAN", "SAVINGS"]);
            if (!importableTypes.has(account.account_type) || !account.updated_at) return null;
            const daysAgo = Math.floor(
              (Date.now() - new Date(account.updated_at).getTime()) / (24 * 60 * 60 * 1000)
            );
            if (daysAgo < 30) return null;
            const color = daysAgo >= 60 ? "text-destructive" : "text-amber-500 dark:text-amber-400";
            return (
              <p className={`text-xs ${color}`}>
                hace {daysAgo} días
              </p>
            );
          })()}
```

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/dashboard/accounts-overview.tsx
git commit -m "feat: add staleness indicator to account rows (30+ days)"
```

---

## Task 7: Update roadmap and final verification

**Files:**
- Modify: `.claude/todo.md`

- [ ] **Step 1: Mark features as completed in roadmap**

In `.claude/todo.md`, update the "Future Ideas" section to mark:
- Balance-over-time charts → completed (time range selector on account detail)
- Payment reminders → completed (existing UpcomingPayments; mobile push deferred)
- Import reminder → completed (dashboard alerts + per-account staleness)

- [ ] **Step 2: Full build verification**

Run: `cd webapp && pnpm build`

Expected: Clean build with no errors

- [ ] **Step 3: Commit**

```bash
git add .claude/todo.md
git commit -m "chore: mark dashboard features as completed in roadmap"
```
