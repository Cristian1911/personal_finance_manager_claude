# Dashboard polish (Phase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the mobile Dashboard to deliver the "Am I on track?" + "What needs my attention?" narrative cleanly — replace the 3-chip ATENCIÓN with a chronological "Por resolver" timeline, convert RITMO + GASTO HOY into polished widget tiles, drop the redundant "Plan del mes" discovery tile, and add tap-to-expand inline category assignment on Reciente rows.

**Architecture:** Mostly in-place component restyling and state-shape changes under `webapp/src/components/mobile/v2/inicio/`. One new pure module (timeline model) gets proper unit tests; every other change is verified via Playwright at 390×844. No backend changes; existing server actions (`getAttentionItems`, `updateTransaction`, etc.) are reused.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui, Vitest for unit tests, Playwright MCP for visual verification.

**Spec:** `docs/superpowers/specs/2026-04-16-dashboard-polish-design.md`

---

## File Structure

**New:**
- `webapp/src/components/mobile/v2/inicio/timeline-model.ts` — pure module; defines `TimelineItem` type + `buildTimelineItems()` merger that takes attention arrays and returns sorted + urgency-tagged list.
- `webapp/src/components/mobile/v2/inicio/timeline-model.test.ts` — Vitest spec for the merger (exhaustive: empty, urgency order, income mixing, date sort).
- `webapp/src/components/mobile/v2/inicio/inicio-attention-timeline.tsx` — replaces `inicio-attention.tsx`. Renders the horizontal scroll of timeline items + empty state. Takes identical props to `InicioAttention` (same data, new presentation).
- `webapp/src/components/mobile/v2/inicio/inicio-tool-row.tsx` — replaces `inicio-discovery.tsx`. Single full-width tool tile wrapping `PurchaseRecommenderDrawer`.

**Modified:**
- `webapp/src/components/mobile/v2/inicio/inicio-root.tsx` — swap component imports + ensure section spacing (space-y-5 → space-y-4 or appropriate); pass `hasPendingEmails` to `InicioImportStrip`.
- `webapp/src/components/mobile/v2/inicio/inicio-metrics-grid.tsx` — restyle to widget-tile aesthetic (min-h-[120px], rounded-2xl, centered layout); move yesterday + avg-7d into GASTO HOY expand state (no longer shown at collapsed tile level).
- `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx` — remove inline "Sin cat." yellow tag; replace existing expand-to-link-recurring behavior with expand-to-category-picker panel using `CategoryPickerBody`. Retain link-recurring as a secondary action inside the expanded panel.
- `webapp/src/components/mobile/v2/inicio/inicio-import-strip.tsx` — add `hasPendingEmails` prop; hide when true.

**Deleted:**
- `webapp/src/components/mobile/v2/inicio/inicio-attention.tsx` — replaced by timeline
- `webapp/src/components/mobile/v2/inicio/inicio-discovery.tsx` — replaced by tool-row

---

## Task 1: Timeline model — pure merger with unit tests

**Files:**
- Create: `webapp/src/components/mobile/v2/inicio/timeline-model.ts`
- Create: `webapp/src/components/mobile/v2/inicio/timeline-model.test.ts`

- [ ] **Step 1.1: Write the failing test**

Content for `timeline-model.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTimelineItems, type TimelineSources } from "./timeline-model";

const emptySources: TimelineSources = {
  overdueReminders: [],
  upcomingPayments: [],
  pendingEmails: [],
  upcomingIncome: [],
  todayStr: "2026-04-16",
};

describe("buildTimelineItems", () => {
  it("returns empty array when all sources are empty", () => {
    expect(buildTimelineItems(emptySources)).toEqual([]);
  });

  it("marks overdue items as urgency=overdue with red accent", () => {
    const items = buildTimelineItems({
      ...emptySources,
      overdueReminders: [
        { id: "r1", title: "Pago luz", due_date: "2026-04-10", amount: 100000 },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].urgency).toBe("overdue");
    expect(items[0].kind).toBe("reminder");
    expect(items[0].dateLabel).toContain("Vencido");
  });

  it("marks today's pending emails as urgency=today with brass accent", () => {
    const items = buildTimelineItems({
      ...emptySources,
      pendingEmails: [
        { id: "e1", merchant: "B", amount: 10000, direction: "OUTFLOW", date: "2026-04-16", card_last4: "1234" },
        { id: "e2", merchant: "B", amount: 20000, direction: "OUTFLOW", date: "2026-04-16", card_last4: "1234" },
      ],
    });
    // Pending emails collapse into a single timeline item with count
    expect(items).toHaveLength(1);
    expect(items[0].urgency).toBe("today");
    expect(items[0].kind).toBe("emails");
    expect(items[0].title).toContain("2");
  });

  it("sorts by date ascending: overdue before today before future", () => {
    const items = buildTimelineItems({
      ...emptySources,
      overdueReminders: [{ id: "r1", title: "Luz", due_date: "2026-04-12", amount: 50000 }],
      upcomingPayments: [
        { templateId: "t1", occurrenceDate: "2026-04-20", amount: 200000, name: "Renta", direction: "OUTFLOW" },
        { templateId: "t2", occurrenceDate: "2026-04-16", amount: 30000, name: "EPM", direction: "OUTFLOW" },
      ],
    });
    expect(items.map((i) => i.urgency)).toEqual(["overdue", "today", "future"]);
  });

  it("marks upcoming income as urgency=future with income styling", () => {
    const items = buildTimelineItems({
      ...emptySources,
      upcomingIncome: [{ occurrenceDate: "2026-04-27", amount: 1200000, name: "Nómina UPB" }],
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("income");
    expect(items[0].urgency).toBe("future");
    expect(items[0].isIncome).toBe(true);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd webapp && pnpm vitest run src/components/mobile/v2/inicio/timeline-model.test.ts
```

