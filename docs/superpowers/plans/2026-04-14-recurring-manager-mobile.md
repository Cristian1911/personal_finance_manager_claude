# Recurring Manager Mobile Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat occurrence checklist at `/recurrentes` with a full recurring template manager featuring a timeline UI, segmented gastos/ingresos tabs, inline expand with lazy stats, one-time payments (`ONCE` frequency), and full-page create/edit routes.

**Architecture:** New top-level `/recurrentes` route replaces the current redirect. Page is a server component that fetches templates + occurrences, renders `MobileRecurringManager` client component. Timeline groups templates by next occurrence date within the selected month. Expanded view lazy-loads stats via `getTemplateStats()` server action. Create/edit use dedicated page routes reusing `RecurringForm`.

**Tech Stack:** Next.js 15 App Router, Tailwind v4, shadcn/ui, Supabase, `@zeta/shared` recurrence utils

**Spec:** `docs/superpowers/specs/2026-04-14-recurring-manager-mobile-redesign.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/YYYYMMDD_add_once_frequency.sql` | Add `ONCE` to `recurrence_frequency` enum |
| `webapp/src/app/(dashboard)/recurrentes/page.tsx` | Server component entry — replaces redirect, fetches data |
| `webapp/src/app/(dashboard)/recurrentes/loading.tsx` | Loading skeleton |
| `webapp/src/app/(dashboard)/recurrentes/new/page.tsx` | Create template — full page with `RecurringForm` |
| `webapp/src/app/(dashboard)/recurrentes/[id]/edit/page.tsx` | Edit template — full page with `RecurringForm` |
| `webapp/src/components/recurring/mobile-recurring-manager.tsx` | Main client component — hero, tabs, timeline |
| `webapp/src/components/recurring/recurring-hero-compact.tsx` | Proportion bar hero |
| `webapp/src/components/recurring/recurring-timeline.tsx` | Timeline with date groups, dots, template cards |
| `webapp/src/components/recurring/recurring-template-card.tsx` | Collapsed + expanded card (inline on timeline) |
| `webapp/src/actions/template-stats.ts` | `getTemplateStats()` server action |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/utils/recurrence.ts` | Add `ONCE` to `advanceByFrequency()` + `frequencyLabel()` |
| `webapp/src/lib/validators/recurring-template.ts` | Add `ONCE` to frequency enum |
| `webapp/src/components/recurring/recurring-form.tsx` | Add "Una vez" option, hide end_date when ONCE |
| `webapp/src/components/recurring/recurring-impact-dialog.tsx` | Add optional `open`/`onOpenChange` controlled mode |
| `webapp/src/components/plan/tabs/plan-tab-recurrentes.tsx` | Change mobile view to link to `/recurrentes` instead of embedding `MobileRecurrentesView` |
| `webapp/src/types/database.ts` | Regenerated after migration (add `ONCE` to enum) |

### Untouched (still used)
| File | Why |
|------|-----|
| `recurring-form-dialog.tsx` | Desktop still uses Dialog wrapper |
| `mobile-recurrentes-view.tsx` | Kept for reference, eventually removed once new page is stable |
| `recurring-list.tsx` | Desktop list view, unchanged |
| `use-recurring-month.ts` | Reused for occurrence data in timeline |

---

## Task 1: Database Migration — Add `ONCE` Frequency

**Files:**
- Create: `supabase/migrations/YYYYMMDD_add_once_frequency.sql`

- [ ] **Step 1: Create migration file**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && npx supabase migration new add_once_frequency
```

- [ ] **Step 2: Write migration SQL**

Write to the created migration file:

```sql
-- Add ONCE frequency for one-time planned payments
ALTER TYPE recurrence_frequency ADD VALUE IF NOT EXISTS 'ONCE';
```

- [ ] **Step 3: Push migration**

```bash
npx supabase db push
```

Expected: Migration applied successfully.

- [ ] **Step 4: Regenerate TypeScript types**

```bash
cd webapp && npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts
```

Verify `ONCE` appears in the enum array (search for `recurrence_frequency`). Check that `export type Json =` header is intact (first line).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat: add ONCE frequency to recurrence_frequency enum"
```

---

## Task 2: Shared Package — `ONCE` Frequency Support

**Files:**
- Modify: `packages/shared/src/utils/recurrence.ts`

- [ ] **Step 1: Add `ONCE` to `advanceByFrequency()`**

In `packages/shared/src/utils/recurrence.ts`, add a case to the switch statement (around line 7-20):

```typescript
case "ONCE":
  return date; // no advancement — single occurrence at start_date
```

- [ ] **Step 2: Add `ONCE` to `frequencyLabel()`**

In the same file (around line 88-97), add:

```typescript
case "ONCE":
  return "Una vez";
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

