# Mobile Plan Editing + Envelope Colors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mobile Periodo view full editing parity with desktop (status toggle, CRUD, assignments) and add color-coded income envelopes to both desktop and mobile.

**Architecture:** Reuse existing desktop dialog components (`EntryFormDialog`, `EditEntryDialog`, `AssignmentDialog`) on mobile — they render as bottom sheets via vaul. Add a shared `ENVELOPE_COLORS` palette that both desktop and mobile use to visually link income sources to expense assignments. No new server actions or DB migrations needed.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui (Dialog/vaul), `toggleEntryStatus` / `deletePlanningEntry` / `createAssignment` / `deleteAssignment` / `autoAssignExpenses` server actions

---

## Current State

| Capability | Desktop (`EnvelopeBoard`) | Mobile (`MobilePeriodoView`) |
|---|---|---|
| Status toggle | `ExpenseEntryRow` checkbox cycles PLANNED→COMPLETED→SKIPPED | Hardcoded "Pendiente" |
| Add entry | `EntryFormDialog` in section headers | None |
| Edit entry | `EditEntryDialog` via ⋯ menu | None |
| Delete entry | `deletePlanningEntry` via ⋯ menu | None |
| Assign expense→income | `AssignmentDialog` | None |
| Auto-assign | `AutoAssignButton` | None |
| Income assignments list | Expandable in `IncomeEnvelopeCard` | None |
| Envelope colors | None | None |

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `webapp/src/lib/constants/envelope-colors.ts` | Shared color palette for income envelopes (6 colors) |

### Modified Files
| File | Changes |
|---|---|
| `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx` | Full rewrite: status toggle, CRUD, assignments, envelope colors |
| `webapp/src/components/plan/tabs/plan-tab-periodo.tsx` | Pass `accounts` + `categories` props to `MobilePeriodoView` |
| `webapp/src/components/cashflow-planner/envelope-board.tsx` | Pass `colorIndex` to income cards, build color map for expense rows |
| `webapp/src/components/cashflow-planner/income-envelope-card.tsx` | Accept `colorIndex`, use envelope color for border + progress |
| `webapp/src/components/cashflow-planner/expense-entry-row.tsx` | Accept assignment color data, show colored chips |
| `webapp/src/components/cashflow-planner/assignment-dialog.tsx` | Show colored dots next to income options |

---

## Task Breakdown

### Task 1: Envelope color palette

**Files:**
- Create: `webapp/src/lib/constants/envelope-colors.ts`

- [ ] **Step 1: Create the color palette file**

```typescript
// webapp/src/lib/constants/envelope-colors.ts

export const ENVELOPE_COLORS = [
  { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30", hex: "#60a5fa" },
  { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30", hex: "#a78bfa" },
  { bg: "bg-teal-500/15", text: "text-teal-400", border: "border-teal-500/30", hex: "#2dd4bf" },
  { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", hex: "#fbbf24" },
  { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30", hex: "#f472b6" },
  { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/30", hex: "#22d3ee" },
] as const;

export type EnvelopeColor = (typeof ENVELOPE_COLORS)[number];

export function getEnvelopeColor(index: number): EnvelopeColor {
  return ENVELOPE_COLORS[index % ENVELOPE_COLORS.length];
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/lib/constants/envelope-colors.ts
git commit -m "feat: add shared envelope color palette for income sources"
```

---

### Task 2: Desktop envelope colors — income cards

**Files:**
- Modify: `webapp/src/components/cashflow-planner/envelope-board.tsx`
- Modify: `webapp/src/components/cashflow-planner/income-envelope-card.tsx`

- [ ] **Step 1: Add `colorIndex` prop to `IncomeEnvelopeCard`**

In `income-envelope-card.tsx`, add a `colorIndex: number` prop to the interface:

```typescript
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";

interface IncomeEnvelopeCardProps {
  envelope: IncomeEnvelope;
  currency: CurrencyCode;
  onEdit?: (entry: PlanningEntryWithRelations) => void;
  colorIndex: number;
}
```

Then use the color for the card's left border and progress bar. Replace the card's outer `div` className:

```typescript
const envelopeColor = getEnvelopeColor(colorIndex);

// Card wrapper — add left border with envelope color
<div className="rounded-xl border border-white/6 bg-card p-4 space-y-3 border-l-2" style={{ borderLeftColor: envelopeColor.hex }}>
```

Replace the `Progress` component's color. The `Progress` component from shadcn uses `bg-primary` for the indicator. Instead, use a custom progress bar:

```typescript
{/* Replace <Progress value={percentUsed} className="h-1.5" /> with: */}
<div className="h-1.5 w-full rounded-full bg-white/6 overflow-hidden">
  <div
    className="h-full rounded-full transition-all"
    style={{ width: `${percentUsed}%`, backgroundColor: envelopeColor.hex }}
  />
</div>
```

Also replace the `text-z-income` on the amount with the envelope color:

```typescript
<p className={cn("text-sm sm:text-lg font-semibold tabular-nums", envelopeColor.text)}>
```

And the checkmark icon when status is COMPLETED:

```typescript
{entry.status === "COMPLETED" && <Check className="h-3.5 w-3.5" style={{ color: envelopeColor.hex }} />}
```

- [ ] **Step 2: Pass `colorIndex` from `EnvelopeBoard`**

In `envelope-board.tsx`, pass the loop index to each `IncomeEnvelopeCard`:

```typescript
{income_envelopes.map((env, index) => (
  <IncomeEnvelopeCard
    key={env.entry.id}
    envelope={env}
    currency={currency}
    onEdit={openEditDialog}
    colorIndex={index}
  />
))}
```

- [ ] **Step 3: Verify build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/cashflow-planner/income-envelope-card.tsx webapp/src/components/cashflow-planner/envelope-board.tsx
git commit -m "feat: color-coded income envelope cards on desktop"
```

---

### Task 3: Desktop envelope colors — expense rows + assignment dialog

**Files:**
- Modify: `webapp/src/components/cashflow-planner/envelope-board.tsx`
- Modify: `webapp/src/components/cashflow-planner/expense-entry-row.tsx`
- Modify: `webapp/src/components/cashflow-planner/assignment-dialog.tsx`

- [ ] **Step 1: Build income color map in `EnvelopeBoard` and pass to expense rows**

In `envelope-board.tsx`, build a map of `incomeEntryId → colorIndex` and an `assignmentColors` map for each expense:

```typescript
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";

// Inside EnvelopeBoard, after assignedPerExpense:
const incomeColorMap = new Map<string, number>();
income_envelopes.forEach((env, index) => {
  incomeColorMap.set(env.entry.id, index);
});

// Build per-expense assignment color data
type ExpenseAssignmentChip = { colorIndex: number; amount: number; label: string };
const expenseAssignmentChips = new Map<string, ExpenseAssignmentChip[]>();
for (const env of income_envelopes) {
  const colorIdx = incomeColorMap.get(env.entry.id) ?? 0;
  for (const { assignment } of env.assignments) {
    const chips = expenseAssignmentChips.get(assignment.expense_entry_id) ?? [];
    chips.push({
      colorIndex: colorIdx,
      amount: Number(assignment.assigned_amount),
      label: env.entry.label,
    });
    expenseAssignmentChips.set(assignment.expense_entry_id, chips);
  }
}
```

Pass to each `ExpenseEntryRow`:

```typescript
<ExpenseEntryRow
  key={entry.id}
  entry={entry}
  currency={currency}
  assignedAmount={assignedPerExpense.get(entry.id) ?? 0}
  assignmentChips={expenseAssignmentChips.get(entry.id) ?? []}
  onAssign={() => openAssignDialog(entry)}
  onEdit={openEditDialog}
/>
```

- [ ] **Step 2: Show colored assignment chips in `ExpenseEntryRow`**

Add to the `ExpenseEntryRowProps` interface:

```typescript
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";

interface ExpenseEntryRowProps {
  // ... existing props
  assignmentChips?: { colorIndex: number; amount: number; label: string }[];
}
```

Below the amount in the row, show the chips when they exist:

```typescript
{assignmentChips && assignmentChips.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-0.5">
    {assignmentChips.map((chip, i) => {
      const c = getEnvelopeColor(chip.colorIndex);
      return (
        <span
          key={i}
          className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium", c.bg, c.text)}
          title={chip.label}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: c.hex }} />
          {formatCurrency(chip.amount, currency)}
        </span>
      );
    })}
  </div>
)}
```

- [ ] **Step 3: Show colored dots in `AssignmentDialog`**

In `assignment-dialog.tsx`, accept an `incomeColorMap` prop:

```typescript
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";

interface AssignmentDialogProps {
  // ... existing props
  incomeColorMap?: Map<string, number>;
}
```

In the income option buttons, add a colored dot:

```typescript
<button
  key={env.entry.id}
  type="button"
  onClick={() => handleSelectIncome(env.entry.id, env.remaining_amount)}
  className={...}