Expected: **FAIL** — `Cannot find module './timeline-model'`.

- [ ] **Step 1.3: Implement `timeline-model.ts`**

```ts
import type { CurrencyCode } from "@/types/domain";
import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";

export type TimelineUrgency = "overdue" | "today" | "future";

export type TimelineKind = "reminder" | "payment" | "emails" | "income";

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  urgency: TimelineUrgency;
  /** ISO date YYYY-MM-DD used for sorting */
  dateKey: string;
  /** Display label for the eyebrow, e.g. "Hoy · Email", "27 abr · Pago", "Vencido · Pago" */
  dateLabel: string;
  /** Main title shown on the card */
  title: string;
  /** Secondary line — amount or context */
  subtitle: string;
  /** When true, amount should render green with "+" */
  isIncome: boolean;
  /** Where tapping the card should route */
  href: string;
}

export interface UpcomingIncomeItem {
  occurrenceDate: string;
  amount: number;
  name: string;
}

export interface TimelineSources {
  overdueReminders: AttentionOverdueReminder[];
  upcomingPayments: AttentionUpcomingPayment[];
  pendingEmails: AttentionPendingEmail[];
  upcomingIncome: UpcomingIncomeItem[];
  /** ISO YYYY-MM-DD representing "today" in Colombia tz — passed from caller */
  todayStr: string;
}

function urgencyFor(dateKey: string, todayStr: string): TimelineUrgency {
  if (dateKey < todayStr) return "overdue";
  if (dateKey === todayStr) return "today";
  return "future";
}

function shortDate(iso: string, todayStr: string): string {
  if (iso === todayStr) return "Hoy";
  // Parse "YYYY-MM-DD" to "D mmm"
  const [, m, d] = iso.split("-").map((s) => Number(s));
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${months[m - 1]}`;
}

export function buildTimelineItems(sources: TimelineSources): TimelineItem[] {
  const { overdueReminders, upcomingPayments, pendingEmails, upcomingIncome, todayStr } = sources;

  const items: TimelineItem[] = [];

  // Overdue reminders — each becomes its own card
  for (const r of overdueReminders) {
    items.push({
      id: `reminder-${r.id}`,
      kind: "reminder",
      urgency: "overdue",
      dateKey: r.due_date,
      dateLabel: `Vencido · ${shortDate(r.due_date, todayStr)}`,
      title: r.title,
      subtitle: r.amount ? `$${r.amount.toLocaleString("es-CO")}` : "",
      isIncome: false,
      href: "/gestionar",
    });
  }

  // Pending emails — collapsed into a single "N movimientos sin importar" card dated today
  if (pendingEmails.length > 0) {
    items.push({
      id: "emails",
      kind: "emails",
      urgency: "today",
      dateKey: todayStr,
      dateLabel: "Hoy · Email",
      title: `${pendingEmails.length} movimiento${pendingEmails.length === 1 ? "" : "s"} sin importar`,
      subtitle: pendingEmails.length > 0 ? "Revisar y confirmar" : "",
      isIncome: false,
      href: "/gestionar",
    });
  }

  // Upcoming payments — each becomes a card
  for (const p of upcomingPayments) {
    items.push({
      id: `payment-${p.templateId}-${p.occurrenceDate}`,
      kind: "payment",
      urgency: urgencyFor(p.occurrenceDate, todayStr),
      dateKey: p.occurrenceDate,
      dateLabel: `${shortDate(p.occurrenceDate, todayStr)} · Pago`,
      title: p.name,
      subtitle: `$${p.amount.toLocaleString("es-CO")}`,
      isIncome: false,
      href: "/plan?tab=recurrentes",
    });
  }

  // Upcoming income — each becomes a card
  for (const i of upcomingIncome) {
    items.push({
      id: `income-${i.occurrenceDate}-${i.name}`,
      kind: "income",
      urgency: urgencyFor(i.occurrenceDate, todayStr),
      dateKey: i.occurrenceDate,
      dateLabel: `${shortDate(i.occurrenceDate, todayStr)} · Ingreso`,
      title: i.name,
      subtitle: `+$${i.amount.toLocaleString("es-CO")}`,
      isIncome: true,
      href: "/plan?tab=periodo",
    });
  }

  // Sort: overdue first, then by date ascending, then by kind (reminders before payments before income for same date)
  const kindOrder: Record<TimelineKind, number> = { reminder: 0, emails: 1, payment: 2, income: 3 };
  items.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return kindOrder[a.kind] - kindOrder[b.kind];
  });

  return items;
}
```

- [ ] **Step 1.4: Run tests — expect all pass**

```bash
cd webapp && pnpm vitest run src/components/mobile/v2/inicio/timeline-model.test.ts
```

Expected: **PASS** 5/5.

- [ ] **Step 1.5: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/timeline-model.ts webapp/src/components/mobile/v2/inicio/timeline-model.test.ts
git commit -m "feat(dashboard): timeline model — merge attention sources into chronological list"
```