Expected: Clean build. The shared package compiles through webapp's Turbopack.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/utils/recurrence.ts
git commit -m "feat: add ONCE frequency to shared recurrence utils"
```

---

## Task 3: Validator + Form — `ONCE` Support

**Files:**
- Modify: `webapp/src/lib/validators/recurring-template.ts`
- Modify: `webapp/src/components/recurring/recurring-form.tsx`

- [ ] **Step 1: Add `ONCE` to validator schema**

In `webapp/src/lib/validators/recurring-template.ts` (line 13), add `"ONCE"` to the frequency enum array:

```typescript
frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONCE"]),
```

- [ ] **Step 2: Add `ONCE` to form frequency options**

In `webapp/src/components/recurring/recurring-form.tsx`, update `FREQUENCY_OPTIONS` (lines 25-31):

```typescript
const FREQUENCY_OPTIONS = [
  { value: "ONCE", label: "Una vez" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "ANNUAL", label: "Anual" },
] as const;
```

- [ ] **Step 3: Hide end_date when ONCE is selected**

In `RecurringForm`, add state tracking for frequency and conditionally hide end_date. After the existing state declarations (~line 61-78), add:

```typescript
const [frequency, setFrequency] = useState<string>(
  template?.frequency ?? "MONTHLY"
);
```

Update the frequency `<Select>` to use controlled state:

```typescript
<Select
  name="frequency"
  value={frequency}
  onValueChange={setFrequency}
