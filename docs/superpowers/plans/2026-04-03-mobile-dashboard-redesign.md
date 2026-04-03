# Mobile Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile dashboard with a 6-card action-oriented layout using compact visuals (progress rings, gradient bars), tap-to-expand interactions, and clear CTAs.

**Architecture:** New `MobileDashboardV2` orchestrator composes 6 independent card components, each managing its own expand/collapse state. A shared `useExpandableCard` hook handles the animation pattern. The existing `lg:hidden` / `hidden lg:block` fork in `page.tsx` is preserved — only the mobile branch changes. Data fetching stays server-side; two new data points (budget summary, attention snapshot) get passed to the mobile component.

**Tech Stack:** React 19, Next.js 16, Tailwind v4, Framer Motion (for expand animations), Recharts (runway chart could use it, but SVG is simpler and lighter — we'll use raw SVG), existing shadcn/ui components.

**Spec:** `docs/superpowers/specs/2026-04-03-mobile-overhaul-dashboard-design.md`

---

## File Structure

```
webapp/src/
  components/
    mobile/
      cards/
        expandable-card.tsx          — CREATE: Shared expand/collapse wrapper with animation
        mobile-alert-card.tsx        — CREATE: Alert card with priority logic
        mobile-hero-card.tsx         — CREATE: Hero with expandable chips + math
        mobile-spending-pace.tsx     — CREATE: Compact bar + expandable runway SVG chart
        mobile-budget-ring.tsx       — CREATE: Progress ring SVG + expandable top categories
        mobile-upcoming-payments.tsx — CREATE: Payment list with per-item expansion
        mobile-recent-txns.tsx       — CREATE: Compact 3-item list
      mobile-dashboard-v2.tsx        — CREATE: New orchestrator composing all cards
      mobile-dashboard.tsx           — DELETE (after v2 is validated)
  app/(dashboard)/dashboard/
    page.tsx                         — MODIFY: Swap MobileDashboard for MobileDashboardV2,
                                       pass budgetSummary + attentionSnapshot to mobile
```

---

### Task 1: Expandable Card Primitive

**Files:**
- Create: `webapp/src/components/mobile/cards/expandable-card.tsx`

This is the shared animation wrapper used by all cards. It handles the expand/collapse transition using CSS grid animation (no JS layout measurement needed).

- [ ] **Step 1: Create the expandable card component**

```tsx
// webapp/src/components/mobile/cards/expandable-card.tsx
"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ExpandableCardProps {
  expanded: boolean;
  onToggle: () => void;
  compact: ReactNode;
  detail: ReactNode;
  className?: string;
  /** If true, only the detail CTA navigates — the card body toggles expand */
  disableCompactTap?: boolean;
}

export function ExpandableCard({
  expanded,
  onToggle,
  compact,
  detail,
  className,
  disableCompactTap = false,
}: ExpandableCardProps) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-white/6 bg-[#111] transition-colors",
        expanded && "border-white/10",
        className
      )}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={disableCompactTap ? undefined : onToggle}
        aria-expanded={expanded}
      >
        {compact}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "transition-opacity duration-150",
              expanded ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `cd webapp && pnpm build`
Expected: Clean build (component isn't used yet, but types must compile).

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/cards/expandable-card.tsx
git commit -m "feat(mobile): add ExpandableCard primitive with CSS grid animation"
```

---

### Task 2: Mobile Alert Card

**Files:**
- Create: `webapp/src/components/mobile/cards/mobile-alert-card.tsx`

Uses the existing `AttentionSnapshot` from `actions/attention.ts`. Shows the single highest-priority signal. Hidden when no signals exist.

- [ ] **Step 1: Create the alert card component**

```tsx
// webapp/src/components/mobile/cards/mobile-alert-card.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight, CircleAlert, Inbox, Bell } from "lucide-react";
import type { AttentionSignal } from "@/types/attention";
import { ExpandableCard } from "./expandable-card";

interface MobileAlertCardProps {
  signals: AttentionSignal[];
}

const SIGNAL_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string }> = {
  uncategorized: { icon: Inbox, label: "transacciones sin categoría" },
  destinatario_suggestions: { icon: Inbox, label: "comercios por asignar" },
  overdue_reminders: { icon: Bell, label: "recordatorios vencidos" },
};

function getTopSignal(signals: AttentionSignal[]): AttentionSignal | null {
  // action priority first, then by count descending
  const sorted = [...signals].sort((a, b) => {
    if (a.priority === "action" && b.priority !== "action") return -1;
    if (b.priority === "action" && a.priority !== "action") return 1;
    return b.count - a.count;
  });
  return sorted[0] ?? null;
}

export function MobileAlertCard({ signals }: MobileAlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const signal = getTopSignal(signals);

  if (!signal) return null;

  const config = SIGNAL_CONFIG[signal.key];
  const Icon = config?.icon ?? CircleAlert;
  const isAction = signal.priority === "action";

  return (
    <ExpandableCard
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      className={cn(
        "border-z-brass/20 bg-gradient-to-br from-[rgba(212,168,83,0.08)] to-transparent",
        isAction && "border-z-debt/20 from-[rgba(204,68,68,0.08)]"
      )}
      compact={
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              isAction ? "bg-z-debt/15" : "bg-z-brass/15"
            )}
          >
            <Icon
              className={cn("h-3.5 w-3.5", isAction ? "text-z-debt" : "text-z-brass")}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-xs font-semibold",
                isAction ? "text-z-debt" : "text-z-brass"
              )}
            >
              {signal.label}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {signal.count} {signal.count === 1 ? "pendiente" : "pendientes"}
            </p>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              expanded && "rotate-90",
              isAction ? "text-z-debt/50" : "text-z-brass/50"
            )}
          />
        </div>
      }
      detail={
        <div className="px-4 pb-3 pt-0">
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            {signal.priority === "action"
              ? "Esto necesita tu atención para mantener tus finanzas al día."
              : "Una sugerencia para mejorar la organización de tus datos."}
          </p>
          <Link
            href={signal.actionHref}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors",
              isAction
                ? "border-z-debt/25 bg-z-debt/10 text-z-debt hover:bg-z-debt/15"
                : "border-z-brass/25 bg-z-brass/10 text-z-brass hover:bg-z-brass/15"
            )}
          >
            Ir a {signal.page === "transactions" ? "movimientos" : signal.page}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      }
    />
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/cards/mobile-alert-card.tsx
git commit -m "feat(mobile): add MobileAlertCard with attention signal priority"
```

---

### Task 3: Mobile Hero Card

**Files:**
- Create: `webapp/src/components/mobile/cards/mobile-hero-card.tsx`

The main "Disponible para gastar" card. Three independently tappable chips + tappable hero number that shows the math.

- [ ] **Step 1: Create the hero card component**

```tsx
// webapp/src/components/mobile/cards/mobile-hero-card.tsx
"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronRight } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

type ExpandedSection = "math" | "saldo" | "fijos" | "proximo" | null;

interface HeroAccount {
  id: string;
  name: string;
  currentBalance: number;
  currencyCode: string;
}

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  currencyCode: string;
}

interface NextPayment {
  name: string;
  amount: number;
  dueDate: string;
  currencyCode: string;
}

export interface MobileHeroCardProps {
  availableToSpend: number;
  totalBalance: number;
  pendingFixed: number;
  totalSpent: number;
  currency: CurrencyCode;
  daysToNextPayment: number | null;
  liquidAccounts: HeroAccount[];
  fixedExpenses: FixedExpense[];
  nextPayment: NextPayment | null;
}

function getCapacityMessage(available: number): string {
  if (available <= 0) return "Sin margen — revisa tus gastos";
  if (available < 100_000) return "Compras pequeñas ✓";
  if (available < 500_000) return "Margen moderado";
  return "Buen margen este período";
}

export function MobileHeroCard({
  availableToSpend,
  totalBalance,
  pendingFixed,
  totalSpent,
  currency,
  daysToNextPayment,
  liquidAccounts,
  fixedExpenses,
  nextPayment,
}: MobileHeroCardProps) {
  const [expanded, setExpanded] = useState<ExpandedSection>(null);

  function toggle(section: ExpandedSection) {
    setExpanded((prev) => (prev === section ? null : section));
  }

  const code = currency;
  const isNegative = availableToSpend < 0;

  return (
    <div className="rounded-[18px] border border-white/6 bg-[linear-gradient(160deg,#1a2518,#0d1117)] p-4">
      {/* Hero number — tappable for math */}
      <button
        type="button"
        className="w-full text-left"
        onClick={() => toggle("math")}
        aria-expanded={expanded === "math"}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Disponible para gastar
        </p>
        <p
          className={cn(
            "mt-1 text-[30px] font-bold leading-tight tracking-tight",
            isNegative ? "text-z-debt" : "text-z-sage-lightest"
          )}
        >
          {formatCurrency(availableToSpend, code)}
        </p>
        <p className={cn("mt-1 text-xs", isNegative ? "text-z-debt/70" : "text-z-sage-dark")}>
          {getCapacityMessage(availableToSpend)}
        </p>
      </button>

      {/* Math expansion */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded === "math" ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "pt-3 transition-opacity duration-150",
              expanded === "math" ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            <div className="rounded-xl bg-black/20 p-3 text-xs">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cómo se calcula
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-z-sage-light">
                  <span>Saldo total</span>
                  <span>{formatCurrency(totalBalance, code)}</span>
                </div>
                <div className="flex justify-between text-z-expense">
                  <span>− Gastos fijos</span>
                  <span>{formatCurrency(pendingFixed, code)}</span>
                </div>
                <div className="flex justify-between text-z-expense">
                  <span>− Ya gastado</span>
                  <span>{formatCurrency(totalSpent, code)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1.5 font-semibold text-z-sage-lightest">
                  <span>= Disponible</span>
                  <span>{formatCurrency(availableToSpend, code)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat chips */}
      <div className="mt-3 flex gap-2">
        <ChipButton
          label="Saldo"
          value={formatCurrency(totalBalance, code)}
          active={expanded === "saldo"}
          onClick={() => toggle("saldo")}
        />
        <ChipButton
          label="Fijos"
          value={formatCurrency(pendingFixed, code)}
          active={expanded === "fijos"}
          onClick={() => toggle("fijos")}
        />
        <ChipButton
          label="Prox."
          value={daysToNextPayment != null ? `${daysToNextPayment}d` : "—"}
          active={expanded === "proximo"}
          onClick={() => toggle("proximo")}
        />
      </div>

      {/* Saldo expansion — per-account balances */}
      <ChipDetail visible={expanded === "saldo"}>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-z-brass">
          Saldo por cuenta
        </p>
        {liquidAccounts.length > 0 ? (
          <div className="space-y-1">
            {liquidAccounts.map((acc) => (
              <div key={acc.id} className="flex justify-between text-xs text-z-sage-light">
                <span className="truncate mr-2">{acc.name}</span>
                <span className="shrink-0">
                  {formatCurrency(acc.currentBalance, acc.currencyCode as CurrencyCode)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin cuentas líquidas</p>
        )}
        <Link
          href="/accounts"
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-[11px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
        >
          Ver cuentas <ChevronRight className="h-3 w-3" />
        </Link>
      </ChipDetail>

      {/* Fijos expansion — fixed expenses */}
      <ChipDetail visible={expanded === "fijos"}>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-z-brass">
          Gastos fijos del período
        </p>
        {fixedExpenses.length > 0 ? (
          <>
            <div className="space-y-1">
              {fixedExpenses.map((exp) => (
                <div key={exp.id} className="flex justify-between text-xs text-z-sage-light">
                  <span className="truncate mr-2">{exp.name}</span>
                  <span className="shrink-0">
                    {formatCurrency(exp.amount, exp.currencyCode as CurrencyCode)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between border-t border-white/10 pt-1.5 text-xs font-semibold text-z-sage-lightest">
              <span>Total fijos</span>
              <span>{formatCurrency(pendingFixed, code)}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sin gastos fijos registrados</p>
        )}
      </ChipDetail>

      {/* Próximo expansion — next payment */}
      <ChipDetail visible={expanded === "proximo"}>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-z-brass">
          Próximo pago
        </p>
        {nextPayment ? (
          <div className="space-y-1 text-xs text-z-sage-light">
            <div className="flex justify-between">
              <span>Nombre</span>
              <span>{nextPayment.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Monto</span>
              <span>{formatCurrency(nextPayment.amount, nextPayment.currencyCode as CurrencyCode)}</span>
            </div>
            <div className="flex justify-between">
              <span>Fecha</span>
              <span>{nextPayment.dueDate}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin pagos próximos</p>
        )}
      </ChipDetail>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChipButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center rounded-xl bg-black/20 px-2 py-1.5 transition-colors",
        active && "bg-z-brass/10 ring-1 ring-z-brass/30"
      )}
      aria-expanded={active}
    >
      <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-[13px] font-semibold", active ? "text-z-brass" : "text-z-sage-light")}>
        {value}
      </span>
    </button>
  );
}

function ChipDetail({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: visible ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "rounded-xl bg-black/20 p-3 mt-2 transition-opacity duration-150",
            visible ? "opacity-100 delay-75" : "opacity-0"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
```

Note: The `ChipDetail` sub-component uses `ReactNode`. Add it to the existing React import: `import { useState, type ReactNode } from "react";`

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/cards/mobile-hero-card.tsx
git commit -m "feat(mobile): add MobileHeroCard with expandable chips and math breakdown"
```

---

### Task 4: Mobile Spending Pace Card

**Files:**
- Create: `webapp/src/components/mobile/cards/mobile-spending-pace.tsx`

Compact gradient bar that expands to show the SVG runway chart. Uses `BurnRateResponse` data.

- [ ] **Step 1: Create the spending pace card**

```tsx
// webapp/src/components/mobile/cards/mobile-spending-pace.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronRight } from "lucide-react";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";
import { ExpandableCard } from "./expandable-card";

interface MobileSpendingPaceProps {
  data: BurnRateResponse;
}

export function MobileSpendingPace({ data }: MobileSpendingPaceProps) {
  const [expanded, setExpanded] = useState(false);

  const { discretionary, currency } = data;
  const { runwayDays, dailyAverage, dataPoints, trend } = discretionary;
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();
  const progress = Math.min((dayOfMonth / daysInMonth) * 100, 100);

  // Color based on runway vs remaining days
  const daysRemaining = daysInMonth - dayOfMonth;
  const isWarning = runwayDays < daysRemaining;
  const isCritical = runwayDays < daysRemaining * 0.5;

  return (
    <ExpandableCard
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      compact={
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs font-semibold",
              isCritical ? "text-z-debt" : isWarning ? "text-z-brass" : "text-z-sage-light"
            )}>
              Ritmo de gasto
            </span>
            <span className={cn(
              "text-[11px] font-semibold",
              isCritical ? "text-z-debt" : isWarning ? "text-z-brass" : "text-z-sage-light"
            )}>
              {Math.round(runwayDays)} días
            </span>
          </div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-white/5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isCritical
                  ? "bg-gradient-to-r from-z-brass to-z-debt"
                  : isWarning
                    ? "bg-gradient-to-r from-z-sage-light to-z-brass"
                    : "bg-z-sage-light"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-[10px] text-muted-foreground">
              Día {dayOfMonth} de {daysInMonth}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Toca para detalles ›
            </span>
          </div>
        </div>
      }
      detail={
        <div className="px-4 pb-3 pt-0">
          <p className="mb-2 text-xs font-semibold text-z-brass">Proyección de gasto</p>
          <RunwayChart
            dataPoints={dataPoints}
            runwayDays={runwayDays}
            dayOfMonth={dayOfMonth}
            daysInMonth={daysInMonth}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {isCritical ? (
              <>
                Si sigues gastando así, te pasas el{" "}
                <span className="font-semibold text-z-debt">
                  día {Math.min(dayOfMonth + Math.round(runwayDays), daysInMonth)}
                </span>
                . Reduce{" "}
                <span className="text-z-sage-light">
                  {formatCurrency(
                    dailyAverage - data.disponible / Math.max(daysRemaining, 1),
                    currency
                  )}
                  /día
                </span>{" "}
                para llegar al {daysInMonth}.
              </>
            ) : isWarning ? (
              <>
                Tu ritmo está un poco alto. Tienes margen para{" "}
                <span className="font-semibold text-z-brass">
                  {Math.round(runwayDays)} días
                </span>{" "}
                al ritmo actual.
              </>
            ) : (
              <>
                Vas bien — tu ritmo permite llegar al{" "}
                <span className="font-semibold text-z-sage-light">
                  día {daysInMonth}
                </span>{" "}
                con margen.
              </>
            )}
          </p>
          <Link
            href="/dashboard#burn-rate"
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-z-brass/20 bg-z-brass/8 px-3 py-2 text-[11px] font-semibold text-z-brass transition-colors hover:bg-z-brass/12"
          >
            Ver análisis completo <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      }
    />
  );
}

