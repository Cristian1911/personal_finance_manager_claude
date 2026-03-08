# Mobile Responsiveness + Recurring Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the webapp usable on mobile (375px) and redesign the recurring payments page with a timeline-first layout, two-step confirm, and undo support.

**Architecture:** Global CSS fixes (responsive grids, flex-wrap, viewport meta) applied across ~15 files. Recurring page gets new components (summary bar, mini calendar, payment timeline, confirm sheet, completed accordion) backed by a shared hook extracted from existing logic. Transaction filters collapse into a mobile sheet.

**Tech Stack:** Next.js 15, Tailwind v4, shadcn/ui (Sheet, Accordion, Collapsible), date-fns, sonner (toast with undo)

---

## Task 1: Viewport Meta Tag + Month Selector

**Files:**
- Modify: `webapp/src/app/layout.tsx`
- Modify: `webapp/src/components/month-selector.tsx` (line 57)

**Step 1: Add viewport metadata to root layout**

In `webapp/src/app/layout.tsx`, add the viewport export alongside the existing metadata:

```tsx
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};
```

**Step 2: Fix month selector min-width**

In `webapp/src/components/month-selector.tsx` line 57, change:
```tsx
// Before:
className="min-w-[160px] capitalize"
// After:
className="min-w-[120px] sm:min-w-[160px] capitalize"
```

**Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/month-selector.tsx
git commit -m "fix: add viewport meta tag and responsive month selector"
```

---

## Task 2: Form Grids Responsive

Convert `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` in all form files. Skip files already responsive.

**Files:**
- Modify: `webapp/src/components/transactions/transaction-form.tsx` (lines 64, 94)
- Modify: `webapp/src/components/accounts/specialized-account-form.tsx` (lines 56, 82, 127, 163, 227, 373)
- Modify: `webapp/src/components/recurring/recurring-form.tsx` (lines 123, 165, 277)
- Modify: `webapp/src/components/categories/category-form-modal.tsx` (line 129)
- Modify: `webapp/src/components/transactions/quick-capture-bar.tsx` (lines 202, 237)
- Modify: `webapp/src/app/(dashboard)/transactions/[id]/page.tsx` (line 76)
- Modify: `webapp/src/components/debt/debt-account-card.tsx` (line 127)

**Step 1: Apply grid-cols fix across all files**

In every file listed above, find each instance of:
```
grid grid-cols-2
```
and replace with:
```
grid grid-cols-1 sm:grid-cols-2
```

**Do NOT modify** lines that already have `sm:grid-cols-*` or `md:grid-cols-*` breakpoints (e.g., `recurring-calendar-checklist.tsx` line 368, `statement-summary-card.tsx`, `specialized-account-form.tsx` line 318).

**Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: make form grids stack on mobile (grid-cols-1 sm:grid-cols-2)"
```

---

## Task 3: Fixed Widths + Header Flex-Wrap

**Files:**
- Modify: `webapp/src/components/transactions/transaction-filters.tsx` (lines 74, 91, 107, 113, 137, 149)
- Modify: `webapp/src/components/categorize/inbox-transaction-row.tsx` (line 127)
- Modify: `webapp/src/components/categorize/bulk-action-bar.tsx` (line 49)
- Modify: `webapp/src/components/import/parsed-transaction-table.tsx` (line 95)
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx` (lines 104, 197)
- Modify: `webapp/src/app/(dashboard)/accounts/[id]/page.tsx` (line 48)
- Modify: `webapp/src/app/(dashboard)/transactions/[id]/page.tsx` (line 34)

**Step 1: Fix filter widths**

In `transaction-filters.tsx`, replace fixed widths:
```tsx
// w-[180px] → w-full sm:w-[180px]
// w-[140px] → w-full sm:w-[140px]
// w-[160px] → w-full sm:w-[160px]
// w-[130px] → w-full sm:w-[130px]
```

In `inbox-transaction-row.tsx` and `bulk-action-bar.tsx`, replace:
```tsx
// w-[240px] → w-full sm:w-[240px]
```

In `parsed-transaction-table.tsx`:
```tsx
// w-[180px] → w-full sm:w-[180px]
```

**Step 2: Add flex-wrap to headers**

In each header file, find `flex items-center` rows containing title + actions and add `flex-wrap gap-2`:
```tsx
// Before:
<div className="flex items-center justify-between">
// After:
<div className="flex items-center justify-between flex-wrap gap-2">