>
```

Wrap the end_date field (around lines 293-302) in a conditional:

```typescript
{frequency !== "ONCE" && (
  <div className="space-y-2">
    <Label htmlFor="end_date">Fecha fin (opcional)</Label>
    <DatePicker ... />
  </div>
)}
```

When ONCE, change the grid from 2-col to 1-col for start_date:

```typescript
<div className={cn("grid gap-4", frequency === "ONCE" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
```

- [ ] **Step 4: Build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/validators/recurring-template.ts webapp/src/components/recurring/recurring-form.tsx
git commit -m "feat: add ONCE frequency option to recurring form and validator"
```

---

## Task 4: Template Stats Server Action

**Files:**
- Create: `webapp/src/actions/template-stats.ts`

- [ ] **Step 1: Create the server action**

```typescript
"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { startOfYear } from "date-fns";
import type { ActionResult } from "@/types/actions";

export interface TemplateStats {
  ytdTotal: number;
  annualEstimate: number;
  streak: number;
  isConsistent: boolean;
  impactPercent: number | null;
  marginAfter: number | null;
}

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
  ONCE: 1,
};

export async function getTemplateStats(
  templateId: string
): Promise<ActionResult<TemplateStats>> {
  const { supabase, user } = await getAuthenticatedClient();

  // Fetch template
  const { data: template, error: tErr } = await supabase
    .from("recurring_transaction_templates")
    .select("id, amount, frequency, direction, account_id")
    .eq("id", templateId)
    .eq("user_id", user.id)
    .single();

  if (tErr || !template) {
    return { success: false, error: "Plantilla no encontrada" };
  }

  // Fetch paid occurrences this year
  const yearStart = startOfYear(new Date()).toISOString().split("T")[0];
  const { data: paidOccurrences } = await supabase
    .from("recurring_occurrences")
    .select("occurrence_date, expected_amount, paid_at")
    .eq("template_id", templateId)
    .eq("user_id", user.id)
    .eq("status", "paid")
    .gte("occurrence_date", yearStart)
    .order("occurrence_date", { ascending: false });

  const paid = paidOccurrences ?? [];
  const ytdTotal = paid.reduce(
    (sum, o) => sum + Number(o.expected_amount),
    0
  );

  const multiplier = FREQUENCY_MULTIPLIER[template.frequency] ?? 12;
  const annualEstimate =
    template.frequency === "ONCE"
      ? Number(template.amount)
      : Number(template.amount) * multiplier;

  // Streak: consecutive months with a payment (count backwards from most recent)
  let streak = 0;
  if (paid.length > 0) {
    streak = 1;
    for (let i = 1; i < paid.length; i++) {
      const prev = new Date(paid[i - 1].occurrence_date);
      const curr = new Date(paid[i].occurrence_date);
      const monthDiff =
        (prev.getFullYear() - curr.getFullYear()) * 12 +
        prev.getMonth() -
        curr.getMonth();
      if (monthDiff <= 2) {
        streak++;
      } else {
        break;
      }
    }
  }

  // Consistency: all paid amounts are within 5% of template amount
  const templateAmount = Number(template.amount);
  const isConsistent =
    paid.length >= 2 &&
    paid.every(
      (o) => Math.abs(Number(o.expected_amount) - templateAmount) / templateAmount < 0.05
    );

  // Impact (for ONCE only)
  let impactPercent: number | null = null;
  let marginAfter: number | null = null;

  if (template.frequency === "ONCE") {
    // Get monthly income from recurring income templates
    const { data: incomeTemplates } = await supabase
      .from("recurring_transaction_templates")
      .select("amount, frequency")
      .eq("user_id", user.id)
      .eq("direction", "INFLOW")
      .eq("is_active", true);

    const monthlyIncome = (incomeTemplates ?? []).reduce((sum, t) => {
      const m = FREQUENCY_MULTIPLIER[t.frequency] ?? 12;
      return sum + (Number(t.amount) * m) / 12;
    }, 0);

    if (monthlyIncome > 0) {
      impactPercent = (Number(template.amount) / monthlyIncome) * 100;
    }

    // Get monthly expense total
    const { data: expenseTemplates } = await supabase
      .from("recurring_transaction_templates")
      .select("amount, frequency")
      .eq("user_id", user.id)
      .eq("direction", "OUTFLOW")
      .eq("is_active", true)
      .neq("id", templateId);

    const monthlyExpenses = (expenseTemplates ?? []).reduce((sum, t) => {
      const m = FREQUENCY_MULTIPLIER[t.frequency] ?? 12;
      return sum + (Number(t.amount) * m) / 12;
    }, 0);

    marginAfter = monthlyIncome - monthlyExpenses - Number(template.amount);
  }

  return {
    success: true,
    data: {
      ytdTotal,
      annualEstimate,
      streak,
      isConsistent,
      impactPercent,
      marginAfter,
    },
  };
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/template-stats.ts
git commit -m "feat: add getTemplateStats server action for recurring manager"
```

---

## Task 5: RecurringImpactDialog — Controlled Mode

**Files:**
- Modify: `webapp/src/components/recurring/recurring-impact-dialog.tsx`

- [ ] **Step 1: Add controlled mode props**

Update the interface (around line 24-31):

```typescript
interface RecurringImpactDialogProps {
  templateId: string;
  templateName: string;
  currencyCode: CurrencyCode;
  action: "delete" | "pause";
  onConfirm: () => void | Promise<void>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
```

- [ ] **Step 2: Implement controlled/uncontrolled pattern**

Replace the internal state (line 41) with:

```typescript
const [internalOpen, setInternalOpen] = useState(false);
const open = controlledOpen ?? internalOpen;
const setOpen = controlledOnOpenChange ?? setInternalOpen;
```

Update destructured props to include new names:

```typescript
export function RecurringImpactDialog({
  templateId,
  templateName,
  currencyCode,
  action,
  onConfirm,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: RecurringImpactDialogProps) {
```

- [ ] **Step 3: Conditionally render trigger**

Replace the AlertDialog JSX (line 77-78) to conditionally render the trigger:

```typescript
<AlertDialog open={open} onOpenChange={setOpen}>
  {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
  <AlertDialogContent>
```

- [ ] **Step 4: Build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

Desktop `RecurringList` still passes `trigger` — verify no regression.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/recurring/recurring-impact-dialog.tsx
git commit -m "feat: add controlled mode to RecurringImpactDialog"
```

---

## Task 6: Recurring Hero Compact Component

**Files:**
- Create: `webapp/src/components/recurring/recurring-hero-compact.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface RecurringHeroCompactProps {
  totalExpenses: number;
  totalIncome: number;
  currency: CurrencyCode;
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoNext: boolean;
}

export function RecurringHeroCompact({
  totalExpenses,
  totalIncome,
  currency,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  canGoNext,
}: RecurringHeroCompactProps) {
  const net = totalIncome - totalExpenses;
  const isPositive = net >= 0;
  const total = totalExpenses + totalIncome;
  const expensePercent = total > 0 ? (totalExpenses / total) * 100 : 50;

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex size-7 items-center justify-center rounded-full border border-white/6 text-muted-foreground active:bg-white/5"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-xs font-medium capitalize text-muted-foreground">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          disabled={!canGoNext}
          className="flex size-7 items-center justify-center rounded-full border border-white/6 text-muted-foreground active:bg-white/5 disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {/* Compact hero card */}
      <div className="rounded-2xl border border-white/6 bg-gradient-to-br from-z-brass/[0.06] to-transparent p-3.5">
        {/* Proportion bar */}
        <div className="mb-3 flex h-1.5 overflow-hidden rounded-full">
          <div
            className="rounded-l-full bg-gradient-to-r from-z-debt to-z-alert"
            style={{ width: `${expensePercent}%` }}
          />
          <div
            className="rounded-r-full bg-gradient-to-r from-z-income to-emerald-500"
            style={{ width: `${100 - expensePercent}%` }}
          />
        </div>

        {/* Three numbers */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-z-debt">
              Gastos
            </p>
            <p className="text-base font-bold tabular-nums">
              {formatCurrency(totalExpenses, currency)}
            </p>
          </div>
          <div className="text-center px-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Neto
            </p>
            <p
              className={cn(
                "text-xl font-extrabold tabular-nums",
                isPositive ? "text-z-income" : "text-z-debt"
              )}
            >
              {isPositive ? "+" : ""}
              {formatCurrency(Math.abs(net), currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-z-income">
              Ingresos
            </p>
            <p className="text-base font-bold tabular-nums">
              {formatCurrency(totalIncome, currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/recurring/recurring-hero-compact.tsx
git commit -m "feat: add RecurringHeroCompact component"
```

---

## Task 7: Recurring Template Card Component

**Files:**
- Create: `webapp/src/components/recurring/recurring-template-card.tsx`

- [ ] **Step 1: Create collapsed + expanded card component**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Pause, Trash2, Check, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { getTemplateStats, type TemplateStats } from "@/actions/template-stats";
import { MOBILE_ACTION_BUTTON_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode, RecurringTemplateWithRelations } from "@/types/domain";

type OccurrenceStatus = "paid" | "pending" | "skipped" | null;

interface RecurringTemplateCardProps {
  template: RecurringTemplateWithRelations;
  currency: CurrencyCode;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPauseRequest: (template: RecurringTemplateWithRelations) => void;
  onDeleteRequest: (template: RecurringTemplateWithRelations) => void;
  occurrenceStatus: OccurrenceStatus;
}

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  WEEKLY: 52, BIWEEKLY: 26, MONTHLY: 12, QUARTERLY: 4, ANNUAL: 1, ONCE: 1,
};

function yearlyEstimate(amount: number, frequency: string): number {
  return frequency === "ONCE" ? amount : amount * (FREQUENCY_MULTIPLIER[frequency] ?? 12);
}

function frequencyShortLabel(f: string): string {
  const labels: Record<string, string> = {
    ONCE: "Una vez", WEEKLY: "Semanal", BIWEEKLY: "Quincenal",
    MONTHLY: "Mensual", QUARTERLY: "Trimestral", ANNUAL: "Anual",
  };
  return labels[f] ?? f;
}

export function RecurringTemplateCard({
  template,
  currency,
  isExpanded,
  onToggleExpand,
  onPauseRequest,
  onDeleteRequest,
  occurrenceStatus,
}: RecurringTemplateCardProps) {
  const router = useRouter();
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const amount = Number(template.amount);
  const isOnce = template.frequency === "ONCE";

  function handleExpand() {
    onToggleExpand();
    if (!isExpanded && !stats) {
      setLoadingStats(true);
      getTemplateStats(template.id).then((result) => {
        if (result.success) setStats(result.data);
        setLoadingStats(false);
      });
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-white/6 bg-white/[0.03] overflow-hidden transition-all",
        isExpanded && "border-z-brass/20"
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={handleExpand}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left active:bg-white/[0.02]"
      >
        {/* Category dot */}
        {template.category && (
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs"
            style={{ backgroundColor: template.category.color + "20", color: template.category.color }}
          >
            {template.category.icon ?? "•"}
          </span>
        )}

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-semibold">{template.merchant_name}</p>
            {isOnce && (
              <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-px text-[8px] font-semibold text-purple-400">
                UNA VEZ
              </span>
            )}
            {occurrenceStatus === "paid" && (
              <Check className="size-3 shrink-0 text-z-income" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {template.account.name} · {frequencyShortLabel(template.frequency)}
          </p>
        </div>

        {/* Amount + yearly */}
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold tabular-nums">
            {formatCurrency(amount, currency)}
          </p>
          {!isOnce && (
            <p className="text-[9px] text-muted-foreground tabular-nums">
              {formatCurrency(yearlyEstimate(amount, template.frequency), currency)}/año
            </p>
          )}
        </div>
      </button>

      {/* Expanded section */}
      {isExpanded && (
        <div className="border-t border-white/5 px-3 py-3 space-y-3">
          {/* Stats chips */}
          <div className="grid grid-cols-3 gap-1">
            {loadingStats ? (
              <>
                <div className="h-12 animate-pulse rounded-lg bg-white/4" />
                <div className="h-12 animate-pulse rounded-lg bg-white/4" />
                <div className="h-12 animate-pulse rounded-lg bg-white/4" />
              </>
            ) : stats ? (
              isOnce ? (
                <>
                  <StatChip label="% ingreso" value={stats.impactPercent != null ? `${stats.impactPercent.toFixed(1)}%` : "—"} />
                  <StatChip label="Margen después" value={stats.marginAfter != null ? formatCurrency(stats.marginAfter, currency) : "—"} />
                  <StatChip label="Estado" value={occurrenceStatus === "paid" ? "Pagado ✓" : "Pendiente"} />
                </>
              ) : (
                <>
                  <StatChip label="Este año" value={formatCurrency(stats.ytdTotal, currency)} />
                  <StatChip label="Anual est." value={formatCurrency(stats.annualEstimate, currency)} />
                  <StatChip
                    label="Racha"
                    value={`${stats.streak} mes${stats.streak !== 1 ? "es" : ""}`}
                    note={stats.isConsistent ? "Consistente ✓" : undefined}
                  />
                </>
              )
            ) : null}
          </div>

          {/* Action buttons */}
          <div className={cn("grid gap-1.5", isOnce ? "grid-cols-3" : template.direction === "INFLOW" ? "grid-cols-2" : "grid-cols-3")}>
            <ActionButton
              label="Editar"
              icon={<Pencil className="size-3.5" />}
              className="bg-z-brass/10 border-z-brass/20 text-z-brass"
              onClick={() => router.push(`/recurrentes/${template.id}/edit`)}
            />
            {template.direction === "OUTFLOW" && !isOnce && (
              <ActionButton
                label="Pausar"
                icon={<Pause className="size-3.5" />}
                className="bg-z-alert/8 border-z-alert/15 text-z-alert"
                onClick={() => onPauseRequest(template)}
              />
            )}
            {isOnce && occurrenceStatus !== "paid" && (
              <ActionButton
                label="Pagado"
                icon={<Check className="size-3.5" />}
                className="bg-z-income/10 border-z-income/20 text-z-income"
                onClick={() => {/* TODO: mark paid flow — will use existing confirmPayment */}}
              />
            )}
            <ActionButton
              label="Eliminar"
              icon={<Trash2 className="size-3.5" />}
              className="bg-z-debt/8 border-z-debt/15 text-z-debt"
              onClick={() => onDeleteRequest(template)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-2 text-center">
      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
      {note && <p className="text-[8px] text-z-income">{note}</p>}
    </div>
  );
}

function ActionButton({
  label, icon, className, onClick,
}: {
  label: string; icon: React.ReactNode; className: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[11px] font-semibold active:opacity-70", className)}
    >
      {icon}
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/recurring/recurring-template-card.tsx
git commit -m "feat: add RecurringTemplateCard with expanded stats and actions"
```

---

## Task 8: Recurring Timeline Component

**Files:**
- Create: `webapp/src/components/recurring/recurring-timeline.tsx`

- [ ] **Step 1: Create timeline component**

```typescript
"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date";
import { RecurringTemplateCard } from "./recurring-template-card";
import type { CurrencyCode, RecurringTemplateWithRelations } from "@/types/domain";

type DateStatus = "past" | "today" | "future";
type OccurrenceStatusMap = Map<string, "paid" | "pending" | "skipped">;

interface RecurringTimelineProps {
  templates: RecurringTemplateWithRelations[];
  currency: CurrencyCode;
  direction: "OUTFLOW" | "INFLOW";
  occurrencesByDate: Map<string, { templateId: string; date: string }[]>;
  occurrenceStatuses: OccurrenceStatusMap;
  expandedId: string | null;
  onToggleExpand: (templateId: string) => void;
  onPauseRequest: (template: RecurringTemplateWithRelations) => void;
  onDeleteRequest: (template: RecurringTemplateWithRelations) => void;
  getDateStatus: (date: string) => DateStatus;
}

const STATUS_ORDER: Record<DateStatus, number> = { past: 0, today: 1, future: 2 };

function dotStyle(status: DateStatus) {
  switch (status) {
    case "past":
      return "bg-z-debt shadow-[0_0_8px_rgba(239,68,68,0.4)]";
    case "today":
      return "bg-z-alert shadow-[0_0_8px_rgba(245,158,11,0.4)]";
    case "future":
      return "border-2 border-white/15 bg-transparent";
  }
}

function dateColor(status: DateStatus) {
  switch (status) {
    case "past": return "text-z-debt";
    case "today": return "text-z-alert";
    case "future": return "text-muted-foreground";
  }
}

function lineColor(direction: "OUTFLOW" | "INFLOW") {
  return direction === "OUTFLOW"
    ? "from-z-brass/40 to-z-brass/10"
    : "from-z-income/40 to-z-income/10";
}

export function RecurringTimeline({
  templates,
  currency,
  direction,
  occurrencesByDate,
  occurrenceStatuses,
  expandedId,
  onToggleExpand,
  onPauseRequest,
  onDeleteRequest,
  getDateStatus,
}: RecurringTimelineProps) {
  const templateMap = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates]
  );

  const activeTemplates = templates.filter((t) => t.direction === direction && t.is_active);
  const pausedTemplates = templates.filter((t) => t.direction === direction && !t.is_active);

  // Build date groups from occurrences
  const sortedDates = useMemo(() => {
    const dates = Array.from(occurrencesByDate.keys())
      .filter((date) => {
        const items = occurrencesByDate.get(date)!;
        return items.some((item) => {
          const tmpl = templateMap.get(item.templateId);
          return tmpl && tmpl.direction === direction && tmpl.is_active;
        });
      })
      .map((date) => ({ date, order: STATUS_ORDER[getDateStatus(date)] }))
      .sort((a, b) => a.order - b.order || a.date.localeCompare(b.date));
    return dates.map((d) => d.date);
  }, [occurrencesByDate, templateMap, direction, getDateStatus]);

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className={cn("absolute left-[7px] top-0 bottom-0 w-0.5 bg-gradient-to-b", lineColor(direction))} />

      {/* Date groups */}
      {sortedDates.map((date) => {
        const status = getDateStatus(date);
        const items = occurrencesByDate.get(date)!.filter((item) => {
          const tmpl = templateMap.get(item.templateId);
          return tmpl && tmpl.direction === direction && tmpl.is_active;
        });

        return (
          <div key={date} className="relative mb-5">
            {/* Dot */}
            <div
              className={cn(
                "absolute -left-6 top-0.5 size-3 rounded-full",
                dotStyle(status)
              )}
            />
            {/* Date label */}
            <p className={cn("mb-2 text-[10px] font-semibold uppercase tracking-[0.1em]", dateColor(status))}>
              {status === "today" && "Hoy — "}
              {status === "past" && "Vencido — "}
              {formatDate(date, "EEEE d MMM")}
            </p>

            {/* Template cards */}
            <div className="space-y-2">
              {items.map((item) => {
                const tmpl = templateMap.get(item.templateId);
                if (!tmpl) return null;
                const occKey = `${item.templateId}:${item.date}`;
                return (
                  <RecurringTemplateCard
                    key={occKey}
                    template={tmpl}
                    currency={currency}
                    isExpanded={expandedId === tmpl.id}
                    onToggleExpand={() => onToggleExpand(tmpl.id)}
                    onPauseRequest={onPauseRequest}
                    onDeleteRequest={onDeleteRequest}
                    occurrenceStatus={occurrenceStatuses.get(occKey) ?? null}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Paused templates */}
      {pausedTemplates.length > 0 && (
        <div className="relative mb-5 mt-6">
          <div className="absolute -left-6 top-0.5 size-3 rounded-full border-2 border-dashed border-white/15" />
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
            Pausados
          </p>
          <div className="space-y-2">
            {pausedTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="rounded-xl border border-dashed border-white/8 bg-white/[0.02] px-3 py-2.5 opacity-45"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">{tmpl.merchant_name}</p>
                    <p className="text-[10px] text-muted-foreground">Pausado</p>
                  </div>
                  <p className="text-xs font-bold tabular-nums line-through opacity-50">
                    {formatCurrency(Number(tmpl.amount), currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sortedDates.length === 0 && pausedTemplates.length === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No hay {direction === "OUTFLOW" ? "gastos" : "ingresos"} recurrentes
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/recurring/recurring-timeline.tsx
git commit -m "feat: add RecurringTimeline component with date-grouped status dots"
```

---

## Task 9: Mobile Recurring Manager (Main Client Component)

**Files:**
- Create: `webapp/src/components/recurring/mobile-recurring-manager.tsx`

- [ ] **Step 1: Create the main orchestrating component**

This component composes hero + segmented control + timeline, manages expanded state, and handles the sequential overlay pattern for pause/delete.

```typescript
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import { useRecurringMonth } from "./use-recurring-month";
import { RecurringHeroCompact } from "./recurring-hero-compact";
import { RecurringTimeline } from "./recurring-timeline";
import { RecurringImpactDialog } from "./recurring-impact-dialog";
import {
  deleteRecurringTemplate,
  toggleRecurringTemplate,
} from "@/actions/recurring-templates";
import type { Account, CategoryWithChildren, CurrencyCode, RecurringTemplateWithRelations } from "@/types/domain";

type TabDirection = "OUTFLOW" | "INFLOW";

interface MobileRecurringManagerProps {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
  currency: CurrencyCode;
}

export function MobileRecurringManager({
  templates,
  accounts,
  currency,
}: MobileRecurringManagerProps) {
  const hook = useRecurringMonth(templates, accounts);
  const [activeTab, setActiveTab] = useState<TabDirection>("OUTFLOW");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sequential overlay state for pause/delete
  const [impactAction, setImpactAction] = useState<{
    template: RecurringTemplateWithRelations;
    action: "pause" | "delete";
  } | null>(null);

  // Compute totals
  const totalExpenses = useMemo(
    () => templates
      .filter((t) => t.direction === "OUTFLOW" && t.is_active)
      .reduce((sum, t) => sum + Number(t.amount), 0),
    [templates]
  );

  const totalIncome = useMemo(
    () => templates
      .filter((t) => t.direction === "INFLOW" && t.is_active)
      .reduce((sum, t) => sum + Number(t.amount), 0),
    [templates]
  );

  // Build occurrence data maps for timeline
  const { occurrencesByDate, occurrenceStatuses } = useMemo(() => {
    const byDate = new Map<string, { templateId: string; date: string }[]>();
    const statuses = new Map<string, "paid" | "pending" | "skipped">();

    for (const item of [...hook.pending, ...hook.completed]) {
      const key = item.date;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push({ templateId: item.templateId, date: item.date });
      statuses.set(`${item.templateId}:${item.date}`, item.occurrenceId ? (hook.completed.some((c) => c.key === item.key) ? "paid" : "pending") : "pending");
    }

    return { occurrencesByDate: byDate, occurrenceStatuses: statuses };
  }, [hook.pending, hook.completed]);

  const handlePauseRequest = (template: RecurringTemplateWithRelations) => {
    setImpactAction({ template, action: "pause" });
  };

  const handleDeleteRequest = (template: RecurringTemplateWithRelations) => {
    setImpactAction({ template, action: "delete" });
  };

  const handleImpactConfirm = async () => {
    if (!impactAction) return;
    const { template, action } = impactAction;
    if (action === "pause") {
      await toggleRecurringTemplate(template.id, false);
    } else {
      await deleteRecurringTemplate(template.id);
    }
    await hook.refreshOccurrences();
    setImpactAction(null);
  };

  return (
    <div className={cn("space-y-4", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
      {/* Hero */}
      <RecurringHeroCompact
        totalExpenses={totalExpenses}
        totalIncome={totalIncome}
        currency={currency}
        monthLabel={hook.monthLabel}
        onPrevMonth={hook.goPrevMonth}
        onNextMonth={hook.goNextMonth}
        canGoNext={true}
      />

      {/* Segmented control */}
      <div className="flex rounded-xl border border-white/6 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("OUTFLOW")}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-[11px] font-semibold transition-colors",
            activeTab === "OUTFLOW"
              ? "bg-z-brass/15 border border-z-brass/30 text-z-brass"
              : "text-muted-foreground"
          )}
        >
          Gastos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("INFLOW")}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-[11px] font-semibold transition-colors",
            activeTab === "INFLOW"
              ? "bg-z-income/12 border border-z-income/25 text-z-income"
              : "text-muted-foreground"
          )}
        >
          Ingresos
        </button>
      </div>

      {/* Loading */}
      {!hook.isHydrated && (
        <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
          Cargando recurrentes...
        </div>
      )}

      {/* Timeline */}
      {hook.isHydrated && (
        <RecurringTimeline
          templates={templates}
          currency={currency}
          direction={activeTab}
          occurrencesByDate={occurrencesByDate}
          occurrenceStatuses={occurrenceStatuses}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
          onPauseRequest={handlePauseRequest}
          onDeleteRequest={handleDeleteRequest}
          getDateStatus={hook.getDateStatus}
        />
      )}

      {/* Create button */}
      <div className="flex justify-center pb-4">
        <Link
          href={`/recurrentes/new?direction=${activeTab}`}
          className={cn(
            "flex items-center gap-2 rounded-full border px-6 py-2.5 text-xs font-semibold",
            activeTab === "OUTFLOW"
              ? "border-z-brass/30 text-z-brass"
              : "border-z-income/30 text-z-income"
          )}
        >
          <Plus className="size-3.5" />
          {activeTab === "OUTFLOW" ? "Nuevo gasto recurrente" : "Nuevo ingreso"}
        </Link>
      </div>

      {/* Impact dialog (controlled, outside any Sheet) */}
      {impactAction && (
        <RecurringImpactDialog
          templateId={impactAction.template.id}
          templateName={impactAction.template.merchant_name ?? "Recurrente"}
          currencyCode={(impactAction.template.currency_code ?? "COP") as CurrencyCode}
          action={impactAction.action}
          onConfirm={handleImpactConfirm}
          open={!!impactAction}
          onOpenChange={(open) => {
            if (!open) setImpactAction(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/recurring/mobile-recurring-manager.tsx
git commit -m "feat: add MobileRecurringManager with timeline, tabs, and sequential overlay"
```

---

## Task 10: Route Pages — `/recurrentes`, `/recurrentes/new`, `/recurrentes/[id]/edit`

**Files:**
- Modify: `webapp/src/app/(dashboard)/recurrentes/page.tsx` (replace redirect)
- Create: `webapp/src/app/(dashboard)/recurrentes/loading.tsx`
- Create: `webapp/src/app/(dashboard)/recurrentes/new/page.tsx`
- Create: `webapp/src/app/(dashboard)/recurrentes/[id]/edit/page.tsx`

- [ ] **Step 1: Replace redirect with manager page**

Overwrite `webapp/src/app/(dashboard)/recurrentes/page.tsx`:

```typescript
import { Suspense } from "react";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { MobileRecurringManager } from "@/components/recurring/mobile-recurring-manager";
import { getRecurringTemplates, getRecurringSummary } from "@/actions/recurring-templates";
import { ensureCurrentOccurrences } from "@/actions/occurrences";
import { getAccounts } from "@/actions/accounts";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export default async function RecurrentesPage() {
  await ensureCurrentOccurrences();

  const [templates, accounts, summary] = await Promise.all([
    getRecurringTemplates(),
    getAccounts(),
    getRecurringSummary(),
  ]);

  const currency: CurrencyCode = "COP";

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader variant="sub" title="Recurrentes" backHref="/plan" />
      <MobileRecurringManager
        templates={templates}
        accounts={accounts}
        currency={currency}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create loading skeleton**

Write `webapp/src/app/(dashboard)/recurrentes/loading.tsx`:

```typescript
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

export default function RecurrentesLoading() {
  return (
    <div className={PAGE_STACK_CLASS}>
      <div className="space-y-4 p-4">
        <div className="h-24 animate-pulse rounded-2xl bg-white/4" />
        <div className="h-10 animate-pulse rounded-xl bg-white/4" />
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-white/4" />
          <div className="h-16 animate-pulse rounded-xl bg-white/4" />
          <div className="h-16 animate-pulse rounded-xl bg-white/4" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create new template page**

Write `webapp/src/app/(dashboard)/recurrentes/new/page.tsx`:

```typescript
import { MobileHeader } from "@/components/mobile/mobile-header";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { redirect } from "next/navigation";

export default async function NewRecurrentePage({
  searchParams,
}: {
  searchParams: Promise<{ direction?: string }>;
}) {
  const params = await searchParams;
  const [accounts, categories] = await Promise.all([
    getAccounts(),
    getCategories(),
  ]);

  async function handleSuccess() {
    "use server";
    redirect("/recurrentes");
  }

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader variant="sub" title="Nueva recurrente" backHref="/recurrentes" />
      <div className="px-4 pb-20">
        <RecurringForm
          accounts={accounts}
          categories={categories}
          defaultDirection={params.direction === "INFLOW" ? "INFLOW" : "OUTFLOW"}
        />
      </div>
    </div>
  );
}
```

Note: `RecurringForm` needs a `defaultDirection` prop added (small mod in Task 3 or inline here). If the form already uses `template?.direction ?? "OUTFLOW"` as default, passing direction via search param and pre-selecting in the form works.

- [ ] **Step 4: Create edit template page**

Write `webapp/src/app/(dashboard)/recurrentes/[id]/edit/page.tsx`:

```typescript
import { notFound, redirect } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { getRecurringTemplate } from "@/actions/recurring-templates";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

export default async function EditRecurrentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template, accounts, categories] = await Promise.all([
    getRecurringTemplate(id),
    getAccounts(),
    getCategories(),
  ]);

  if (!template) notFound();

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader
        variant="sub"
        title={`Editar ${template.merchant_name}`}
        backHref="/recurrentes"
      />
      <div className="px-4 pb-20">
        <RecurringForm
          template={template}
          accounts={accounts}
          categories={categories}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add webapp/src/app/\(dashboard\)/recurrentes/
git commit -m "feat: add /recurrentes route pages (manager, new, edit)"
```

---

## Task 11: Update Plan Page — Link to `/recurrentes`

**Files:**
- Modify: `webapp/src/components/plan/tabs/plan-tab-recurrentes.tsx`

- [ ] **Step 1: Replace mobile view with redirect link**

The mobile section of `plan-tab-recurrentes.tsx` (around line 38-52) currently renders `<MobileRecurrentesView>`. Replace the mobile block to redirect to `/recurrentes`:

In the server component, add a redirect for mobile. Since this is a server component rendered inside the Plan page tabs, the simplest approach is to keep the desktop view but change the mobile `<div className="lg:hidden">` block to show a link card:

```typescript
<div className="lg:hidden">
  <Link
    href="/recurrentes"
    className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3"
  >
    <div>
      <p className="text-sm font-semibold">Administrar recurrentes</p>
      <p className="text-xs text-muted-foreground">
        {summary.activeCount} activos · {formatCurrency(summary.totalMonthlyExpenses + summary.totalMonthlyIncome, currency)}/mes
      </p>
    </div>
    <ChevronRight className="size-4 text-muted-foreground" />
  </Link>
</div>
```

Add `Link` from `next/link` and `ChevronRight` from `lucide-react` to imports.

- [ ] **Step 2: Build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/plan/tabs/plan-tab-recurrentes.tsx
git commit -m "feat: plan page mobile recurrentes links to /recurrentes manager"
```

---

## Task 12: Visual Testing + Polish

- [ ] **Step 1: Start dev server and test mobile viewport**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm dev
```

Open `http://localhost:3000/recurrentes` at 390×844 viewport (iPhone 14 Pro).

- [ ] **Step 2: Test golden path**

1. Verify hero shows correct totals and proportion bar
2. Verify segmented control switches between Gastos/Ingresos
3. Verify timeline shows templates grouped by date with correct status dots
4. Tap a template card → expanded view with skeleton → stats load
5. Tap Edit → navigates to `/recurrentes/[id]/edit` with form pre-filled
6. Save edit → redirects back to `/recurrentes`
7. Tap Pause on expanded card → AlertDialog appears (no layering bug)
8. Confirm Pause → template moves to Paused section
9. Tap Delete → AlertDialog with impact → confirm → template removed
10. Tap "+ Nuevo gasto recurrente" → navigates to `/recurrentes/new`
11. Fill form → save → redirects back to `/recurrentes`

- [ ] **Step 3: Test edge cases**

1. Navigate from Plan → "Administrar recurrentes" → `/recurrentes` → back → Plan
2. `/recurrentes/new` → back → `/recurrentes`
3. Empty state: no templates → shows "No hay gastos recurrentes"
4. Only paused templates → shows Paused section only
5. Desktop viewport → Plan page still shows desktop `RecurringList` (no regression)

- [ ] **Step 4: Fix any styling issues found**

- [ ] **Step 5: Final build gate**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
```

- [ ] **Step 6: Commit any polish fixes**

```bash
git add -A
git commit -m "fix: recurring manager visual polish and edge case fixes"
```

---

## Task 13: Agent Review Gates

Run all four review agents before declaring done.

- [ ] **Step 1: `recurring-doctor`** — verify occurrence lifecycle, `ONCE` frequency handling, `ensureCurrentOccurrences` called on new page

- [ ] **Step 2: `zetas-front-guy`** — audit all new TSX files for token compliance, design system patterns

- [ ] **Step 3: `server-action-reviewer`** — review `getTemplateStats` action for auth, defense-in-depth, error handling

- [ ] **Step 4: `cache-doctor`** — verify new page route caching, `revalidateTag` paths after mutations

- [ ] **Step 5: Fix any issues found by agents**

- [ ] **Step 6: Final build gate + commit**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build
git add -A
git commit -m "fix: address review agent findings"
```