// ─── SVG Runway Chart ────────────────────────────────────────────────────────

function RunwayChart({
  dataPoints,
  runwayDays,
  dayOfMonth,
  daysInMonth,
}: {
  dataPoints: { date: string; balance: number }[];
  runwayDays: number;
  dayOfMonth: number;
  daysInMonth: number;
}) {
  const W = 280;
  const H = 90;
  const PAD = { top: 8, right: 10, bottom: 18, left: 10 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Normalize data points to current month
  const monthPoints = dataPoints.filter((dp) => {
    const day = new Date(dp.date).getDate();
    return day <= dayOfMonth;
  });

  if (monthPoints.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg bg-black/20 text-[11px] text-muted-foreground">
        Datos insuficientes para la proyección
      </div>
    );
  }

  // Find max balance for Y scaling
  const maxBalance = Math.max(...monthPoints.map((p) => p.balance));
  const scaleX = (day: number) => PAD.left + (day / daysInMonth) * plotW;
  const scaleY = (val: number) =>
    PAD.top + plotH - (val / (maxBalance * 1.1)) * plotH;

  // Ideal line: from day 1 max balance to day 30 zero
  const idealStart = { x: scaleX(1), y: scaleY(maxBalance) };
  const idealEnd = { x: scaleX(daysInMonth), y: scaleY(0) };

  // Actual spending path
  const actualPath = monthPoints
    .map((p, i) => {
      const day = new Date(p.date).getDate();
      const x = scaleX(day);
      const y = scaleY(p.balance);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  // Current position
  const lastPoint = monthPoints[monthPoints.length - 1];
  const lastDay = new Date(lastPoint.date).getDate();
  const cx = scaleX(lastDay);
  const cy = scaleY(lastPoint.balance);

  // Projected overshoot line
  const projectedEndDay = Math.min(lastDay + runwayDays, daysInMonth + 2);
  const projectedPath = `M${cx},${cy} L${scaleX(projectedEndDay)},${scaleY(0)}`;

  return (
    <div className="rounded-lg bg-black/20 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Gráfico de proyección de gasto">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={PAD.left}
            y1={scaleY(maxBalance * pct)}
            x2={W - PAD.right}
            y2={scaleY(maxBalance * pct)}
            stroke="#222"
            strokeWidth="0.5"
          />
        ))}

        {/* Ideal line (dashed, sage) */}
        <line
          x1={idealStart.x}
          y1={idealStart.y}
          x2={idealEnd.x}
          y2={idealEnd.y}
          stroke="#2a3a22"
          strokeWidth="1.5"
          strokeDasharray="4,3"
        />

        {/* Actual spending path */}
        <path d={actualPath} fill="none" stroke="#d4a853" strokeWidth="2" strokeLinejoin="round" />

        {/* Current position dot */}
        <circle cx={cx} cy={cy} r="4" fill="#d4a853" />
        <circle cx={cx} cy={cy} r="6" fill="#d4a853" fillOpacity="0.2" />

        {/* Projected overshoot (dashed red) */}
        {runwayDays < daysInMonth - dayOfMonth && (
          <path d={projectedPath} fill="none" stroke="#c44" strokeWidth="1.5" strokeDasharray="3,2" />
        )}

        {/* X-axis labels */}
        <text x={PAD.left} y={H - 2} fill="#555" fontSize="7" fontFamily="system-ui">
          Día 1
        </text>
        <text x={scaleX(dayOfMonth)} y={H - 2} fill="#888" fontSize="7" fontFamily="system-ui" textAnchor="middle">
          Hoy ({dayOfMonth})
        </text>
        <text x={W - PAD.right} y={H - 2} fill="#555" fontSize="7" fontFamily="system-ui" textAnchor="end">
          {daysInMonth}
        </text>
      </svg>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        Línea ideal vs gasto real
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/cards/mobile-spending-pace.tsx
git commit -m "feat(mobile): add MobileSpendingPace with SVG runway chart"
```

---

### Task 5: Mobile Budget Ring Card

**Files:**
- Create: `webapp/src/components/mobile/cards/mobile-budget-ring.tsx`

Progress ring showing budget usage, expands to show top 3 categories.

- [ ] **Step 1: Create the budget ring card**

```tsx
// webapp/src/components/mobile/cards/mobile-budget-ring.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronRight } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";
import { ExpandableCard } from "./expandable-card";

interface TopCategory {
  name: string;
  percentUsed: number;
}

interface MobileBudgetRingProps {
  totalTarget: number;
  totalSpent: number;
  progress: number;
  currency: CurrencyCode;
  topCategories: TopCategory[];
}

function getStatusMessage(progress: number): string {
  if (progress >= 100) return "Presupuesto superado";
  if (progress >= 80) return "Cerca del límite";
  if (progress >= 50) return "Vas bien este mes";
  return "Buen ritmo";
}

function ProgressRing({
  progress,
  size = 44,
  strokeWidth = 4,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(progress, 100);
  const strokeDasharray = `${(filled / 100) * circumference} ${circumference}`;
  const isOver = progress >= 100;
  const isHigh = progress >= 80;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isOver ? "#c44" : isHigh ? "#d4a853" : "#a8b5a0"}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "text-[11px] font-bold",
            isOver ? "text-z-debt" : "text-z-sage-lightest"
          )}
        >
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