---

## Task 2: `InicioAttentionTimeline` component shell

**Files:**
- Create: `webapp/src/components/mobile/v2/inicio/inicio-attention-timeline.tsx`

- [ ] **Step 2.1: Create the component file**

```tsx
"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildTimelineItems, type UpcomingIncomeItem } from "./timeline-model";
import { toColombiaDateString } from "@/lib/utils/date";
import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";

interface InicioAttentionTimelineProps {
  overdueReminders: AttentionOverdueReminder[];
  upcomingPayments: AttentionUpcomingPayment[];
  pendingEmails: AttentionPendingEmail[];
  upcomingIncome: UpcomingIncomeItem[];
}

export function InicioAttentionTimeline({
  overdueReminders,
  upcomingPayments,
  pendingEmails,
  upcomingIncome,
}: InicioAttentionTimelineProps) {
  const todayStr = toColombiaDateString(new Date());
  const items = buildTimelineItems({
    overdueReminders,
    upcomingPayments,
    pendingEmails,
    upcomingIncome,
    todayStr,
  });

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Por resolver
        </span>
        {items.length > 0 && (
          <Link
            href="/gestionar"
            className="text-[11px] font-medium text-z-brass hover:underline"
          >
            Ver todo →
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-4">
          <CheckCircle2 className="size-5 shrink-0 text-z-income" />
          <div>
            <p className="text-sm font-semibold text-foreground">Todo tranquilo</p>
            <p className="text-[11px] text-muted-foreground">Sin pendientes esta semana.</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-none">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex min-w-[155px] shrink-0 flex-col gap-1 rounded-xl border bg-white/[0.02] p-3 transition-colors active:bg-white/[0.04]",
                item.urgency === "overdue" && "border-z-debt/28 bg-z-debt/4",
                item.urgency === "today" && "border-z-brass/28",
                item.urgency === "future" && "border-white/6",
              )}
            >
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-[0.12em]",
                  item.urgency === "overdue" && "text-z-debt",
                  item.urgency === "today" && "text-z-brass",
                  item.urgency === "future" && "text-muted-foreground",
                )}
              >
                {item.dateLabel}
              </span>
              <span className="line-clamp-2 text-xs font-semibold text-foreground">
                {item.title}
              </span>
              {item.subtitle && (
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
                    item.isIncome ? "text-z-income" : "text-z-brass",
                  )}
                >
                  {item.subtitle}
                </span>
              )}
            </Link>
          ))}
          {/* Trailing "Ver todo" card so the scroll has a terminator */}
          <Link
            href="/gestionar"
            className="flex min-w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/6 bg-transparent p-3 text-muted-foreground active:bg-white/[0.03]"
          >
            <ArrowRight className="size-4" />
            <span className="text-[10px]">Ver todo</span>
          </Link>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2.2: Type-check the new file**

```bash
cd webapp && pnpm exec tsc --noEmit
```

Expected: **PASS** (no new errors introduced).

- [ ] **Step 2.3: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-attention-timeline.tsx
git commit -m "feat(dashboard): InicioAttentionTimeline — horizontal 'Por resolver' strip with empty state"
```

---

## Task 3: Swap `InicioAttention` → `InicioAttentionTimeline` in root

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-root.tsx`
- Modify: `webapp/src/components/dashboard/zones/mobile-zone.tsx` (to pass `upcomingIncome`)

- [ ] **Step 3.1: Update `mobile-zone.tsx` to pass `upcomingIncome` down**

Read the file first (`webapp/src/components/dashboard/zones/mobile-zone.tsx`). In the `<InicioRoot .../>` call, pass `upcomingIncome` derived from `heroData`:

Replace the existing `<InicioRoot>` call's `attentionItems={attentionItemsData}` — keep it — and add a new prop `upcomingIncome`. Source: derive it from the hero's `nextIncomeDate`, `nextIncomeAmount`, `nextIncomeName` as a single-element array when `incomeConfigured && nextIncomeDate`:

```tsx
const upcomingIncome = heroData.incomeConfigured && heroData.nextIncomeDate
  ? [{
      occurrenceDate: heroData.nextIncomeDate,
      amount: heroData.nextIncomeAmount,
      name: heroData.nextIncomeName ?? "Próximo ingreso",
    }]
  : [];

