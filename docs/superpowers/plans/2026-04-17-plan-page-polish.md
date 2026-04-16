# Plan page polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the mobile `/plan` root + three tabs (periodo, recurrentes, presupuesto) so that "shape of the month" reads at a glance — color-coded NETO, RITMO-proportioned drill chips with brand-brass logos, NETO hero elevated on Periodo, templates promoted on Recurrentes, risk-state grouping on Presupuesto, and a 50/30/20 Meta vs Actual sheet.

**Architecture:** In-place restyling and minor prop additions across `webapp/src/components/mobile/v2/plan/*` plus `webapp/src/components/mobile/mobile-presupuesto.tsx`. One new bottom-sheet component (`plan-5030-20-sheet.tsx`) that consumes the existing `get503020Allocation` server action (already wired into `getPlanPageData`). One server-side shape extension to surface `overdueCount` for the Recurrentes drill chip. No schema changes; `Parcial` occurrence state is deferred to BACKLOG.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (Sheet + lucide-react icons), design tokens from `docs/design-system/TOKENS.md`, Playwright MCP for visual verification.

**Spec:** `docs/superpowers/specs/2026-04-17-plan-page-polish-design.md`

---

## File Structure

**New:**
- `webapp/src/components/mobile/v2/plan/plan-5030-20-sheet.tsx` — bottom sheet component (D7). Consumes `AllocationData` from `@/actions/allocation`. Three buckets (Necesario / Deseos / Ahorro) with Meta labels + bar + meta-position marker.
- `webapp/src/components/mobile/v2/plan/mobile-recurrentes-templates-strip.tsx` — header strip subcomponent for D4. Holds the collapsible template list moved from `TemplatesSection` (today at the footer of `mobile-recurrentes-view.tsx`).

**Modified:**
- `webapp/src/components/mobile/v2/plan/plan-net-hero.tsx` — D1 (color-code NETO, retokenize emerald/red to z-income/z-expense) + D8 (expand cue: full-brass + Chevron icon).
- `webapp/src/components/mobile/v2/plan/plan-expandable-chips.tsx` — D2 (sort chips by soonest `next_date`; highlight the sooner one with brass border hint).
- `webapp/src/components/mobile/v2/plan/plan-drill-cards.tsx` — D10 full rebuild: eyebrow → centered `lucide-react` icon (Wallet / CalendarCheck / RefreshCw / Heart) at `text-z-brass/85` → caption line with state-aware color.
- `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx` — D3 NETO hero elevation; remove stat-row NETO.
- `webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx` — D4 (promote templates strip above occurrences list + remove inner month pager + delete footer `TemplatesSection`).
- `webapp/src/components/mobile/mobile-presupuesto.tsx` — D6 (group categories by risk state, drop `⚠` icon) + D7 (make `Necesario X% · Deseos Y%` row a button that opens the sheet).
- `webapp/src/actions/plan.ts` — extend `PlanPageData.recurring` with `overdueCount: number` (pending occurrences whose `occurrence_date < today`), used by D10 caption rules.
- `webapp/src/types/plan.ts` — matching type update.
- `BACKLOG.md` — append entries for `Parcial` occurrence state and any deferred follow-ups surfaced during implementation.

**Deleted:**
- None. `TemplatesSection` inline definition inside `mobile-recurrentes-view.tsx` is replaced by the new strip subcomponent; no exported component is removed.

---

## Task ordering rationale

Ordered to minimize risk and maximize reviewable units:

1. **Task 1 — Data layer** (plan.ts + types): unblocks D10 caption and nothing else depends on it visually yet.
2. **Tasks 2–4 — Plan root tier** (net hero, chips order, drill cards): each independent from the others, commit-per-task.
3. **Tasks 5–7 — Tab tier** (periodo NETO, recurrentes restructure, presupuesto group + sheet): each touches a different tab.
4. **Task 8 — `plan-budget-hero.tsx` retokenize**: small cleanup pass.
5. **Task 9 — Verification pass**: build + Playwright captures.
6. **Task 10 — Review gate**: zetas-front-guy + perf-auditor → Gemini → frontend-auditor + ux-analyst → /simplify.

Tasks that touch the same file have been collapsed (`plan-net-hero.tsx` D1+D8 in Task 2; `mobile-presupuesto.tsx` D6+D7 in Task 7; `mobile-recurrentes-view.tsx` D4 restructure in Task 6).

---

## Task 1: Extend plan data with `overdueCount`

**Files:**
- Modify: `webapp/src/types/plan.ts`
- Modify: `webapp/src/actions/plan.ts`

- [ ] **Step 1.1: Add `overdueCount` to `PlanPageData.recurring`**

Open `webapp/src/types/plan.ts`. Locate the `recurring:` block inside `PlanPageData`. Add a new field:

```ts
recurring: {
  upcoming: UpcomingRecurrence[];
  upcomingIncome: UpcomingRecurrence[];
  totalMonthlyExpenses: number;
  totalMonthlyIncome: number;
  activeCount: number;
  dueSoonCount: number;
  dueSoonTotal: number;
  overdueCount: number; // NEW — pending occurrences with occurrence_date < today
};
```

- [ ] **Step 1.2: Compute `overdueCount` inside `getPlanPageData`**

