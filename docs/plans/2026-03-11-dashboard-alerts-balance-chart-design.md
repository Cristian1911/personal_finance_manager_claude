# Dashboard Alerts, Balance Chart Enhancement & Account Staleness

**Date**: 2026-03-11
**Status**: Approved

## Overview

Three related enhancements to improve financial awareness:

1. **Balance history chart time ranges** — variable time range selector on account detail pages
2. **Dashboard alerts section** — extensible, dismissible alert system on the dashboard
3. **Per-account staleness indicator** — visual cue on stale accounts in the accounts overview

## 1. Balance History Chart — Time Range Selector

**Component**: `webapp/src/components/charts/balance-history-chart.tsx`

Add a toggle group to the card header with options: **3M, 6M, 1Y, Todo**.

- Default: "Todo" (current behavior)
- Filter snapshots client-side by comparing `period_to` against `Date.now() - rangeMs`
- No new server action — all snapshots are already passed as props
- If filtered data has fewer than 2 points, fall back to showing all data
- Use shadcn `ToggleGroup` for the selector, placed in `CardHeader` next to the title

**Data flow**: `snapshots[] → useState(range) → useMemo(filteredData) → AreaChart`

## 2. Dashboard Alerts Section

**New component**: `webapp/src/components/dashboard/dashboard-alerts.tsx`

**Placement**: Between upcoming payments and analysis charts on the dashboard page.

### Alert Registry Pattern

```typescript
type DashboardAlert = {
  key: string;           // unique key for dismissal (e.g., "stale_import:uuid")
  priority: number;      // lower = shown first
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

type AlertProducer = (context: AlertContext) => DashboardAlert[];
```

Each producer receives `AlertContext` (accounts, snapshots, etc.) and returns 0+ alerts. The component collects alerts from all producers, filters out dismissed ones, sorts by priority, and renders.

### First Alert Type: Stale Import

- **Condition**: account's most recent `statement_snapshots.created_at` (or `accounts.updated_at` if no snapshots) is older than 30 days
- **Message**: "Hace {N} días que no importas un extracto de {account.name}"
- **Action**: "Importar extracto" → `/import`
- **Priority**: 10

### Dismissal Mechanism

- `localStorage` key: `zeta_dismissed_alerts`
- Value: `Record<string, number>` mapping alert keys to snooze-until timestamps
- Snooze duration: 7 days
- On dismiss: store `Date.now() + 7 * 86400000` for the alert key
- On render: skip alerts where `snoozedUntil > Date.now()`

### Rendering

- Dismissible cards with icon, message, and optional action button
- Close button (X) triggers snooze
- If no active alerts: render nothing (no empty state, no wrapper)
- Max 3 visible alerts at once (avoid overwhelming)
- Mobile: same component, stacked vertically

### Data Source

Reuse existing dashboard data — no new server action. The dashboard page already fetches `allAccountsResult` and `heroData` which includes account timestamps. Pass relevant data as props to `<DashboardAlerts>`.

However, we need the latest snapshot `created_at` per account for accurate staleness. Add a lightweight server action `getLatestSnapshotDates()` that returns `Record<accountId, lastImportDate>`.

## 3. Per-Account Staleness Indicator

**Component**: `webapp/src/components/dashboard/accounts-overview.tsx` (AccountRow)

- After the account balance, show a subtle text label when the account hasn't been updated in 30+ days
- Format: `"hace {N} días"` in `text-warning` (amber) for 30-60 days, `text-destructive` (red) for 60+ days
- Use `accounts.updated_at` as the staleness source (already available in the account data)
- Only show for account types that support imports: CREDIT_CARD, LOAN, SAVINGS
- Do not show for CASH, CHECKING, INVESTMENT, OTHER (these are typically manually managed)

## Architecture Notes

- All three features are client-side rendering additions — no database changes
- One new server action: `getLatestSnapshotDates()` in `actions/statement-snapshots.ts`
- Alert system is extensible: future alerts (uncategorized transactions, budget overruns) just add new producer functions
- Dismissal state is local (localStorage) — acceptable for single-user app, revisit for multi-device sync later