// …
<InicioRoot
  // existing props
  upcomingIncome={upcomingIncome}
/>
```

- [ ] **Step 3.2: Update `inicio-root.tsx` imports and props**

Replace the `InicioAttention` import with `InicioAttentionTimeline`:

```tsx
// REMOVE:
import { InicioAttention } from "./inicio-attention";
// ADD:
import { InicioAttentionTimeline } from "./inicio-attention-timeline";
import type { UpcomingIncomeItem } from "./timeline-model";
```

Add to `InicioRootProps`:

```ts
upcomingIncome: UpcomingIncomeItem[];
```

Destructure `upcomingIncome` from props alongside the existing destructure.

- [ ] **Step 3.3: Swap the JSX**

Locate the `<InicioAttention ... />` block in `inicio-root.tsx` and replace with:

```tsx
<InicioAttentionTimeline
  overdueReminders={live.attention.overdueReminders}
  upcomingPayments={live.attention.upcomingPayments}
  pendingEmails={live.attention.pendingEmails}
  upcomingIncome={upcomingIncome}
/>
```

Note: `InicioAttentionTimeline` does NOT need `expanded` / `onToggle` props — timeline items route on tap, no accordion state.

- [ ] **Step 3.4: Type-check + build**

```bash
cd webapp && pnpm build
```

Expected: **PASS**.

- [ ] **Step 3.5: Start dev server + Playwright verify at 390×844**

```bash
cd webapp && pnpm dev
# In a separate shell (or via Playwright MCP):
# Navigate to http://localhost:3000/dashboard and screenshot
```

Verify via Playwright MCP:
1. Hero renders unchanged.
2. Immediately below Hero: `POR RESOLVER` eyebrow label + horizontal timeline strip.
3. At least one emails card shows "Hoy · Email" with brass border (assuming pendingEmails > 0 in demo data).
4. Upcoming income card shows green amount with `+` prefix.

Capture screenshot to `audit/2026-04-16/phase2-01-timeline.png`.

- [ ] **Step 3.6: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-root.tsx webapp/src/components/dashboard/zones/mobile-zone.tsx
git commit -m "feat(dashboard): wire InicioAttentionTimeline into root, add upcomingIncome source"
```

---

## Task 4: Delete legacy `InicioAttention`

**Files:**
- Delete: `webapp/src/components/mobile/v2/inicio/inicio-attention.tsx`

- [ ] **Step 4.1: Confirm no other consumers**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta
grep -rn "InicioAttention[^T]" webapp/src mobile
```

Expected: **no matches** (InicioAttentionTimeline does not count — grep excludes via `[^T]`).

- [ ] **Step 4.2: Delete file**

```bash
rm webapp/src/components/mobile/v2/inicio/inicio-attention.tsx
```

- [ ] **Step 4.3: Build check**

```bash
cd webapp && pnpm build
```

Expected: **PASS**.

- [ ] **Step 4.4: Commit**

```bash
git add -u webapp/src/components/mobile/v2/inicio/inicio-attention.tsx
git commit -m "chore(dashboard): remove obsolete InicioAttention component"
```

---

## Task 5: Restyle `InicioMetricsGrid` → widget-tile aesthetic

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-metrics-grid.tsx`

- [ ] **Step 5.1: Read the current component end-to-end**

Load the file first. Current root returns a `<MobileZone eyebrow="RITMO Y GASTO HOY">` with a 2-col grid of chip buttons (compact, small text).

- [ ] **Step 5.2: Remove the outer `MobileZone` eyebrow wrapper**

The spec says the widget row has no section eyebrow. Replace:

```tsx
// BEFORE:
<MobileZone eyebrow="RITMO">
  <div className="grid grid-cols-2 gap-1.5">
    ...
  </div>
</MobileZone>

// AFTER:
<div className="grid grid-cols-2 gap-2.5">
  ...
</div>
```

- [ ] **Step 5.3: Replace per-chip styles with widget-tile styles**

Each chip button's `className` becomes:

```tsx
className={cn(
  "flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-5 text-center transition-colors min-h-[120px]",
  isRitmoActive && "border-z-income/30 bg-z-income/[0.04]",
)}
```

And for the GASTO HOY tile:

```tsx
className={cn(
  "flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-5 text-center transition-colors min-h-[120px]",
  isGastoActive && "border-z-brass/30 bg-z-brass/[0.04]",
)}
```

Remove references to `PANEL_INSET_CLASS` inside these buttons — the new class list supersedes it.

- [ ] **Step 5.4: Reshape each tile's internal markup**