Open `webapp/src/actions/plan.ts`. Inside the `cache`-wrapped `getPlanPageData` body, after the parallel `Promise.all([...])` block (around line 128), add a Supabase query for the overdue count:

```ts
const { supabase, user } = await getAuthenticatedClient();
const today = new Date().toISOString().slice(0, 10);

let overdueCount = 0;
if (user) {
  const { count } = await supabase
    .from("recurring_occurrences")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .lt("occurrence_date", today);
  overdueCount = count ?? 0;
}
```

Then add `overdueCount` to the `recurring` block of the return:

```ts
recurring: {
  upcoming: dueSoon,
  upcomingIncome,
  totalMonthlyExpenses: recurringSummary.totalMonthlyExpenses,
  totalMonthlyIncome: recurringSummary.totalMonthlyIncome,
  activeCount: recurringSummary.activeCount,
  dueSoonCount: dueSoon.length,
  dueSoonTotal,
  overdueCount,
},
```

**Notes:**
- Import `getAuthenticatedClient` from `@/lib/supabase/auth` if not already imported.
- The `(select auth.uid()) = user_id` RLS pattern applies; also add the `.eq("user_id", user.id)` defense-in-depth per CLAUDE.md.
- This adds one small query to an already-cached action; `cacheLife("zeta")` handles the SWR.

- [ ] **Step 1.3: Verify build**

```bash
cd webapp && pnpm build
```
Expected: green. No type errors in `plan.ts` or consumers of `PlanPageData`.

- [ ] **Step 1.4: Commit**

```bash
git add webapp/src/types/plan.ts webapp/src/actions/plan.ts
git commit -m "feat(plan): surface overdueCount for recurring occurrences

Enables Task 4 (D10 caption rules for Recurrentes drill chip)."
```

---

## Task 2: Plan root NETO hero (D1 + D8)

**File:**
- Modify: `webapp/src/components/mobile/v2/plan/plan-net-hero.tsx`

- [ ] **Step 2.1: Read current file to anchor edits**

```bash
cat webapp/src/components/mobile/v2/plan/plan-net-hero.tsx
```

Note the key regions to change (lines approximate — locate by content):
- Line 56: `<p className="text-3xl font-bold text-z-brass">` — NETO number, currently always brass.
- Line 63: `bg-emerald-500/80` — ingresos bar segment.
- Line 65: `bg-red-500/80` — gastos bar segment.
- Line 77 / 81: `bg-emerald-500` / `bg-red-500` — legend dots.
- Line 91: `text-z-brass/50` — expand cue.
- Line 92: `Toca para ver flujo ↓` — expand cue copy.
- Line 100–103: collapse cue (`Ocultar flujo ↑`).

- [ ] **Step 2.2: Import `ChevronDown` and `ChevronUp`**

Add to imports:

```ts
import { ChevronDown, ChevronUp } from "lucide-react";
```

- [ ] **Step 2.3: Color-code NETO number (D1)**

Replace the NETO `<p>` block with:

```tsx
<p
  className={`text-3xl font-bold ${
    neto > 0 ? "text-z-income" : neto < 0 ? "text-z-expense" : "text-z-brass"
  }`}
>
  {neto >= 0 ? "+" : ""}
  {formatCurrency(neto, currency)}
</p>
```

- [ ] **Step 2.4: Retokenize bar segment colors (D1)**

Replace the three bar `<div>` class strings inside the stacked progress bar:

```tsx
<div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-z-surface-2">
  <div className="absolute inset-y-0 left-0 w-full rounded-full bg-z-income/80" />
  <div
    className="absolute inset-y-0 left-0 rounded-l-full bg-z-expense/80"
    style={{ width: `${gastosRatio}%` }}
  />
  <div
    className="absolute inset-y-0 right-0 rounded-r-full bg-z-brass/80"
    style={{ width: `${netoRatio}%` }}
  />
</div>
```

- [ ] **Step 2.5: Retokenize legend dots (D1)**

Swap the two legend dots:

```tsx
<span className="flex items-center gap-1">
  <span className="inline-block size-1.5 rounded-full bg-z-income" />
  Ingresos {formatCurrency(ingresos, currency)}
</span>
<span className="flex items-center gap-1">
  <span className="inline-block size-1.5 rounded-full bg-z-expense" />
  Gastos {formatCurrency(gastos, currency)}
</span>
<span className="flex items-center gap-1">
  <span className="inline-block size-1.5 rounded-full bg-z-brass" />
  Neto
</span>
```

- [ ] **Step 2.6: Elevate the expand cue (D8)**

Replace the collapsed cue `<p>`:

```tsx
{!expanded && (
  <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] font-medium text-z-brass">
    Toca para ver flujo
    <ChevronDown className="size-3" aria-hidden="true" />
  </p>
)}
```

And the expanded cue:

```tsx
<p
  className="mt-2 flex cursor-pointer items-center justify-center gap-1 text-center text-[11px] font-medium text-z-brass"
  onClick={() => setExpanded(false)}
>
  Ocultar flujo
  <ChevronUp className="size-3" aria-hidden="true" />
</p>
```

- [ ] **Step 2.7: Verify build + visual**