// Before:
<div className="flex items-center gap-4">
// After:
<div className="flex items-center gap-4 flex-wrap">
```

**Step 3: Verify build**

Run: `cd webapp && pnpm build`

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: responsive fixed widths and flex-wrap headers"
```

---

## Task 4: Dashboard Hero Cards Responsive

**Files:**
- Modify: `webapp/src/components/dashboard/dashboard-hero.tsx` (line 32)

**Step 1: Make hero grid responsive**

Change:
```tsx
// Before:
<div className="grid grid-cols-3 gap-3">
// After:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build`

**Step 3: Commit**

```bash
git add src/components/dashboard/dashboard-hero.tsx
git commit -m "fix: dashboard hero cards stack on mobile"
```

---

## Task 5: Recurring — Extract Shared Hook

Extract occurrence calculation, localStorage persistence, and payment recording logic from `recurring-calendar-checklist.tsx` into a reusable hook.

**Files:**
- Create: `webapp/src/components/recurring/use-recurring-month.ts`
- Reference: `webapp/src/components/recurring/recurring-calendar-checklist.tsx` (existing logic)

**Step 1: Create the hook**

Create `webapp/src/components/recurring/use-recurring-month.ts`:

```tsx
"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isToday, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { getOccurrencesBetween } from "@zeta/shared";
import { recordRecurringOccurrencePayment } from "@/actions/recurring-templates";
import type { RecurringTemplateWithRelations } from "@/types/domain";
import type { Account } from "@/types/domain";
import { toast } from "sonner";

export interface OccurrenceItem {
  key: string;
  templateId: string;
  merchant: string;
  date: string;
  plannedAmount: number;
  direction: "INFLOW" | "OUTFLOW";
  accountName: string;
  accountId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  currencyCode: string;
  isDebtPayment: boolean;
  transferSourceAccountId: string | null;
  accountLastFour: string;
}

interface CheckedState {
  [key: string]: boolean;
}

function storageKey(monthKey: string) {
  return `zeta:recurring-checklist:${monthKey}`;
}

function loadChecked(monthKey: string): CheckedState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey(monthKey)) ?? "{}");
  } catch {
    return {};
  }
}

function saveChecked(monthKey: string, state: CheckedState) {
  localStorage.setItem(storageKey(monthKey), JSON.stringify(state));
}

export function useRecurringMonth(
  templates: RecurringTemplateWithRelations[],
  _accounts: Account[]
) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const monthKey = format(monthCursor, "yyyy-MM");
  const monthLabel = format(monthCursor, "MMMM yyyy", { locale: es });

  const [checkedItems, setCheckedItems] = useState<CheckedState>(() =>
    loadChecked(monthKey)
  );
  const [isPending, startTransition] = useTransition();

  // Recompute checked when month changes
  const navigateMonth = useCallback((delta: number) => {
    setMonthCursor((prev) => {
      const next = delta > 0 ? addMonths(prev, 1) : subMonths(prev, 1);
      const nextKey = format(next, "yyyy-MM");
      setCheckedItems(loadChecked(nextKey));
      return next;
    });
  }, []);

  // Generate all occurrences for the month
  const occurrences = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const monthEnd = endOfMonth(monthCursor);
    const items: OccurrenceItem[] = [];

    for (const tmpl of templates) {
      if (!tmpl.is_active) continue;
      const dates = getOccurrencesBetween(
        tmpl.start_date,
        tmpl.frequency,
        tmpl.end_date ?? undefined,
        format(monthStart, "yyyy-MM-dd"),
        format(monthEnd, "yyyy-MM-dd")
      );
      const isDebt = tmpl.account?.account_type === "CREDIT_CARD" ||
        tmpl.account?.account_type === "LOAN";

      for (const d of dates) {
        items.push({
          key: `${tmpl.id}:${d}`,
          templateId: tmpl.id,
          merchant: tmpl.merchant_name ?? tmpl.description ?? "Sin nombre",
          date: d,
          plannedAmount: tmpl.amount,
          direction: tmpl.direction as "INFLOW" | "OUTFLOW",
          accountName: tmpl.account?.name ?? "",
          accountId: tmpl.account_id,
          categoryName: tmpl.category?.name_es ?? tmpl.category?.name ?? "",
          categoryIcon: tmpl.category?.icon ?? "tag",
          categoryColor: tmpl.category?.color ?? "#888",
          currencyCode: tmpl.currency_code,
          isDebtPayment: isDebt,
          transferSourceAccountId: tmpl.transfer_source_account_id,
          accountLastFour: tmpl.account?.name?.match(/\d{4}$/)?.[0] ?? "",
        });
      }
    }

    return items.sort((a, b) => a.date.localeCompare(b.date) || a.merchant.localeCompare(b.merchant));
  }, [templates, monthCursor]);

  const pending = occurrences.filter((o) => !checkedItems[o.key]);
  const completed = occurrences.filter((o) => checkedItems[o.key]);

  // Group by date
  const pendingByDate = useMemo(() => {
    const map = new Map<string, OccurrenceItem[]>();
    for (const item of pending) {
      const group = map.get(item.date) ?? [];
      group.push(item);
      map.set(item.date, group);
    }
    return map;
  }, [pending]);

  // Dates that have occurrences (for calendar dots)
  const dateOccurrenceCounts = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const item of occurrences) {
      const existing = map.get(item.date) ?? { total: 0, completed: 0 };
      existing.total++;
      if (checkedItems[item.key]) existing.completed++;
      map.set(item.date, existing);
    }
    return map;
  }, [occurrences, checkedItems]);

  // Totals
  const totalPlanned = occurrences
    .filter((o) => o.direction === "OUTFLOW" || o.isDebtPayment)
    .reduce((sum, o) => sum + o.plannedAmount, 0);
  const pendingCount = pending.length;
  const completedCount = completed.length;

  // Confirm payment
  const confirmPayment = useCallback(
    (item: OccurrenceItem, actualAmount: number, paymentDate: string, sourceAccountId?: string) => {
      startTransition(async () => {
        const result = await recordRecurringOccurrencePayment({
          templateId: item.templateId,
          occurrenceDate: item.date,
          paymentDate,
          actualAmount,
          sourceAccountId: sourceAccountId ?? item.transferSourceAccountId ?? undefined,
        });

        if (result.status === "error") {
          toast.error(result.error);
          return;
        }

        const newChecked = { ...checkedItems, [item.key]: true };
        setCheckedItems(newChecked);
        saveChecked(monthKey, newChecked);

        // Undo toast (5 seconds)
        toast.success(
          item.isDebtPayment
            ? "Pago registrado como transferencia + abono a deuda"
            : "Pago recurrente registrado",
          {
            action: {
              label: "Deshacer",
              onClick: () => {
                // Uncheck the item (note: transaction already created, but user sees it as pending again)
                const reverted = { ...newChecked };
                delete reverted[item.key];
                setCheckedItems(reverted);
                saveChecked(monthKey, reverted);
              },
            },
            duration: 5000,
          }
        );
      });
    },
    [checkedItems, monthKey]
  );

  // Check if a date is today, past, or future
  const getDateStatus = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    if (isToday(d)) return "today" as const;
    if (isBefore(d, startOfDay(new Date()))) return "past" as const;
    return "future" as const;
  }, []);

  return {
    monthCursor,
    monthKey,
    monthLabel,
    navigateMonth,
    occurrences,
    pending,
    completed,
    pendingByDate,
    dateOccurrenceCounts,
    totalPlanned,
    pendingCount,
    completedCount,
    confirmPayment,
    isPending,
    getDateStatus,
    checkedItems,
  };
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build`