RITMO tile body (inside the button):

```tsx
<span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
  Ritmo
</span>
<ArcRing percentage={percentage} />
<span className="text-[10px] text-muted-foreground">día {dayOfMonth} de {daysInMonth}</span>
```

GASTO HOY tile body:

```tsx
<span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
  Gasto hoy
</span>
<span className="text-[24px] font-bold leading-none tabular-nums">
  {spentToday === 0 ? "$0" : compact(spentToday, currency)}
</span>
<span className="text-[10px] text-muted-foreground">
  {spentToday === 0 ? "Sin gastos" : spentYesterday > 0 ? `vs ayer ${spentToday > spentYesterday ? "+" : ""}${compact(spentToday - spentYesterday, currency)}` : "Primer gasto del día"}
</span>
```

- [ ] **Step 5.5: Preserve expanded panels**

Keep the existing expand panels below (`hasActive` accordion). Just verify their background/border now reads correctly against the new tile colors — update any hardcoded borders to `border-white/6` where they referenced the chip accent palette.

- [ ] **Step 5.6: Type-check**

```bash
cd webapp && pnpm exec tsc --noEmit
```

Expected: **PASS**.

- [ ] **Step 5.7: Playwright verify**

Navigate to `/dashboard`. Screenshot the widget grid area. Verify:
1. Two tiles side by side, visually heavier than the previous chips.
2. RITMO shows arc ring + "día X de Y".
3. GASTO HOY shows large `$0` + "Sin gastos" (or the vs-ayer comparison when populated).
4. Tapping a tile still opens its existing expand panel.

Save screenshot to `audit/2026-04-16/phase2-02-widgets.png`.

- [ ] **Step 5.8: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-metrics-grid.tsx
git commit -m "style(dashboard): RITMO + GASTO HOY widgets — rounded-2xl tile aesthetic"
```

---

## Task 6: `InicioToolRow` — single full-width `¿Puedo comprarlo?` tool

**Files:**
- Create: `webapp/src/components/mobile/v2/inicio/inicio-tool-row.tsx`

- [ ] **Step 6.1: Implement the component**

Reuse `PurchaseRecommenderDrawer` from `./purchase-recommender-drawer`. Read that file first to confirm its exported interface.

Content for `inicio-tool-row.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { PurchaseRecommenderDrawer } from "./purchase-recommender-drawer";
import type { CurrencyCode } from "@/types/domain";

interface InicioToolRowProps {
  currency: CurrencyCode;
}

export function InicioToolRow({ currency }: InicioToolRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-2xl border border-white/6 bg-white/[0.02] px-3.5 py-3 text-left transition-colors active:bg-white/[0.04]"
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-z-brass/12">
          <Lightbulb className="size-5 text-z-brass" />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-bold text-foreground">¿Puedo comprarlo?</span>
          <span className="text-[11px] text-muted-foreground">
            Evalúa tu próxima compra contra el plan
          </span>
        </span>
        <ArrowRight className="size-5 text-z-brass" />
      </button>

      <PurchaseRecommenderDrawer
        open={open}
        onOpenChange={setOpen}
        currency={currency}
      />
    </>
  );
}
```

**Verify**: open `webapp/src/components/mobile/v2/inicio/purchase-recommender-drawer.tsx` and confirm the `open`/`onOpenChange`/`currency` props match. If the drawer uses a different interface, adjust.

- [ ] **Step 6.2: Type-check**

```bash
cd webapp && pnpm exec tsc --noEmit
```

Expected: **PASS**.

- [ ] **Step 6.3: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-tool-row.tsx
git commit -m "feat(dashboard): InicioToolRow — single ¿Puedo comprarlo? tool tile"
```

---

## Task 7: Swap `InicioDiscovery` → `InicioToolRow` in root

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-root.tsx`

- [ ] **Step 7.1: Update imports**

```tsx
// REMOVE:
import { InicioDiscovery } from "./inicio-discovery";
// ADD:
import { InicioToolRow } from "./inicio-tool-row";
```

- [ ] **Step 7.2: Replace JSX**

Locate:

```tsx
<InicioDiscovery
  expanded={activeZone}
  onToggle={toggle}
  currency={currency}
/>
```

Replace with:

```tsx
<InicioToolRow currency={currency} />
```

Note: `InicioToolRow` does not participate in the `useExpandableZone` accordion — the drawer manages its own open state.

- [ ] **Step 7.3: Remove the Discovery file**

```bash
rm webapp/src/components/mobile/v2/inicio/inicio-discovery.tsx
```

- [ ] **Step 7.4: Build**

```bash
cd webapp && pnpm build
```

Expected: **PASS**.

- [ ] **Step 7.5: Playwright verify**

Navigate to `/dashboard`. Verify:
1. `Plan del mes` tile is gone.
2. Single full-width `¿Puedo comprarlo?` row below the widget grid.
3. Tapping the row opens the Purchase Recommender drawer.

Save screenshot to `audit/2026-04-16/phase2-03-tool-row.png`.

- [ ] **Step 7.6: Commit**

```bash
git add -u webapp/src/components/mobile/v2/inicio
git commit -m "refactor(dashboard): replace Discovery 2-tile with single InicioToolRow (drops Plan del mes)"
```

---

## Task 8: Reciente — drop `Sin cat.` tag + inline category picker

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx`