>
  <div className="flex items-center gap-2">
    {incomeColorMap && (
      <span
        className="size-2.5 rounded-full shrink-0"
        style={{ backgroundColor: getEnvelopeColor(incomeColorMap.get(env.entry.id) ?? 0).hex }}
      />
    )}
    <div>
      <p className="text-sm font-medium">{env.entry.label}</p>
      ...
    </div>
  </div>
  ...
</button>
```

Pass `incomeColorMap` from `EnvelopeBoard`:

```typescript
<AssignmentDialog
  open={assignDialogOpen}
  onOpenChange={setAssignDialogOpen}
  expense={assignTarget}
  incomeEnvelopes={income_envelopes}
  currency={currency}
  existingAssignedToExpense={...}
  incomeColorMap={incomeColorMap}
/>
```

- [ ] **Step 4: Verify build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/cashflow-planner/
git commit -m "feat: colored assignment chips on expense rows + dots in assignment dialog"
```

---

### Task 4: Pass accounts + categories to mobile periodo view

**Files:**
- Modify: `webapp/src/components/plan/tabs/plan-tab-periodo.tsx`

- [ ] **Step 1: Pass `accounts` and `categories` to `MobilePeriodoView`**

In `plan-tab-periodo.tsx`, update the `MobilePeriodoView` call:

```typescript
<MobilePeriodoView
  planData={planData}
  timelineData={timelineData}
  currency={currency}
  isExpired={isExpired}
  accounts={accounts}
  categories={categories}
/>
```

This will cause a type error until Task 5 updates `MobilePeriodoView` to accept these props.

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/plan/tabs/plan-tab-periodo.tsx
git commit -m "feat: pass accounts + categories to mobile periodo view"
```

---

### Task 5: Mobile periodo — full interactive rewrite

**Files:**
- Modify: `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx`

This is the largest task. The mobile view needs: status toggle, entry CRUD (create/edit/delete), assignment management, and envelope colors. Reuse existing desktop dialog components.

- [ ] **Step 1: Rewrite `MobilePeriodoView`**

The full rewrite of `mobile-periodo-view.tsx`. Key changes:

**Props expansion:**
```typescript
import { useState, useTransition, useMemo } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";
import { Check, ChevronDown, ChevronUp, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, Undo2, ArrowRightLeft } from "lucide-react";
import { PlanFlowChart } from "./plan-flow-chart";
import { EntryFormDialog } from "@/components/cashflow-planner/entry-form-dialog";
import { EditEntryDialog } from "@/components/cashflow-planner/edit-entry-dialog";
import { AssignmentDialog } from "@/components/cashflow-planner/assignment-dialog";
import { AutoAssignButton } from "@/components/cashflow-planner/auto-assign-button";
import { toggleEntryStatus, deletePlanningEntry, deleteAssignment } from "@/actions/cashflow-planner";
import { toast } from "sonner";
import type { PlanTimelineData } from "@/actions/plan-timeline";
import type { PeriodPlanData, IncomeEnvelope, PlanningEntryWithRelations } from "@/types/cashflow-planner";
import type { CurrencyCode, PlanningEntryStatus, Account, Category } from "@/types/domain";

interface MobilePeriodoViewProps {
  planData: PeriodPlanData;
  timelineData: PlanTimelineData;
  currency: CurrencyCode;
  isExpired: boolean;
  accounts: Pick<Account, "id" | "name" | "icon" | "color">[];
  categories: Pick<Category, "id" | "name" | "name_es" | "icon" | "color">[];
}
```

**State management** (same pattern as `EnvelopeBoard`):
```typescript
const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
const [assignTarget, setAssignTarget] = useState<PlanningEntryWithRelations | null>(null);
const [assignDialogOpen, setAssignDialogOpen] = useState(false);
const [editTarget, setEditTarget] = useState<PlanningEntryWithRelations | null>(null);
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [isPending, startTransition] = useTransition();
```

**Compute assignment data** (same as `EnvelopeBoard`):
```typescript
const assignedPerExpense = useMemo(() => {
  const map = new Map<string, number>();
  for (const env of income_envelopes) {
    for (const { assignment } of env.assignments) {
      const prev = map.get(assignment.expense_entry_id) ?? 0;
      map.set(assignment.expense_entry_id, prev + Number(assignment.assigned_amount));
    }
  }
  return map;
}, [income_envelopes]);

const incomeColorMap = useMemo(() => {
  const map = new Map<string, number>();
  income_envelopes.forEach((env, index) => map.set(env.entry.id, index));
  return map;
}, [income_envelopes]);