**Step 3: Commit**

```bash
git add src/components/recurring/use-recurring-month.ts
git commit -m "refactor: extract recurring month logic into shared hook"
```

---

## Task 6: Recurring — Summary Bar

**Files:**
- Create: `webapp/src/components/recurring/recurring-summary-bar.tsx`

**Step 1: Create summary bar component**

```tsx
"use client";

import { formatCurrency } from "@/lib/utils/currency";

interface RecurringSummaryBarProps {
  totalPlanned: number;
  pendingCount: number;
  completedCount: number;
  currencyCode?: string;
}

export function RecurringSummaryBar({
  totalPlanned,
  pendingCount,
  completedCount,
  currencyCode = "COP",
}: RecurringSummaryBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">
        {formatCurrency(totalPlanned, currencyCode)}
      </span>
      <span>en fijos</span>
      <span className="text-muted-foreground/50">&middot;</span>
      <span>
        {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
      </span>
      <span className="text-muted-foreground/50">&middot;</span>
      <span>
        {completedCount} {completedCount === 1 ? "completado" : "completados"}
      </span>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build`

**Step 3: Commit**

```bash
git add src/components/recurring/recurring-summary-bar.tsx
git commit -m "feat: recurring summary bar component"
```

---

## Task 7: Recurring — Mini Calendar