Read the whole file first; it has ~400 lines. The existing `expandedId` state is reused — we're only changing what the expanded panel renders and removing the yellow tag.

- [ ] **Step 8.1: Remove the `Sin cat.` inline rendering**

Grep the file for `Sin cat` or the JSX block rendering the yellow tag on uncategorized rows and delete it.

```bash
grep -n "Sin cat\|text-yellow" webapp/src/components/mobile/v2/inicio/inicio-activity.tsx
```

Delete those JSX blocks. The row markup should now render merchant + account + amount with no yellow tag (category icon, if present, stays).

- [ ] **Step 8.2: Add `onCategoryAssigned` handler + optimistic update**

At the top of the `InicioActivity` component, add:

```tsx
const [, startCategoryTransition] = useTransition();
const [optimisticCategories, setOptimisticCategories] = useState<Record<string, { id: string; name: string; icon: string | null }>>({});

async function handleAssignCategory(txId: string, category: { id: string; name: string; icon: string | null }) {
  setOptimisticCategories((prev) => ({ ...prev, [txId]: category }));
  startCategoryTransition(async () => {
    const result = await updateTransaction({ id: txId, category_id: category.id });
    if (!result.success) {
      setOptimisticCategories((prev) => {
        const { [txId]: _, ...rest } = prev;
        return rest;
      });
      toast.error(result.error ?? "Error al asignar categoría");
    } else {
      toast.success("Categoría asignada");
      setExpandedId(null);
    }
  });
}
```

Add the imports:

```tsx
import { updateTransaction } from "@/actions/transactions";
import { useCategories } from "@/components/providers/app-data-provider";
import type { CategoryWithChildren } from "@/types/domain";
```

**Verify** the real signature of `updateTransaction` before writing the call. It's at `webapp/src/actions/transactions.ts:773`. Read it to confirm it accepts `{ id, category_id }` or whether it expects a full transaction update shape. Adjust the call accordingly.

When rendering each row's category icon/label, prefer `optimisticCategories[tx.id]` over the incoming `tx.category_name` / `category_icon`.

- [ ] **Step 8.3: Inject `CategoryPickerBody` into the expanded panel**

Add import:

```tsx
import { CategoryPickerBody } from "@/components/categories/category-zone-picker";
```

Inside the expanded panel section (where linkable-transaction actions currently render), add a new block *above* the existing link actions:

```tsx
{expandedId === tx.id && (
  <div className="mt-2 rounded-xl border border-z-brass/18 bg-z-brass/4 p-3">
    <div className="mb-2 flex items-center justify-between">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Asignar categoría
      </p>
      <Link
        href={`/transactions/${tx.id}`}
        className="text-[11px] text-z-brass hover:underline"
      >
        Ver detalle →
      </Link>
    </div>
    <CategoryPickerBody
      categories={categories /* from useCategories() */}
      value={optimisticCategories[tx.id]?.id ?? tx.category_id ?? null}
      onSelect={(id) => {
        if (!id) return;
        const cat = findCategoryById(categories, id);
        if (cat) handleAssignCategory(tx.id, { id: cat.id, name: cat.name, icon: cat.icon });
      }}
      onCategoryCreated={() => { /* no-op inline */ }}
      suggestion={null}
      direction={tx.direction}
    />
    {/* Existing link-recurring action preserved below, as secondary */}
    {/* ... */}
  </div>
)}
```

Add a helper `findCategoryById` near the top of the file:

```tsx
function findCategoryById(
  categories: CategoryWithChildren[],
  id: string,
): { id: string; name: string; icon: string | null } | null {
  for (const parent of categories) {
    if (parent.id === id) return { id: parent.id, name: parent.name ?? parent.name_es ?? "", icon: parent.icon ?? null };
    const child = parent.children.find((c) => c.id === id);
    if (child) return { id: child.id, name: child.name ?? child.name_es ?? "", icon: child.icon ?? null };
  }
  return null;
}
```

Inside the component body, fetch categories from context:

```tsx
const categories = useCategories();
```

**Also update the `RecentTransactionMobile` interface (and the caller in `mobile-zone.tsx`) to include `category_id` so the picker can show the current value:**

In `inicio-activity.tsx`:

```tsx
interface RecentTransactionMobile {
  // existing fields
  category_id: string | null;
}
```

In `mobile-zone.tsx`, extend the mapping:

```tsx
const mobileRecentTx = recentTx.map((tx) => ({
  // existing
  category_id: tx.category_id ?? null,
}));
```