const expenseAssignmentChips = useMemo(() => {
  const map = new Map<string, { colorIndex: number; amount: number; label: string }[]>();
  for (const env of income_envelopes) {
    const colorIdx = incomeColorMap.get(env.entry.id) ?? 0;
    for (const { assignment } of env.assignments) {
      const chips = map.get(assignment.expense_entry_id) ?? [];
      chips.push({ colorIndex: colorIdx, amount: Number(assignment.assigned_amount), label: env.entry.label });
      map.set(assignment.expense_entry_id, chips);
    }
  }
  return map;
}, [income_envelopes, incomeColorMap]);
```

**Status badge map** (same as desktop):
```typescript
const STATUS_BADGE: Record<PlanningEntryStatus, { label: string; className: string }> = {
  PLANNED: { label: "Pendiente", className: "bg-amber-400/10 text-amber-400" },
  COMPLETED: { label: "Pagado", className: "bg-z-income/10 text-z-income" },
  SKIPPED: { label: "Omitido", className: "bg-white/5 text-muted-foreground line-through" },
};
```

**IncomeCard** — add colored left border, status toggle, expandable assignments, edit/delete via `⋯` menu:
- Left border uses `getEnvelopeColor(incomeColorMap.get(entry.id) ?? idx).hex`
- Progress bar uses envelope hex color
- Checkmark toggles PLANNED ↔ COMPLETED via `toggleEntryStatus`
- `⋯` dropdown with Editar → `setEditTarget(entry); setEditDialogOpen(true)` and Eliminar → `deletePlanningEntry(entry.id)`
- Expandable assignments list: tap card body to toggle, show each assigned expense with amount + remove button

**ExpenseRow** — add status badge, expandable action bar:
- Show status badge from `STATUS_BADGE[entry.status]`
- Tap badge to cycle status (PLANNED→COMPLETED→SKIPPED→PLANNED) via `toggleEntryStatus`
- Show colored assignment chips when assigned
- Tap row body to expand action bar with: "Asignar" → `setAssignTarget(entry); setAssignDialogOpen(true)`, "Editar" → `setEditTarget(entry); setEditDialogOpen(true)`, "Eliminar" → `deletePlanningEntry(entry.id)` with toast
- `opacity-50` when SKIPPED

**Section headers** — add entry buttons:
- Ingresos header: `<EntryFormDialog periodId={period.id} currency={currency} defaultType="INCOME" accounts={accounts} categories={categories} />`
- Gastos header: `<EntryFormDialog ... defaultType="EXPENSE" />` + `<AutoAssignButton periodId={period.id} />` when `unassigned_expenses.length > 0 && income_envelopes.length > 0`

**Dialogs** at bottom of component (same as `EnvelopeBoard`):
```typescript
<AssignmentDialog
  open={assignDialogOpen}
  onOpenChange={setAssignDialogOpen}
  expense={assignTarget}
  incomeEnvelopes={income_envelopes}
  currency={currency}
  existingAssignedToExpense={assignTarget ? (assignedPerExpense.get(assignTarget.id) ?? 0) : 0}
  incomeColorMap={incomeColorMap}
/>
<EditEntryDialog
  entry={editTarget}
  open={editDialogOpen}
  onOpenChange={setEditDialogOpen}
  currency={currency}
  accounts={accounts}
  categories={categories}
/>
```

- [ ] **Step 2: Verify build**

```bash
cd webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx
git commit -m "feat: mobile periodo full editing parity — status, CRUD, assignments, colors"
```

---

### Task 6: Final build verification + cleanup

**Files:**
- All modified files from Tasks 1-5

- [ ] **Step 1: Full build**

```bash
cd webapp && pnpm build
```

Fix any type errors or missing imports.

- [ ] **Step 2: Check for unused imports**

Scan changed files for any `declared but never read` warnings and fix them.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build warnings from mobile plan editing"
```

---

## Verification Checklist

- [ ] Desktop income cards show colored left border + colored progress bar
- [ ] Desktop expense rows show colored assignment chips
- [ ] Desktop assignment dialog shows colored dots next to income options
- [ ] Mobile periodo shows Pendiente/Pagado/Omitido badges (not hardcoded)
- [ ] Mobile periodo: tap badge cycles status
- [ ] Mobile periodo: "Agregar" buttons in Ingresos and Gastos headers
- [ ] Mobile periodo: tap expense row expands action bar (Asignar, Editar, Eliminar)
- [ ] Mobile periodo: income cards expandable to show assignments
- [ ] Mobile periodo: income cards have colored left borders matching desktop
- [ ] Mobile periodo: Auto-asignar button visible when unassigned expenses exist
- [ ] `pnpm build` passes clean