**Files:**
- Create: `webapp/src/components/recurring/recurring-mini-calendar.tsx`

**Step 1: Create mini calendar component**

A compact month view showing colored dots on days with occurrences. Clicking a day filters the timeline.

```tsx
"use client";

import { cn } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecurringMiniCalendarProps {
  monthCursor: Date;
  onNavigate: (delta: number) => void;
  monthLabel: string;
  dateOccurrenceCounts: Map<string, { total: number; completed: number }>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function RecurringMiniCalendar({
  monthCursor,
  onNavigate,
  monthLabel,
  dateOccurrenceCounts,
  selectedDate,
  onSelectDate,
}: RecurringMiniCalendarProps) {
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="space-y-2">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => onNavigate(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{monthLabel}</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => onNavigate(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-[10px] text-muted-foreground font-medium">
            {d}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthCursor);
          const today = isToday(day);
          const counts = dateOccurrenceCounts.get(dateStr);
          const isSelected = selectedDate === dateStr;
          const hasOccurrences = counts && counts.total > 0;
          const allCompleted = counts && counts.completed === counts.total;

          return (
            <button
              key={dateStr}
              onClick={() => {
                if (!hasOccurrences) return;
                onSelectDate(isSelected ? null : dateStr);
              }}
              disabled={!inMonth}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-md p-1 text-xs transition-colors",
                !inMonth && "invisible",
                inMonth && "hover:bg-muted",
                today && "font-bold",
                isSelected && "bg-primary/10 ring-1 ring-primary",
                !hasOccurrences && "cursor-default"
              )}
            >
              <span className={cn(today && "text-primary")}>{format(day, "d")}</span>
              {/* Dots */}
              {hasOccurrences && (
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(counts.total, 3) }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "size-1 rounded-full",
                        allCompleted ? "bg-green-500" :
                        i < counts.completed ? "bg-green-500" : "bg-amber-500"
                      )}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build`

**Step 3: Commit**

```bash
git add src/components/recurring/recurring-mini-calendar.tsx
git commit -m "feat: compact mini calendar with occurrence dots"
```

---

## Task 8: Recurring — Payment Timeline

**Files:**
- Create: `webapp/src/components/recurring/recurring-payment-timeline.tsx`

**Step 1: Create payment timeline component**

Vertical list grouped by date. Each item is a compact row with confirm button. Past unpaid items float to top with warning.

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { OccurrenceItem } from "./use-recurring-month";
import { RecurringConfirmInline } from "./recurring-confirm-inline";
import {
  Home, Utensils, Car, HeartPulse, Sparkles, Shield, Briefcase, Tag,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home, utensils: Utensils, car: Car, "heart-pulse": HeartPulse,
  sparkles: Sparkles, shield: Shield, briefcase: Briefcase, tag: Tag,
};

interface PaymentTimelineProps {
  pendingByDate: Map<string, OccurrenceItem[]>;
  getDateStatus: (date: string) => "today" | "past" | "future";
  onConfirm: (item: OccurrenceItem, amount: number, date: string, sourceId?: string) => void;
  isPending: boolean;
  selectedDate: string | null;
}