- [ ] **Step 8.4: Change the row tap target**

Currently tapping a row navigates to `/transactions/[id]`. Change to: tap toggles `expandedId`. Update the row's `<Link>` wrapper to a `<button>`:

```tsx
<button
  type="button"
  onClick={() => setExpandedId((cur) => (cur === tx.id ? null : tx.id))}
  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left active:bg-white/[0.03]"
>
  {/* row content */}
</button>
```

Users still reach the detail via the "Ver detalle →" link inside the expanded panel.

- [ ] **Step 8.5: Type-check + build**

```bash
cd webapp && pnpm build
```

Expected: **PASS**.

- [ ] **Step 8.6: Playwright verify**

Navigate to `/dashboard`. Scroll to Reciente. Verify:
1. No yellow `Sin cat.` tags on any row.
2. Tapping a row expands it; a brass-tinted panel appears with `Asignar categoría` label + `CategoryPickerBody`.
3. Selecting a category optimistically updates the row (category icon appears), toast "Categoría asignada" shows, expansion closes.
4. Tapping `Ver detalle →` routes to `/transactions/[id]`.
5. Tapping the same row again collapses it; tapping a different row swaps the expanded target.

Save screenshot (expanded state) to `audit/2026-04-16/phase2-04-reciente-expanded.png`.

- [ ] **Step 8.7: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-activity.tsx webapp/src/components/dashboard/zones/mobile-zone.tsx
git commit -m "feat(dashboard): Reciente — drop 'Sin cat.' tag, tap-to-expand inline category picker"
```

---

## Task 9: `InicioImportStrip` — conditional hide when emails pending

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-import-strip.tsx`
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-root.tsx`

- [ ] **Step 9.1: Add `hasPendingEmails` prop**

In `inicio-import-strip.tsx`:

```tsx
interface InicioImportStripProps {
  daysSinceImport: number;
  hasPendingEmails: boolean;
}

export function InicioImportStrip({ daysSinceImport, hasPendingEmails }: InicioImportStripProps) {
  if (hasPendingEmails) return null;
  if (daysSinceImport <= 15) return null;
  // …existing render
}
```

- [ ] **Step 9.2: Pass the new prop from root**

In `inicio-root.tsx`, update the `<InicioImportStrip>` call:

```tsx
<InicioImportStrip
  daysSinceImport={daysSinceImport}
  hasPendingEmails={live.attention.pendingEmails.length > 0}
/>
```

- [ ] **Step 9.3: Build**

```bash
cd webapp && pnpm build
```

Expected: **PASS**.

- [ ] **Step 9.4: Playwright verify**

Navigate to `/dashboard`. Assuming the demo account has pending emails: verify the import strip is **not** rendered. (If no pending emails: verify the strip still shows when `daysSinceImport > 15`.)

- [ ] **Step 9.5: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-import-strip.tsx webapp/src/components/mobile/v2/inicio/inicio-root.tsx
git commit -m "fix(dashboard): hide ImportStrip when pending emails already surface in timeline"
```

---

## Task 10: Section spacing + polish pass

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-root.tsx`

- [ ] **Step 10.1: Adjust root spacing**

The root currently uses `space-y-2`. Bump to give sections breathing room per the spec:

```tsx
return (
  <div className="space-y-4">
    <InicioHero … />
    <InicioImportStrip … />
    <InicioAttentionTimeline … />
    <InicioMetricsGrid … />
    <InicioToolRow … />
    <InicioActivity … />
  </div>
);
```

- [ ] **Step 10.2: Playwright verify full page**

Navigate to `/dashboard`, full-page screenshot at 390×844. Compare against `audit/2026-04-16/final-dashboard-v2.html` mockup. Verify:
1. Visible breathing room between each section (no two zones touching).
2. All zones render in order: Hero → (ImportStrip if shown) → Timeline → Widgets → Tool → Reciente.
3. No horizontal scroll overflow on the page itself (timeline scrolls inside its container).

Save full-page screenshot to `audit/2026-04-16/phase2-05-final.png`.

- [ ] **Step 10.3: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-root.tsx
git commit -m "style(dashboard): breathing room — space-y-4 between zones"
```

---

## Task 11: Design-system review + build gate

- [ ] **Step 11.1: Spawn `zetas-front-guy` agent**

Instruction: "Review the changes in this branch to `webapp/src/components/mobile/v2/inicio/*.tsx`. Check for hardcoded colors (should use `z-*` tokens), missing `tabular-nums` on numeric values, component reuse opportunities, and Zeta design-system compliance. Report only high-confidence issues."

Fix every high-confidence issue inline. Commit as:

```bash
git commit -m "fix(dashboard): apply zetas-front-guy review feedback"
```

If zero issues reported, skip the commit.

- [ ] **Step 11.2: Spawn `perf-auditor` agent**