export function MobileBudgetRing({
  totalTarget,
  totalSpent,
  progress,
  currency,
  topCategories,
}: MobileBudgetRingProps) {
  const [expanded, setExpanded] = useState(false);

  if (totalTarget === 0) return null;

  return (
    <ExpandableCard
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      compact={
        <div className="flex items-center gap-3 px-4 py-3">
          <ProgressRing progress={progress} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-z-sage-light">Presupuesto</p>
            <p className="text-[11px] text-muted-foreground">
              {formatCurrency(totalSpent, currency)} de {formatCurrency(totalTarget, currency)} — {getStatusMessage(progress)}
            </p>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-90"
            )}
          />
        </div>
      }
      detail={
        <div className="px-4 pb-3 pt-0">
          <div className="rounded-xl bg-black/20 p-3">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Categorías con más gasto
            </p>
            {topCategories.length > 0 ? (
              <div className="space-y-2">
                {topCategories.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex justify-between text-[11px] text-z-sage-light">
                      <span>{cat.name}</span>
                      <span>{Math.round(cat.percentUsed)}%</span>
                    </div>
                    <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/5">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          cat.percentUsed >= 100
                            ? "bg-z-debt"
                            : cat.percentUsed >= 80
                              ? "bg-z-brass"
                              : "bg-z-sage-light"
                        )}
                        style={{ width: `${Math.min(cat.percentUsed, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Sin categorías presupuestadas</p>
            )}
          </div>
          <Link
            href="/plan"
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-[11px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
          >
            Ir a presupuesto <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      }
    />
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/cards/mobile-budget-ring.tsx
git commit -m "feat(mobile): add MobileBudgetRing with SVG progress ring and top categories"
```

---

### Task 6: Mobile Upcoming Payments Card

**Files:**
- Create: `webapp/src/components/mobile/cards/mobile-upcoming-payments.tsx`

Max 3 payments with urgency dots. Each payment is independently expandable.

- [ ] **Step 1: Create the upcoming payments card**

```tsx
// webapp/src/components/mobile/cards/mobile-upcoming-payments.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { ChevronRight, Check } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";
import { toISODateString } from "@/lib/utils/date";

interface Payment {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  currencyCode: string;
  accountName?: string;
  frequency?: string;
}

interface MobileUpcomingPaymentsProps {
  payments: Payment[];
}

function getUrgency(dueDate: string, today: string): "overdue" | "today" | "soon" | "later" {
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  const diff = (new Date(dueDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 3) return "soon";
  return "later";
}

const URGENCY_DOT = {
  overdue: "bg-z-debt",
  today: "bg-z-debt",
  soon: "bg-z-brass",
  later: "bg-z-sage-dark",
};

const URGENCY_LABEL = {
  overdue: "Vencido",
  today: "Hoy",
  soon: "",
  later: "",
};

export function MobileUpcomingPayments({ payments }: MobileUpcomingPaymentsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = toISODateString(new Date());
  const visible = payments.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-white/6 bg-[#111] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Próximos pagos
        </p>
        {payments.length > 3 && (
          <Link
            href="/recurrentes"
            className="flex items-center gap-0.5 text-[11px] text-z-brass hover:underline"
          >
            Ver todos <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="space-y-1">
        {visible.map((payment) => {
          const urgency = getUrgency(payment.dueDate, today);
          const isExpanded = expandedId === payment.id;

          return (
            <div key={payment.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/3"
                onClick={() => setExpandedId(isExpanded ? null : payment.id)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", URGENCY_DOT[urgency])} />
                  <span className="truncate text-xs text-z-sage-light">{payment.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-semibold text-z-sage-lightest">
                    {formatCurrency(payment.amount, payment.currencyCode as CurrencyCode)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px]",
                      urgency === "overdue" || urgency === "today"
                        ? "font-medium text-z-debt"
                        : "text-muted-foreground"
                    )}
                  >
                    {URGENCY_LABEL[urgency] || formatDate(payment.dueDate, "dd MMM")}
                  </span>
                </div>
              </button>

              {/* Per-item expansion */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div
                    className={cn(
                      "rounded-lg bg-black/20 p-3 mt-1 mb-1 transition-opacity duration-150",
                      isExpanded ? "opacity-100 delay-75" : "opacity-0"
                    )}
                  >
                    <div className="space-y-1 text-[11px] text-z-sage-light">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monto</span>
                        <span>{formatCurrency(payment.amount, payment.currencyCode as CurrencyCode)}</span>
                      </div>
                      {payment.accountName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cuenta</span>
                          <span>{payment.accountName}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha</span>
                        <span>{formatDate(payment.dueDate, "dd MMM yyyy")}</span>
                      </div>
                      {payment.frequency && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frecuencia</span>
                          <span>{payment.frequency}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Link
                        href="/recurrentes"
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-[11px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
                      >
                        Ver detalles <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/cards/mobile-upcoming-payments.tsx
git commit -m "feat(mobile): add MobileUpcomingPayments with per-item expansion and urgency dots"
```

---

### Task 7: Mobile Recent Transactions Card

**Files:**
- Create: `webapp/src/components/mobile/cards/mobile-recent-txns.tsx`

Compact 3-item list below the fold. Tapping a transaction opens a bottom sheet (using existing drawer pattern).

- [ ] **Step 1: Create the recent transactions card**

```tsx
// webapp/src/components/mobile/cards/mobile-recent-txns.tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

interface RecentTransaction {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
}

interface MobileRecentTxnsProps {
  transactions: RecentTransaction[];
}

export function MobileRecentTxns({ transactions }: MobileRecentTxnsProps) {
  const visible = transactions.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-white/6 bg-[#111] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Últimos movimientos
        </p>
        <Link
          href="/transactions"
          className="flex items-center gap-0.5 text-[11px] text-z-brass hover:underline"
        >
          Ver todos <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-0.5">
        {visible.map((tx) => (
          <Link
            key={tx.id}
            href={`/transactions/${tx.id}`}
            className="flex items-center justify-between rounded-lg px-1 py-1.5 transition-colors hover:bg-white/3 active:bg-white/5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5">
                {tx.direction === "INFLOW" ? (
                  <ArrowDownLeft className="h-3 w-3 text-z-income" />
                ) : (
                  <ArrowUpRight className="h-3 w-3 text-z-expense" />
                )}
              </div>
              <span className="truncate text-xs text-z-sage-light">{tx.description}</span>
            </div>
            <span
              className={cn(
                "shrink-0 ml-2 text-xs font-medium",
                tx.direction === "INFLOW" ? "text-z-income" : "text-foreground"
              )}
            >
              {tx.direction === "INFLOW" ? "+" : "-"}
              {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/cards/mobile-recent-txns.tsx
git commit -m "feat(mobile): add MobileRecentTxns compact list"
```

---

### Task 8: Mobile Dashboard V2 Orchestrator

**Files:**
- Create: `webapp/src/components/mobile/mobile-dashboard-v2.tsx`

Composes all 6 cards. Receives data via props from the server component page.

- [ ] **Step 1: Create the orchestrator**

```tsx
// webapp/src/components/mobile/mobile-dashboard-v2.tsx
"use client";

import type { AttentionSignal } from "@/types/attention";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";
import { MobileAlertCard } from "./cards/mobile-alert-card";
import {
  MobileHeroCard,
  type MobileHeroCardProps,
} from "./cards/mobile-hero-card";
import { MobileSpendingPace } from "./cards/mobile-spending-pace";
import { MobileBudgetRing } from "./cards/mobile-budget-ring";
import { MobileUpcomingPayments } from "./cards/mobile-upcoming-payments";
import { MobileRecentTxns } from "./cards/mobile-recent-txns";

interface TopCategory {
  name: string;
  percentUsed: number;
}

export interface MobileDashboardV2Props {
  // Alert
  attentionSignals: AttentionSignal[];
  // Hero
  hero: MobileHeroCardProps;
  // Upcoming payments
  upcomingPayments: Array<{
    id: string;
    name: string;
    dueDate: string;
    amount: number;
    currencyCode: string;
    accountName?: string;
    frequency?: string;
  }>;
  // Recent transactions
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    currency_code: string;
    direction: "INFLOW" | "OUTFLOW";
  }>;
  // Budget
  budget: {
    totalTarget: number;
    totalSpent: number;
    progress: number;
    currency: CurrencyCode;
    topCategories: TopCategory[];
  } | null;
}

export function MobileDashboardV2({
  attentionSignals,
  hero,
  upcomingPayments,
  recentTransactions,
  budget,
}: MobileDashboardV2Props) {
  return (
    <div className="space-y-3">
      {/* ① Alert — conditional, hidden when empty */}
      <MobileAlertCard signals={attentionSignals} />

      {/* ② Hero — disponible para gastar */}
      <MobileHeroCard {...hero} />

      {/* ③ Spending pace — injected via Suspense slot from page.tsx */}
      {/* (not rendered here — see page.tsx integration) */}

      {/* ④ Budget ring */}
      {budget && (
        <MobileBudgetRing
          totalTarget={budget.totalTarget}
          totalSpent={budget.totalSpent}
          progress={budget.progress}
          currency={budget.currency}
          topCategories={budget.topCategories}
        />
      )}

      {/* ⑤ Upcoming payments */}
      <MobileUpcomingPayments payments={upcomingPayments} />

      {/* ⑥ Recent transactions — below the fold */}
      <MobileRecentTxns transactions={recentTransactions} />
    </div>
  );
}
```

Note: The Spending Pace card (③) is NOT inside MobileDashboardV2 because it depends on Tier 2 data (`BurnRateResponse`) that streams in via Suspense. It's rendered as a sibling in page.tsx, between MobileDashboardV2 and the rest.

- [ ] **Step 2: Create the mobile spending pace Suspense wrapper**

This replaces the current `MobileBurnRateSection` in page.tsx. Add it to the same file for now.

We'll modify this in the page integration task (Task 9). For now just verify the orchestrator compiles.

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/mobile-dashboard-v2.tsx
git commit -m "feat(mobile): add MobileDashboardV2 orchestrator composing all cards"
```

---

### Task 9: Dashboard Page Integration

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

Swap `MobileDashboard` for `MobileDashboardV2`. Add budget summary + top categories data fetching for mobile. Keep the Suspense-wrapped spending pace between the orchestrator and the fold.

- [ ] **Step 1: Add new imports to page.tsx**

At the top of `webapp/src/app/(dashboard)/dashboard/page.tsx`, add:

```tsx
import { MobileDashboardV2 } from "@/components/mobile/mobile-dashboard-v2";
import { MobileSpendingPace } from "@/components/mobile/cards/mobile-spending-pace";
import { getBudgetSummary } from "@/actions/budgets";
import { getCategoriesWithBudgetData } from "@/actions/categories";
```

Remove or keep the old import `MobileDashboard` from `@/components/mobile/mobile-dashboard` — keep it until we've verified the new dashboard works, then remove in cleanup task.

- [ ] **Step 2: Add budget data to Tier 1 fetch**

In the `Promise.all` block (~line 293), add `getBudgetSummary(month)` and `getCategoriesWithBudgetData(month, currency)`:

```tsx
const [heroData, healthMetersData, allocationData, debtCountdownData, attentionSnapshot, impactEvents, pendingReminders, wishlistDashboard, wishlistNudges, budgetSummary, categoryBudgetResult] = await Promise.all([
  getDashboardHeroData(month, currency),
  getHealthMeters(currency, month),
  get503020Allocation(month, currency),
  getDebtFreeCountdown(currency),
  getAttentionSnapshot(),
  getRecentImpactEvents(3),
  getReminders("pending"),
  getWishlistItemsForDashboard(),
  getWishlistNudges(),
  getBudgetSummary(month),
  getCategoriesWithBudgetData(month, currency),
]);
```

- [ ] **Step 3: Map data for MobileDashboardV2 props**

After the existing mobile data mapping (~line 341), add:

```tsx
// ── Data for MobileDashboardV2 ──────────────────────────────────────────────

const mobileLiquidAccounts = allAccounts
  .filter((a) => a.account_type === "CHECKING" || a.account_type === "SAVINGS")
  .map((a) => ({
    id: a.id,
    name: a.name,
    currentBalance: a.current_balance ?? 0,
    currencyCode: a.currency_code,
  }));

const mobileFixedExpenses = heroData.pendingObligations.map((o) => ({
  id: o.id,
  name: o.name,
  amount: o.amount,
  currencyCode: o.currency_code,
}));

const firstPayment = heroData.pendingObligations[0];
const mobileNextPayment = firstPayment
  ? {
      name: firstPayment.name,
      amount: firstPayment.amount,
      dueDate: firstPayment.due_date,
      currencyCode: firstPayment.currency_code,
    }
  : null;

const today = new Date();
const daysToNextPayment = firstPayment
  ? Math.ceil(
      (new Date(firstPayment.due_date).getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  : null;

// Total spent this month (for the math breakdown)
// available = total - fixed - spent → spent = total - fixed - available
const mobileTotalSpent = heroData.totalLiquid - heroData.totalPending - heroData.availableToSpend;

// Top 3 budget categories by % used
const categoryBudgetData =
  categoryBudgetResult.success ? categoryBudgetResult.data : [];
const mobileTopCategories = categoryBudgetData
  .filter((c) => c.budget && c.budget > 0 && c.direction === "OUTFLOW")
  .sort((a, b) => b.percentUsed - a.percentUsed)
  .slice(0, 3)
  .map((c) => ({
    name: c.name_es ?? c.name,
    percentUsed: c.percentUsed,
  }));

const mobileUpcomingPaymentsV2 = heroData.pendingObligations.slice(0, 5).map((o) => ({
  id: o.id,
  name: o.name,
  dueDate: o.due_date,
  amount: o.amount,
  currencyCode: o.currency_code,
}));
```

- [ ] **Step 4: Replace the mobile dashboard render block**

Replace the current mobile section (~lines 356-394) with:

```tsx
{/* Mobile dashboard */}
<div className="lg:hidden">
  <div className="space-y-3">
    <MobileDashboardV2
      attentionSignals={attentionSnapshot.signals}
      hero={{
        availableToSpend: heroData.availableToSpend,
        totalBalance: heroData.totalLiquid,
        pendingFixed: heroData.totalPending,
        totalSpent: mobileTotalSpent,
        currency: currency as CurrencyCode,
        daysToNextPayment,
        liquidAccounts: mobileLiquidAccounts,
        fixedExpenses: mobileFixedExpenses,
        nextPayment: mobileNextPayment,
      }}
      upcomingPayments={mobileUpcomingPaymentsV2}
      recentTransactions={mobileRecentTx}
      budget={
        budgetSummary.totalTarget > 0
          ? {
              totalTarget: budgetSummary.totalTarget,
              totalSpent: budgetSummary.totalSpent,
              progress: budgetSummary.progress,
              currency: currency as CurrencyCode,
              topCategories: mobileTopCategories,
            }
          : null
      }
    />
    {/* Tier 2: spending pace (streams in) */}
    <Suspense fallback={<MobileBurnRateSkeleton />}>
      <MobileSpendingPaceSection currency={currency} />
    </Suspense>
  </div>
</div>
```

- [ ] **Step 5: Add the new Suspense section for spending pace**

Near the existing `MobileBurnRateSection` function (~line 147), add a new async server component:

```tsx
async function MobileSpendingPaceSection({ currency }: { currency: CurrencyCode }) {
  const burnRateData = await getBurnRate(currency);
  return burnRateData ? <MobileSpendingPace data={burnRateData} /> : null;
}
```

- [ ] **Step 6: Remove the old mobile header section**

The old mobile section had a header block with "Tu estado financiero de hoy" and a month label. This is removed — the topbar already provides context. The new dashboard starts directly with the alert/hero cards.

- [ ] **Step 7: Verify build**

Run: `cd webapp && pnpm build`
Expected: Clean build. If there are type errors, fix them — the most likely issues are:
- `CurrencyCode` cast on `currency` (it comes as `string` from search params)
- `categoryBudgetResult` shape from `getCategoriesWithBudgetData` (returns `ActionResult<CategoryBudgetData[]>`)

- [ ] **Step 8: Test locally**

Run: `cd webapp && pnpm dev`
Open the dashboard on a mobile viewport (Chrome DevTools → responsive → iPhone 14). Verify:
- Alert card shows/hides based on attention signals
- Hero card shows available amount with correct chips
- Tapping hero number shows math breakdown
- Tapping chips shows per-account / fixed expenses / next payment
- Spending pace bar renders with gradient
- Tapping spending pace shows the SVG runway chart
- Budget ring shows progress
- Upcoming payments show urgency dots
- Recent transactions appear below the fold

- [ ] **Step 9: Commit**

```bash
git add webapp/src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(mobile): integrate MobileDashboardV2 into dashboard page

Replace old MobileDashboard with new 6-card action-oriented layout.
Add budget summary + top categories data to mobile tier 1 fetch.
Spending pace streams via Suspense as tier 2 data."
```

---

### Task 10: Cleanup — Remove Old Mobile Dashboard

**Files:**
- Delete: `webapp/src/components/mobile/mobile-dashboard.tsx`
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx` — remove old import and old `MobileBurnRateSection` if replaced

Only do this after Task 9 is verified working.

- [ ] **Step 1: Remove old MobileDashboard import from page.tsx**

Remove this line from the imports:
```tsx
import { MobileDashboard } from "@/components/mobile/mobile-dashboard";
```

Also remove the old `MobileBurnRateSection` function if it's no longer used (replaced by `MobileSpendingPaceSection`).

- [ ] **Step 2: Delete the old component file**

```bash
rm webapp/src/components/mobile/mobile-dashboard.tsx
```

- [ ] **Step 3: Check for any other imports of the old component**

Run: `grep -r "mobile-dashboard" webapp/src/ --include="*.tsx" --include="*.ts" -l`

If any file still imports the old component, update it to use `mobile-dashboard-v2` instead.

- [ ] **Step 4: Verify build**

Run: `cd webapp && pnpm build`
Expected: Clean build with no dead code warnings.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(mobile): remove old MobileDashboard, replaced by V2"
```

---

## Build Verification Gates

Before claiming this work is done:

1. `cd webapp && pnpm install` — ensure lockfile is current
2. `cd webapp && pnpm build` — must pass clean
3. Visual verification on mobile viewport (iPhone 14, 390px) in dev mode
4. Test all expand/collapse interactions
5. Verify no regressions on desktop dashboard (the `hidden lg:block` section must be untouched)