export function PaymentTimeline({
  pendingByDate,
  getDateStatus,
  onConfirm,
  isPending,
  selectedDate,
}: PaymentTimelineProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Sort date groups: past first, then today, then future
  const sortedDates = Array.from(pendingByDate.keys()).sort((a, b) => {
    const sa = getDateStatus(a);
    const sb = getDateStatus(b);
    const order = { past: 0, today: 1, future: 2 };
    if (order[sa] !== order[sb]) return order[sa] - order[sb];
    return a.localeCompare(b);
  });

  // Filter by selected date if any
  const filteredDates = selectedDate
    ? sortedDates.filter((d) => d === selectedDate)
    : sortedDates;

  if (filteredDates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {selectedDate ? "No hay pagos para esta fecha" : "No hay pagos pendientes este mes"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {filteredDates.map((date) => {
        const items = pendingByDate.get(date) ?? [];
        const status = getDateStatus(date);

        return (
          <div key={date}>
            {/* Date header */}
            <div
              className={cn(
                "flex items-center gap-2 mb-2",
                status === "past" && "text-amber-600",
                status === "today" && "text-primary font-medium",
                status === "future" && "text-muted-foreground"
              )}
            >
              <span className="text-xs font-medium uppercase">
                {status === "today" ? "Hoy" : formatDate(date)}
              </span>
              {status === "past" && (
                <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                  Vencido
                </span>
              )}
            </div>

            {/* Payment rows */}
            <div className="space-y-1">
              {items.map((item) => {
                const IconComp = ICON_MAP[item.categoryIcon] ?? Tag;
                const isExpanded = expandedKey === item.key;

                return (
                  <div key={item.key}>
                    <div
                      className={cn(
                        "flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 transition-colors",
                        status === "past" && "bg-amber-50 dark:bg-amber-950/20",
                        status === "today" && "bg-primary/5",
                        status === "future" && "bg-muted/30",
                        isExpanded && "rounded-b-none"
                      )}
                    >
                      {/* Category icon */}
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${item.categoryColor}20`, color: item.categoryColor }}
                      >
                        <IconComp className="size-3.5" />
                      </span>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.merchant}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {item.accountName}
                          {item.accountLastFour && ` ****${item.accountLastFour}`}
                        </p>
                      </div>

                      {/* Amount */}
                      <span className="text-sm font-semibold shrink-0">
                        {formatCurrency(item.plannedAmount, item.currencyCode)}
                      </span>

                      {/* Confirm button */}
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                        disabled={isPending}
                        className={cn(
                          "shrink-0 text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
                          "bg-primary text-primary-foreground hover:bg-primary/90",
                          "disabled:opacity-50"
                        )}
                      >
                        Confirmar
                      </button>
                    </div>

                    {/* Inline confirm (desktop) */}
                    {isExpanded && (
                      <RecurringConfirmInline
                        item={item}
                        onConfirm={(amount, date, sourceId) => {
                          onConfirm(item, amount, date, sourceId);
                          setExpandedKey(null);
                        }}
                        onCancel={() => setExpandedKey(null)}
                        isPending={isPending}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: May fail because `RecurringConfirmInline` doesn't exist yet. That's OK — we create it in the next task.

**Step 3: Commit (after Task 9 creates the missing component)**

---

## Task 9: Recurring — Confirm Inline + Completed Accordion

**Files:**
- Create: `webapp/src/components/recurring/recurring-confirm-inline.tsx`
- Create: `webapp/src/components/recurring/recurring-completed-section.tsx`

**Step 1: Create confirm inline component**

Two-step confirmation: pre-filled amount + date, Confirm + Cancel buttons.

```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import type { OccurrenceItem } from "./use-recurring-month";

interface RecurringConfirmInlineProps {
  item: OccurrenceItem;
  onConfirm: (amount: number, date: string, sourceAccountId?: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function RecurringConfirmInline({
  item,
  onConfirm,
  onCancel,
  isPending,
}: RecurringConfirmInlineProps) {
  const [amount, setAmount] = useState(item.plannedAmount);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-3 py-2 bg-muted/50 rounded-b-lg border-t">
      <div className="flex items-center gap-2 flex-1">
        <div className="w-full sm:w-32">
          <CurrencyInput
            value={amount}
            onChange={(v) => setAmount(v ?? 0)}
            className="h-8 text-sm"
          />
        </div>
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="h-8 rounded-md border px-2 text-sm bg-background w-full sm:w-auto"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
          className="h-8"
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm(amount, paymentDate)}
          disabled={isPending || amount <= 0}
          className="h-8"
        >
          Confirmar pago
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Create completed section component**

Collapsed accordion showing completed payments.

```tsx
"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { OccurrenceItem } from "./use-recurring-month";

interface RecurringCompletedSectionProps {
  completed: OccurrenceItem[];
}

export function RecurringCompletedSection({ completed }: RecurringCompletedSectionProps) {
  if (completed.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors">
        <CheckCircle2 className="size-4" />
        <span>
          {completed.length} {completed.length === 1 ? "pago completado" : "pagos completados"} este mes
        </span>
        <ChevronDown className="size-4 ml-auto transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-0.5 rounded-lg bg-green-50/50 dark:bg-green-950/10 p-2">
          {completed.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground"
            >
              <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
              <span className="truncate flex-1">{item.merchant}</span>
              <span className="text-xs shrink-0">{formatDate(item.date)}</span>
              <span className="font-medium shrink-0">
                {formatCurrency(item.plannedAmount, item.currencyCode)}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

**Step 3: Verify build**

Run: `cd webapp && pnpm build`

**Step 4: Commit (together with Task 8)**

```bash
git add src/components/recurring/recurring-payment-timeline.tsx src/components/recurring/recurring-confirm-inline.tsx src/components/recurring/recurring-completed-section.tsx
git commit -m "feat: payment timeline, confirm inline, and completed section"
```

---

## Task 10: Recurring — Wire New Page Layout

Replace the current `recurrentes/page.tsx` layout with the new timeline-first design.

**Files:**
- Create: `webapp/src/components/recurring/recurring-timeline-view.tsx` (client wrapper)
- Modify: `webapp/src/app/(dashboard)/recurrentes/page.tsx`

**Step 1: Create the client wrapper**

This component wraps the hook + all new components into one client component.

```tsx
"use client";

import { useState } from "react";
import { useRecurringMonth } from "./use-recurring-month";
import { RecurringSummaryBar } from "./recurring-summary-bar";
import { RecurringMiniCalendar } from "./recurring-mini-calendar";
import { PaymentTimeline } from "./recurring-payment-timeline";
import { RecurringCompletedSection } from "./recurring-completed-section";
import type { RecurringTemplateWithRelations } from "@/types/domain";
import type { Account } from "@/types/domain";

interface RecurringTimelineViewProps {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
}

export function RecurringTimelineView({
  templates,
  accounts,
}: RecurringTimelineViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const {
    monthCursor,
    monthLabel,
    navigateMonth,
    pendingByDate,
    completed,
    dateOccurrenceCounts,
    totalPlanned,
    pendingCount,
    completedCount,
    confirmPayment,
    isPending,
    getDateStatus,
  } = useRecurringMonth(templates, accounts);

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <RecurringSummaryBar
        totalPlanned={totalPlanned}
        pendingCount={pendingCount}
        completedCount={completedCount}
      />

      {/* Mini calendar + Timeline in 2-col on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Mini calendar */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <RecurringMiniCalendar
            monthCursor={monthCursor}
            onNavigate={navigateMonth}
            monthLabel={monthLabel}
            dateOccurrenceCounts={dateOccurrenceCounts}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        {/* Timeline + Completed */}
        <div className="space-y-6">
          <PaymentTimeline
            pendingByDate={pendingByDate}
            getDateStatus={getDateStatus}
            onConfirm={confirmPayment}
            isPending={isPending}
            selectedDate={selectedDate}
          />
          <RecurringCompletedSection completed={completed} />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update the page to use new layout**

Modify `webapp/src/app/(dashboard)/recurrentes/page.tsx`:
- Remove the old 3 summary cards
- Remove `RecurringCalendarChecklist` import
- Add `RecurringTimelineView` in its place
- Keep `RecurringList` below as the template management section
- Keep `RecurringFormDialog` for creating new templates

The page should render:
1. Header row: "Transacciones Recurrentes" + "Nueva recurrente" button
2. `RecurringTimelineView` (summary + calendar + timeline + completed)
3. Divider
4. `RecurringList` (template management cards)

**Step 3: Verify build**

Run: `cd webapp && pnpm build`

**Step 4: Visual verification with Playwright**

Run the existing screenshot script at mobile (375px) and desktop (1440px) viewports:
```bash
node /tmp/screenshot-pages.mjs
```
Check `/tmp/zeta-screenshots/recurrentes-mobile.png` and `recurrentes-desktop.png`.

**Step 5: Commit**

```bash
git add src/components/recurring/recurring-timeline-view.tsx src/app/\(dashboard\)/recurrentes/page.tsx
git commit -m "feat: recurring page timeline-first layout redesign"
```

---

## Task 11: Transaction Filters — Mobile Sheet

On mobile (< 640px), collapse the filter rows into a "Filtros" button that opens a Sheet.

**Files:**
- Modify: `webapp/src/components/transactions/transaction-filters.tsx`

**Step 1: Wrap filters in responsive layout**

Add a Sheet component from shadcn/ui. On `sm:` and above, show filters inline (current behavior). Below `sm:`, show a "Filtros" button that opens a Sheet with all filter controls stacked vertically.

Structure:
```tsx
// Mobile: show trigger button
<div className="sm:hidden">
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline" size="sm">
        <SlidersHorizontal className="size-4 mr-2" />
        Filtros
        {activeFilterCount > 0 && <Badge>{activeFilterCount}</Badge>}
      </Button>
    </SheetTrigger>
    <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
      <SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader>
      {/* All filter controls stacked vertically, w-full */}
    </SheetContent>
  </Sheet>
</div>

// Desktop: show inline (existing layout)
<div className="hidden sm:flex ...">
  {/* existing filter rows */}
</div>
```

The filter controls themselves can be extracted into a shared `FilterControls` render function used by both mobile sheet and desktop inline.

All `w-[Npx]` classes inside the sheet should become `w-full`.

**Step 2: Count active filters for badge**

```tsx
const activeFilterCount = [
  filters.accountId, filters.direction, filters.dateFrom,
  filters.dateTo, filters.amountMin, filters.amountMax,
  filters.search
].filter(Boolean).length;
```

**Step 3: Verify build**

Run: `cd webapp && pnpm build`

**Step 4: Commit**

```bash
git add src/components/transactions/transaction-filters.tsx
git commit -m "feat: collapse transaction filters into mobile sheet"
```

---

## Task 12: Transaction Table — Mobile Card Layout

On mobile, render transactions as card layout instead of table rows.

**Files:**
- Modify: `webapp/src/app/(dashboard)/transactions/page.tsx` or the transaction list/table component

**Step 1: Identify the transaction list component**

Find the component that renders the transaction table/list on the transactions page. It may be inline in the page or a separate component.

**Step 2: Add responsive card layout**

```tsx
// Mobile card layout (shown below sm:)
<div className="sm:hidden space-y-2">
  {transactions.map((tx) => (
    <Link key={tx.id} href={`/transactions/${tx.id}`}>
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {tx.description ?? "Sin descripción"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(tx.date)}
            {tx.category && ` · ${tx.category.name_es ?? tx.category.name}`}
          </p>
        </div>
        <span className={cn(
          "text-sm font-semibold shrink-0",
          tx.direction === "INFLOW" ? "text-green-600" : ""
        )}>
          {tx.direction === "OUTFLOW" ? "-" : "+"}
          {formatCurrency(tx.amount)}
        </span>
      </div>
    </Link>
  ))}
</div>

// Desktop table (hidden below sm:)
<div className="hidden sm:block">
  {/* existing table */}
</div>
```

**Step 3: Verify build**

Run: `cd webapp && pnpm build`

**Step 4: Visual verification**

Run Playwright screenshots and check `transactions-mobile.png`.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: mobile card layout for transactions list"
```

---

## Task 13: Final — Full Visual Verification + Cleanup

**Step 1: Run full build**

```bash
cd webapp && pnpm build
```

**Step 2: Run Playwright screenshots for all pages**

```bash
node /tmp/screenshot-pages.mjs
```

Review all screenshots in `/tmp/zeta-screenshots/`:
- `dashboard-mobile.png` — hero cards stacked, header wrapping
- `recurrentes-mobile.png` — timeline layout, mini calendar, confirm flow
- `transactions-mobile.png` — filter button, card layout
- `import-mobile.png` — form grids stacked
- `categories-mobile.png` — budget cards stacked

**Step 3: Fix any visual issues found**

Address overflow, truncation, spacing problems visible in screenshots.

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: visual polish from mobile screenshot review"
```

**Step 5: Push branch**

```bash
git push origin feat/category-budgets
```