```bash
cd webapp && pnpm build
```
Start dev server if not running, navigate to `/plan` on a 390×844 viewport via Playwright MCP (`browser_navigate` + `browser_resize`) and confirm:
- NETO is green when positive, red when negative (toggle via dev tools if no negative month available; or just verify the class string via inspector).
- Expand cue is bright brass, not a hint.
- Tap hero → flow chart renders; tap again → collapses.

- [ ] **Step 2.8: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-net-hero.tsx
git commit -m "polish(plan): color-code NETO + brighten expand cue

D1 + D8. Replaces hardcoded emerald/red with z-income/z-expense tokens."
```

---

## Task 3: Sort Próximo ingreso / pago by soonest date (D2)

**File:**
- Modify: `webapp/src/components/mobile/v2/plan/plan-expandable-chips.tsx`

- [ ] **Step 3.1: Compute the ordered chip list**

Inside the `PlanExpandableChips` function, just before the `return` statement, replace the fixed tuple iteration. Current code (line ~84):

```tsx
{(["income", "payment"] as const).map((type) => {
```

Replace the preceding block to derive the order. Add this block above `const expandedList = activeChip ? items[activeChip] : [];`:

```tsx
// D2: sort by soonest next_date. Tie-breaker: payment first (debt urgency).
const nextIncomeDate = incomes[0]?.next_date ?? null;
const nextPaymentDate = payments[0]?.next_date ?? null;

const paymentSooner = (() => {
  if (!nextIncomeDate && !nextPaymentDate) return false;
  if (!nextIncomeDate) return true;
  if (!nextPaymentDate) return false;
  if (nextPaymentDate === nextIncomeDate) return true; // payment first on tie
  return nextPaymentDate < nextIncomeDate;
})();

const orderedTypes = paymentSooner
  ? (["payment", "income"] as const)
  : (["income", "payment"] as const);
const sooner = orderedTypes[0];
```

- [ ] **Step 3.2: Use `orderedTypes` in the map and highlight the sooner chip**

Replace the chip iteration:

```tsx
<div className="grid grid-cols-2 gap-2">
  {orderedTypes.map((type) => {
    const c = CHIP_CONFIG[type];
    const next = items[type][0] ?? null;
    const isSooner = type === sooner && next !== null;
    return (
      <button
        key={type}
        type="button"
        onClick={() => toggle(type)}
        className={cn(
          "rounded-xl border p-3 text-left transition-all",
          activeChip === type ? c.borderActive : c.borderInactive,
          activeChip === OPPOSITE[type] && "opacity-50",
          isSooner && activeChip !== type && "ring-1 ring-z-brass/30",
        )}
      >
        {/* ...existing content unchanged... */}
      </button>
    );
  })}
</div>
```

Keep the inner chip JSX (the `{next ? (...) : (...)}` block) exactly as-is. The only additions are `orderedTypes`, `isSooner`, and the `ring-1 ring-z-brass/30` conditional.

- [ ] **Step 3.3: Verify build + visual**

```bash
cd webapp && pnpm build
```
Visual check at `/plan`: the chip with the sooner `next_date` is on the left and carries a subtle brass ring. If dates are equal (e.g. both `27 abr`), payment wins the left slot.

- [ ] **Step 3.4: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-expandable-chips.tsx
git commit -m "polish(plan): order Próximo chips by soonest date

D2. Payment wins the left slot on a date tie."
```

---

## Task 4: Rebuild "IR A" drill chips (D10)

**Files:**
- Read first: `webapp/src/components/mobile/v2/plan/plan-drill-cards.tsx` (entirety)
- Modify: `webapp/src/components/mobile/v2/plan/plan-drill-cards.tsx`

- [ ] **Step 4.1: Inspect current structure**

```bash
cat webapp/src/components/mobile/v2/plan/plan-drill-cards.tsx
```

Identify the card template (likely a shared inner component or 4 inlined blocks). Note the current prop shape (`budget`, `recurring`, `periodoSummary`, `wishlistCount`, `currency`, `expanded`, `onToggle`) and understand how caption data maps to each chip.

- [ ] **Step 4.2: Replace imports with lucide icons needed**

At the top of the file, import the four icons:

```tsx
import { Wallet, CalendarCheck, RefreshCw, Heart } from "lucide-react";
import Link from "next/link";
```

- [ ] **Step 4.3: Define a single `<DrillChip>` subcomponent**

Inside the same file (above the exported `PlanDrillCards`), add:

```tsx
interface DrillChipProps {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  caption: React.ReactNode;
}

function DrillChip({ label, href, icon: Icon, caption }: DrillChipProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[150px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/6 bg-white/[0.02] p-4 transition-colors active:bg-white/[0.04]"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <Icon className="size-10 text-z-brass/85" aria-hidden />
      <div className="text-center text-xs font-medium text-muted-foreground">
        {caption}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4.4: Build caption computations in the parent**

Inside `PlanDrillCards`, after destructuring props, compute:

```tsx
// Presupuesto caption
const overLimit = budget?.overLimitCount ?? 0;
const presupuestoCaption =
  overLimit > 0
    ? <span className="font-semibold text-z-brass">{overLimit} sobre límite</span>
    : "dentro del límite";

// Periodo caption — rely on periodoSummary
const percentAssigned = periodoSummary?.percentAssigned ?? 0;
const unassigned = periodoSummary?.unassignedCount ?? 0;
const periodoCaption =
  percentAssigned >= 100
    ? "al día"
    : unassigned > 0
      ? <span className="font-semibold text-z-brass">{unassigned} pendientes</span>
      : `${Math.round(percentAssigned)}%`;

// Recurrentes caption — uses overdueCount from Task 1
const dueSoonCount = recurring.dueSoonCount;
const overdueCount = recurring.overdueCount;
const recurrentesCaption = (
  <>
    {dueSoonCount} este mes
    {overdueCount > 0 && (
      <>
        {" · "}
        <span className="font-semibold text-z-brass">{overdueCount} vencidas</span>
      </>
    )}
  </>
);

// Deseos caption
const deseosCaption = `${wishlistCount} activos`;
```

- [ ] **Step 4.5: Replace the card grid with 4 `<DrillChip>`s**

Render:

```tsx
<div className="grid grid-cols-2 gap-2">
  <DrillChip
    label="Presupuesto"
    href="/plan?tab=presupuesto"
    icon={Wallet}
    caption={presupuestoCaption}
  />
  <DrillChip
    label="Periodo"
    href="/plan?tab=periodo"
    icon={CalendarCheck}
    caption={periodoCaption}
  />
  <DrillChip
    label="Recurrentes"
    href="/plan?tab=recurrentes"
    icon={RefreshCw}
    caption={recurrentesCaption}
  />
  <DrillChip
    label="Deseos"
    href="/plan?tab=deseos"
    icon={Heart}
    caption={deseosCaption}
  />
</div>
```

Remove any prior `expanded` / `onToggle` interaction wiring in this component — these chips are pure `<Link>`s now. Keep the `expanded` / `onToggle` props optional if other callers rely on them (audit: the only caller is `plan-root.tsx`).

- [ ] **Step 4.6: Simplify parent props in `plan-root.tsx` (if needed)**

In `webapp/src/components/mobile/v2/plan/plan-root.tsx`, the `<PlanDrillCards>` invocation passes `expanded` / `onToggle`. If `PlanDrillCards` no longer reads them, remove the two props from the call site. If the prop signature was narrowed, match types. Do not remove the `useExpandableZone` hook — it still powers `PlanExpandableChips`.

- [ ] **Step 4.7: Verify build + visual**

```bash
cd webapp && pnpm build
```

Navigate `/plan` via Playwright MCP at 390×844. Verify:
- 4 chips render in 2×2 grid.
- Each has brass icon centered.
- Captions match rules (e.g., `7 sobre límite`, `al día`, `8 este mes · 2 vencidas`, `2 activos`).
- Tap each → routes to the correct tab.

- [ ] **Step 4.8: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-drill-cards.tsx webapp/src/components/mobile/v2/plan/plan-root.tsx
git commit -m "polish(plan): RITMO-style drill chips with brand icons

D10. Eyebrow → centered lucide icon (brass) → state-aware caption.
Replaces the corner-icon + bottom-label pattern."
```

---

## Task 5: Periodo tab NETO elevation (D3)

**File:**
- Modify: `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx`

- [ ] **Step 5.1: Locate the existing NETO rendering**

```bash
cat webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx | head -120
```

Find the stat-row region that renders NETO today (often a 3-up or 4-up with INGRESOS / GASTOS / NETO). Note the variables used (likely `income`, `expenses`, `net`).

- [ ] **Step 5.2: Build a hero block that replaces the NETO stat row**

Add at the top of the render output (below the header / above the list):

```tsx
<div className="rounded-2xl border border-white/6 bg-z-surface-2 p-4">
  <div className="flex items-center justify-between">
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
      Neto del mes
    </p>
    <span className="text-[10px] text-muted-foreground">{periodLabel}</span>
  </div>
  <p
    className={cn(
      "mt-1 text-3xl font-bold tabular-nums",
      net > 0 ? "text-z-income" : net < 0 ? "text-z-expense" : "text-z-brass",
    )}
  >
    {net >= 0 ? "+" : ""}
    {formatCurrency(net, currency)}
  </p>
  <p className="mt-1 text-[11px] text-muted-foreground">
    +{formatCurrency(income, currency)} · −{formatCurrency(expenses, currency)}
  </p>
</div>
```

- [ ] **Step 5.3: Compute `periodLabel`**

Above the JSX, compute:

```ts
const dayOfMonth = new Date().getDate();
const periodLabel =
  dayOfMonth <= 10
    ? "Comienzo de mes"
    : dayOfMonth <= 20
      ? "Mitad de mes"
      : "Fin de mes";
```

If `mobile-periodo-view.tsx` already receives a `dayOfMonth` prop (plan-root passes it down), use that instead of reading `new Date()` client-side.

- [ ] **Step 5.4: Remove the pre-existing NETO stat-row cell**

Delete the old NETO cell from the stat row. Leave `INGRESOS` and `GASTOS` cells intact if they still provide value; otherwise, the simpler pattern is to delete the whole stat row since the hero already surfaces the breakdown. Prefer deletion — two representations of the same number violate density rules.

- [ ] **Step 5.5: Verify build + visual**

```bash
cd webapp && pnpm build
```

`/plan?tab=periodo` at 390×844 — confirm NETO is the visual anchor at top and color-codes with its sign.

- [ ] **Step 5.6: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx
git commit -m "polish(plan): elevate NETO to hero on Periodo tab

D3. Removes duplicate NETO stat-row cell."
```

---

## Task 6: Recurrentes templates strip + drop inner pager (D4)

**Files:**
- Create: `webapp/src/components/mobile/v2/plan/mobile-recurrentes-templates-strip.tsx`
- Modify: `webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx`

- [ ] **Step 6.1: Create the templates strip subcomponent**

Content for `mobile-recurrentes-templates-strip.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { MOBILE_EYEBROW_CLASS, PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type {
  Account,
  CategoryWithChildren,
  CurrencyCode,
  RecurringTemplateWithRelations,
} from "@/types/domain";

interface TemplatesStripProps {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
  categories: CategoryWithChildren[];
  currency: CurrencyCode;
  onMutate: () => Promise<void>;
}

export function MobileRecurrentesTemplatesStrip({
  templates,
  accounts,
  categories,
  currency,
  onMutate,
}: TemplatesStripProps) {
  const [expanded, setExpanded] = useState(false);

  let activeCount = 0;
  let pausedCount = 0;
  for (const t of templates) {
    if (t.is_active) activeCount++;
    else pausedCount++;
  }

  return (
    <div className="rounded-2xl border border-z-brass/18 bg-gradient-to-br from-z-brass/10 to-z-brass/[0.02] px-3.5 py-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className={cn(MOBILE_EYEBROW_CLASS, "text-z-brass")}>Mis plantillas</p>
          <p className="mt-0.5 text-sm font-semibold">
            {activeCount} activa{activeCount !== 1 ? "s" : ""}
            {pausedCount > 0 && ` · ${pausedCount} pausada${pausedCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <span className="text-[11px] font-medium text-z-brass">
          {expanded ? "Ocultar ↑" : "Ver ↓"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {templates.length > 0 ? (
            <div className={cn(PANEL_INSET_CLASS, "divide-y divide-white/5")}>
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5",
                    !t.is_active && "opacity-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{t.merchant_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.account?.name ?? "—"} · {t.frequency ?? "mensual"}
                      {!t.is_active && " · Pausada"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">
                    {formatCurrency(Number(t.amount), currency)}
                  </span>
                  <RecurringFormDialog
                    template={t}
                    accounts={accounts}
                    categories={categories}
                    onClose={onMutate}
                    trigger={
                      <button
                        type="button"
                        className="shrink-0 rounded-md px-2 py-0.5 text-[10px] text-z-brass active:bg-white/5"
                      >
                        Editar
                      </button>
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Aún no tienes plantillas
            </p>
          )}

          {/* Always-visible create CTA */}
          <RecurringFormDialog
            accounts={accounts}
            categories={categories}
            onClose={onMutate}
            trigger={
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-z-brass/20 py-2.5 text-xs font-semibold text-z-brass active:bg-z-brass/5"
              >
                <Plus className="size-3.5" />
                Nueva plantilla
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6.2: Import the strip in `mobile-recurrentes-view.tsx`**

Add:

```ts
import { MobileRecurrentesTemplatesStrip } from "./mobile-recurrentes-templates-strip";
```

- [ ] **Step 6.3: Drop the inner month pager (audit §17)**

In `mobile-recurrentes-view.tsx`, locate the hero card block (lines ~220-262) and remove the month-navigation `<div>`:

```tsx
{/* DELETE this block: */}
<div className="mt-3 flex items-center justify-between">
  <button type="button" onClick={hook.goPrevMonth} ...>‹</button>
  <span className="text-xs font-medium capitalize text-muted-foreground">
    {hook.monthLabel}
  </span>
  <button type="button" onClick={hook.goNextMonth} ...>›</button>
</div>
```

Keep the `Compromiso mensual` eyebrow + `totalPlanned` number + `Pendientes / Completados` split below.

Also remove the unused `ChevronLeft` / `ChevronRight` imports if no other usage remains in this file.

- [ ] **Step 6.4: Insert the strip above the pending list**

In `mobile-recurrentes-view.tsx`, immediately after the hero card and before the `Loading state` block, add:

```tsx
{hook.isHydrated && (
  <MobileRecurrentesTemplatesStrip
    templates={templates}
    accounts={accounts}
    categories={categories}
    currency={currency}
    onMutate={hook.refreshOccurrences}
  />
)}
```

- [ ] **Step 6.5: Remove the footer `TemplatesSection` + old `+ Nueva recurrente` CTA**

Locate the two blocks near the end of the `return`:

```tsx
{/* Create new recurring — always visible */}
{hook.isHydrated && (
  <div className="space-y-2">
    <RecurringFormDialog ... trigger={... "Nueva recurrente" ...} />
  </div>
)}

{/* Templates section — view all, manage paused */}
{hook.isHydrated && (
  <TemplatesSection ... />
)}
```

Delete both. The strip now handles both responsibilities.

Also delete the `TemplatesSection` inner function defined at the bottom of the file (if present) — it's no longer referenced.

- [ ] **Step 6.6: Verify build + visual**

```bash
cd webapp && pnpm build
```

`/plan?tab=recurrentes` at 390×844:
- Strip appears under the hero card.
- Tap strip → expands inline with template rows + `+ Nueva plantilla` CTA.
- No second month-pager (audit §17 fix).
- No footer duplicate.

- [ ] **Step 6.7: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/mobile-recurrentes-templates-strip.tsx webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx
git commit -m "polish(plan): promote templates strip + drop inner month pager

D4. Moves Mis plantillas from a footer link to a header strip.
Removes the redundant inner-card month pager (audit §17)."
```

---

## Task 7: Presupuesto group + 50/30/20 sheet (D6 + D7)

**Files:**
- Create: `webapp/src/components/mobile/v2/plan/plan-5030-20-sheet.tsx`
- Modify: `webapp/src/components/mobile/mobile-presupuesto.tsx`

- [ ] **Step 7.1: Create the sheet component**

Content for `plan-5030-20-sheet.tsx`:

```tsx
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import type { AllocationData } from "@/actions/allocation";

interface Plan5030Sheet20Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocation: AllocationData | null;
}

interface BucketRowProps {
  name: string;
  actual: { amount: number; percent: number };
  target: number;
  currency: AllocationData["currency"];
  variance: "over" | "near" | "under";
}

function BucketRow({ name, actual, target, currency, variance }: BucketRowProps) {
  const clampedPercent = Math.max(0, Math.min(100, actual.percent));
  const fillColor =
    variance === "over" ? "bg-z-expense" : variance === "near" ? "bg-z-brass" : "bg-z-income";
  const actualColor =
    variance === "over" ? "text-z-expense" : variance === "near" ? "text-z-brass" : "text-z-income";
  const markerLeft = Math.min(100, target);

  return (
    <div className="py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium">{name}</span>
        <div className="flex gap-2 text-[11px]">
          <span className="text-muted-foreground">Meta {target}%</span>
          <span className={cn("font-semibold", actualColor)}>
            Actual {Math.round(actual.percent)}%
          </span>
        </div>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={cn("h-full rounded-full", fillColor)}
          style={{ width: `${clampedPercent}%` }}
        />
        <div
          className="absolute inset-y-[-2px] w-0.5 bg-white/60"
          style={{ left: `${markerLeft}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {formatCurrency(actual.amount, currency)}
      </p>
    </div>
  );
}

export function Plan5030Sheet20({ open, onOpenChange, allocation }: Plan5030Sheet20Props) {
  if (!allocation) return null;

  // Variance rules:
  // - Necesario: over if >55, near if 45-55, under if <45
  // - Deseos: over if >35, near if 25-35, under if <25
  // - Ahorro: over if <15, near if 15-25, under if >25 → invert framing: "over" = worst case (too little saved)
  const needsVariance =
    allocation.needs.percent > 55 ? "over" : allocation.needs.percent >= 45 ? "near" : "under";
  const wantsVariance =
    allocation.wants.percent > 35 ? "over" : allocation.wants.percent >= 25 ? "near" : "under";
  const savingsVariance =
    allocation.savings.percent < 15 ? "over" : allocation.savings.percent <= 25 ? "near" : "under";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("rounded-t-2xl", MOBILE_TAB_BAR_CLEARANCE_CLASS)}
      >
        <SheetHeader>
          <SheetTitle>Distribución 50/30/20</SheetTitle>
          <SheetDescription>Cómo estás repartiendo tus gastos este mes</SheetDescription>
        </SheetHeader>
        <div className="mt-2 divide-y divide-white/5">
          <BucketRow
            name="Necesario"
            actual={allocation.needs}
            target={allocation.needs.target}
            currency={allocation.currency}
            variance={needsVariance}
          />
          <BucketRow
            name="Deseos"
            actual={allocation.wants}
            target={allocation.wants.target}
            currency={allocation.currency}
            variance={wantsVariance}
          />
          <BucketRow
            name="Ahorro"
            actual={allocation.savings}
            target={allocation.savings.target}
            currency={allocation.currency}
            variance={savingsVariance}
          />
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          50/30/20 es una guía, no una regla estricta.
        </p>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 7.2: Read `mobile-presupuesto.tsx` and identify the category list + `Necesario / Deseos` row**

```bash
cat webapp/src/components/mobile/mobile-presupuesto.tsx | head -200
```

Note the variables used for category list, percent-used computation, and the `Necesario X% · Deseos Y%` row location.

- [ ] **Step 7.3: Implement risk-state grouping (D6)**

Inside `mobile-presupuesto.tsx`, after categories are normalized and before rendering:

```ts
const outflow = categories.filter((c) => c.direction === "OUTFLOW" && (c.budget ?? 0) > 0);

const over = outflow
  .filter((c) => c.percentUsed > 100)
  .sort((a, b) => b.percentUsed - a.percentUsed);
const near = outflow
  .filter((c) => c.percentUsed >= 85 && c.percentUsed <= 100)
  .sort((a, b) => b.percentUsed - a.percentUsed);
const safe = outflow
  .filter((c) => c.percentUsed < 85)
  .sort((a, b) => a.percentUsed - b.percentUsed);
```

In the render, replace the flat category list with three grouped blocks (skip a group if empty):

```tsx
{over.length > 0 && (
  <section>
    <p className="mb-2 mt-4 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-z-expense">
      <span>Sobre límite</span>
      <span className="text-muted-foreground">{over.length}</span>
    </p>
    {over.map((c) => <CategoryRow key={c.id} category={c} tone="over" />)}
  </section>
)}
{near.length > 0 && (
  <section>
    <p className="mb-2 mt-4 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
      <span>Cerca del límite</span>
      <span className="text-muted-foreground">{near.length}</span>
    </p>
    {near.map((c) => <CategoryRow key={c.id} category={c} tone="near" />)}
  </section>
)}
{safe.length > 0 && (
  <section>
    <p className="mb-2 mt-4 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-z-income">
      <span>Dentro del límite</span>
      <span className="text-muted-foreground">{safe.length}</span>
    </p>
    {safe.map((c) => <CategoryRow key={c.id} category={c} tone="safe" />)}
  </section>
)}
```

If the file already has an inner `CategoryRow` component, extend its API with a `tone` prop that drives the progress-bar fill: `bg-z-expense` (over) / `bg-z-brass` (near) / `bg-z-income` (safe). Otherwise, inline equivalent JSX.

- [ ] **Step 7.4: Drop the ⚠ icon (D6)**

Remove the `<AlertTriangle />` (or equivalent) rendered on rows where `percentUsed > 100`. Color + group label already carry the signal.

- [ ] **Step 7.5: Wire the chip → sheet (D7)**

Locate the `Necesario X% · Deseos Y%` row. Convert it to a `<button>`:

```tsx
const [allocOpen, setAllocOpen] = useState(false);

// ...in JSX, replace the static Necesario/Deseos row with:
<button
  type="button"
  onClick={() => setAllocOpen(true)}
  className="flex w-full items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-left text-xs transition-colors active:bg-white/[0.04]"
  disabled={!allocation}
>
  <span>
    Necesario {Math.round(allocation?.needs.percent ?? 0)}% · Deseos{" "}
    {Math.round(allocation?.wants.percent ?? 0)}%
  </span>
  <span className="flex items-center gap-1 text-z-brass">
    50/30/20 <ArrowUpRight className="size-3" aria-hidden />
  </span>
</button>

<Plan5030Sheet20
  open={allocOpen}
  onOpenChange={setAllocOpen}
  allocation={allocation ?? null}
/>
```

Import `ArrowUpRight` from `lucide-react` and the sheet component from `./v2/plan/plan-5030-20-sheet`.

- [ ] **Step 7.6: Ensure the parent passes `allocation`**

`mobile-presupuesto.tsx` likely already receives `allocation` via `budget.allocation` from `PlanPageData.budget.allocation`. Confirm the prop is threaded from the page shell; if not, pass it through.

- [ ] **Step 7.7: Verify build + visual**

```bash
cd webapp && pnpm build
```

`/plan?tab=presupuesto`:
- Three groups rendered, correct counts.
- No `⚠` icons.
- `Necesario X% · Deseos Y%` chip has brass `50/30/20 ↗` on the right.
- Tap chip → sheet opens.
- Meta markers visible on each bar.
- Close on overlay tap.

- [ ] **Step 7.8: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-5030-20-sheet.tsx webapp/src/components/mobile/mobile-presupuesto.tsx
git commit -m "polish(plan): group presupuesto by risk + add 50/30/20 sheet

D6 + D7. Sheet consumes existing get503020Allocation data — no new action."
```

---

## Task 8: Retokenize `plan-budget-hero.tsx`

**File:**
- Modify: `webapp/src/components/mobile/v2/plan/plan-budget-hero.tsx`

- [ ] **Step 8.1: Scan for hardcoded colors**

```bash
grep -nE "emerald-[0-9]|red-[0-9]|green-[0-9]" webapp/src/components/mobile/v2/plan/plan-budget-hero.tsx
```

Expected: some matches on bar segments / status colors.

- [ ] **Step 8.2: Swap to tokens**

Replace:
- `emerald-500` → `z-income`
- `red-500` → `z-expense`
- `amber-*` → `z-brass` (case-by-case — only where the intent is "alert", not illustrative)
- Any `/80`, `/60`, etc. opacity suffixes — keep as is.

If any class usage is illustrative (not semantic), leave a brief comment or swap to the nearest neutral token.

- [ ] **Step 8.3: Verify build**

```bash
cd webapp && pnpm build
```

- [ ] **Step 8.4: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-budget-hero.tsx
git commit -m "chore(plan): retokenize plan-budget-hero colors

Aligns with z-income/z-expense/z-brass tokens from design system."
```

---

## Task 9: Playwright verification pass

- [ ] **Step 9.1: Start dev server if not running**

```bash
lsof -i :3000 -P -sTCP:LISTEN -t >/dev/null || (cd webapp && pnpm dev &)
```

Wait ~5s for server startup.

- [ ] **Step 9.2: Capture the 5 canonical screens**

Via Playwright MCP at 390×844:
1. `/plan` — NETO collapsed, chips ordered, drill chips populated.
2. `/plan` — NETO expanded (tap hero first).
3. `/plan?tab=periodo` — NETO elevated.
4. `/plan?tab=recurrentes` — templates strip visible, no double pager.
5. `/plan?tab=presupuesto` — groups rendered.
6. `/plan?tab=presupuesto` with sheet open (tap the `Necesario / Deseos` chip).

Save captures under `audit/2026-04-17/` with semantic filenames.

- [ ] **Step 9.3: Build gate**

```bash
cd webapp && pnpm build
```

Expected: green. No new warnings introduced by this PR (legacy `totalBudget` deprecation at `inicio-root.tsx:159` may still appear — pre-existing, not this PR's change).

- [ ] **Step 9.4: Commit captures**

```bash
git add audit/2026-04-17/
git commit -m "docs(audit): Plan polish phase 2 step 2 verification captures"
```

---

## Task 10: Review gate

The same layered pattern that worked on Dashboard Phase 2 (PR #169). Each layer surfaces non-overlapping findings; apply each as a separate commit.

- [ ] **Step 10.1: Parallel — zetas-front-guy + perf-auditor**

Spawn both agents in a single message. Each receives the diff scope and the spec path.

`zetas-front-guy`:
- Validate that D10 icons use brand-brass tokens correctly (requested explicitly by the user — see spec D10 "logo treatment").
- Scan for any remaining `emerald-*`, `red-*`, `amber-*` classes in the modified files.
- Check that `plan-5030-20-sheet.tsx` uses `SheetContent` with `MOBILE_TAB_BAR_CLEARANCE_CLASS`.

`perf-auditor`:
- Confirm the new `overdueCount` query in `getPlanPageData` is cached (`"use cache"` + `cacheTag("plan")`).
- Check for any new uncached DB reads on render paths.
- Review that `plan-drill-cards.tsx` remains a Server Component (or properly marked Client Component) without unnecessary client bundles.

Apply findings as a single `fix(plan): apply zetas-front-guy + perf-auditor feedback` commit.

- [ ] **Step 10.2: Push + wait for Gemini bot review**

```bash
git push -u origin feat/plan-page-polish
gh pr create --title "feat(plan): page polish — NETO, chips, templates, presupuesto grouping" \
  --body "$(cat <<'EOF'
## Summary
- NETO hero color-coded (D1) + expand cue brightened (D8)
- Próximo chips ordered by soonest date (D2)
- IR A drill chips redesigned with brand brass logos (D10)
- Periodo NETO elevated to hero (D3)
- Recurrentes templates promoted + inner month pager removed (D4)
- Presupuesto grouped by risk state (D6) + 50/30/20 sheet (D7)

## Spec
`docs/superpowers/specs/2026-04-17-plan-page-polish-design.md`

## Test plan
- [x] `pnpm build` clean
- [x] Playwright captures at 390×844 (see `audit/2026-04-17/`)
- [x] zetas-front-guy — token compliance
- [x] perf-auditor — cache discipline
- [ ] Gemini review pending
- [ ] frontend-auditor + ux-analyst pending
- [ ] /simplify pending

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Wait 2 minutes, then `gh pr view --comments` to see Gemini's review. Apply any valid findings as `fix(plan): address Gemini review`.

- [ ] **Step 10.3: Parallel — frontend-auditor + ux-analyst**

Spawn both, parallel:

`frontend-auditor`:
- Full design-system audit on the touched files.
- Check a11y of the new `<button>` in D7 (has `aria-label` if icon-only, sheet has proper aria).
- Check responsive behavior on 320w and 414w.

`ux-analyst`:
- Evaluate overall Plan cohesion post-changes.
- Confirm the "shape of the month" framing lands at first viewport.
- Spot any remaining density / hierarchy drift.

Apply findings as `fix(plan): apply frontend-auditor + ux-analyst feedback`.

- [ ] **Step 10.4: Run `/simplify`**

Invoke the `/simplify` skill on the branch. Focus areas:
- Reuse: are any new helpers duplicating existing utilities? (`formatDate`, `formatCurrency` — confirm consistent use.)
- Quality: any early returns missed, any effect/deps cleanup needed?
- Efficiency: drill-chip captions pure; `Plan5030Sheet20` returns null when `allocation` is null (no wasted Sheet mount).

Apply findings as `refactor(plan): apply /simplify review`.

- [ ] **Step 10.5: Final build + final commit**

```bash
cd webapp && pnpm build
```

Expected: green. PR ready to merge.

---

## Success criteria (from spec)

- `/plan` root first viewport (390×844): NETO hero + Próximo chips + first chip link row all visible without scroll. ✅
- NETO number color-coded and ≥ 28px in the collapsed hero. ✅
- Expand cue legible on the first glance. ✅
- Periodo NETO anchors the screen; no user scans a stat row to find the sign. ✅
- Recurrentes `Mis plantillas` visible in the first viewport. ✅
- Presupuesto never renders a wall of red — grouping separates actionable from safe. ✅
- 50/30/20 sheet opens on a single tap from Presupuesto. ✅
- `pnpm build` passes; `zetas-front-guy` reports zero token violations. ✅
- Icons use brand brass tokens (user-requested, verified by `zetas-front-guy`). ✅