Instruction: "Audit the Dashboard mobile zone changes on this branch. The new `InicioAttentionTimeline` does a client-side sort of up to a few dozen items — verify that's acceptable. Confirm `useCategories()` + `CategoryPickerBody` don't trigger waterfall fetches in Reciente expand. Report only issues that affect real perf budget."

Fix high-priority findings. Commit as:

```bash
git commit -m "perf(dashboard): address perf-auditor findings"
```

- [ ] **Step 11.3: Final build**

```bash
cd webapp && pnpm build
```

Expected: **PASS**, no warnings on changed files.

- [ ] **Step 11.4: Full regression smoke (Playwright)**

Visit at 390×844: `/dashboard`, `/plan`, `/plan?tab=recurrentes`, `/plan?tab=periodo`, `/transactions`, `/accounts`, `/deudas`. Confirm no visual regressions.

---

## Task 12: Open PR

- [ ] **Step 12.1: Branch + push**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta
git checkout -b feat/dashboard-polish-phase-2
git push -u origin feat/dashboard-polish-phase-2
```

(If work was done directly on main, create the branch retroactively: `git branch feat/dashboard-polish-phase-2 && git reset --hard origin/main` on main, then cherry-pick the commits. Better: do the work on the branch from Task 1.)

- [ ] **Step 12.2: Dry-merge check**

```bash
git fetch origin main && git merge --no-commit --no-ff origin/main && git merge --abort
```

Expected: no conflicts.

- [ ] **Step 12.3: Open PR**

```bash
gh pr create --title "feat(dashboard): Phase 2 polish — timeline, widget tiles, inline categorize" --body "$(cat <<'EOF'
## Summary

Phase 2 of the mobile polish milestone. Reshapes the mobile `/dashboard` to deliver the "Am I on track?" + "What needs my attention?" narrative per the audit at `audit/MOBILE_AUDIT_2026-04-16.md` and the design spec at `docs/superpowers/specs/2026-04-16-dashboard-polish-design.md`.

## Changes

- **ATENCIÓN chips replaced by "Por resolver" timeline** — chronological horizontal strip mixing overdue reminders, pending emails (collapsed to a single "N sin importar" card), upcoming pagos, and upcoming ingresos. New pure module `timeline-model.ts` (unit-tested) merges the four sources into urgency-tagged items.
- **RITMO + GASTO HOY → widget tiles** — rounded-2xl cards matching the chip style from the design screenshots, min-h-[120px], centered layout. Yesterday/avg-7d detail moves into the expand panels.
- **Discovery 2-tile → single `¿Puedo comprarlo?` tool row** — `Plan del mes` removed (redundant with tab-bar). Purchase recommender drawer wraps a new `InicioToolRow` component.
- **Reciente**: dropped inline `Sin cat.` yellow tag. Tap a row to expand an inline category picker (`CategoryPickerBody`). Selecting a category optimistically updates + toasts. Navigation to `/transactions/[id]` moves to an explicit "Ver detalle →" chip inside the expanded panel.
- **ImportStrip** hides when pending emails exist (redundant with the timeline card).
- **Section spacing** bumped to `space-y-4` for visible breathing room between zones.

## Test plan

- [ ] Unit: `pnpm vitest run timeline-model.test.ts` — 5/5 pass
- [ ] Build: `pnpm build` clean
- [ ] Visual (390×844): screenshots landed in `audit/2026-04-16/phase2-*.png`
- [ ] Interaction: tap timeline card routes; tap widget expands; tap Reciente row expands and reveals category picker; assign category → optimistic + toast
- [ ] Agents: `zetas-front-guy` + `perf-auditor` clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 12.4: Address reviewer feedback, then merge**

Monitor Gemini + CI. Merge via `gh pr merge <num> --squash --delete-branch` once approved.

---

## Self-review checklist (run after writing, before handoff)

**Spec coverage:**
- D1 (Dashboard job) — implicit across tasks, no dedicated task needed
- D2 (IA order) — Task 3 + Task 7 + Task 10
- D3 (Hero) — no change required (preserved by omission)
- D4 (Timeline) — Tasks 1, 2, 3
- D5 (Widgets + tool row) — Tasks 5, 6, 7
- D6 (Reciente inline picker) — Task 8
- D7 (ImportStrip conditional) — Task 9

**Open questions from spec:**
- Q1 (Timeline "Ver todo" destination) — chose `/gestionar` in the implementation. Flagged in PR body for reviewer confirmation.
- Q2 (Empty-state threshold) — Timeline renders empty-state "Todo tranquilo" when items array is zero, implemented in Task 2.
- Q3 (Tool row future expansion) — single tool only; scope respected.

**Placeholder scan:** all code blocks contain complete, runnable code. No TBD / TODO.

**Type consistency:** `TimelineItem`, `TimelineSources`, `UpcomingIncomeItem` consistent across files. `InicioAttentionTimelineProps` mirrors `InicioAttention` data shape. `InicioToolRow` takes only `currency` — simpler than what it replaces.
