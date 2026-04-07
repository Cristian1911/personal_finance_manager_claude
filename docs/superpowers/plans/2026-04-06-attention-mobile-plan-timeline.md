# Attention Mobile + Plan Timeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile dashboard's single-link attention section with an expandable 3-chip grid (overdue reminders, upcoming payments, pending emails), and rewrite the plan flow chart to combine real past transactions with projected future recurrences plus a cumulative balance line.

**Architecture:** Two independent features. Feature 1 (attention) adds a new server action `getAttentionItems()` returning item-level data, and a new `InicioAttention` component following the `MovimientosHerramientas` grid+accordion pattern. Feature 2 (timeline) adds a `getPlanTimelineData()` server action that merges `getDailyCashflow()` with `getUpcomingRecurrences()`, and rewrites `PlanFlowChart` to render past+future bars with a cumulative balance polyline.

**Tech Stack:** Next.js 15 Server Actions, React 19, Tailwind v4, custom SVG charting, Supabase

**Spec:** `docs/superpowers/specs/2026-04-06-attention-mobile-plan-timeline-design.md`

---

## File Map

### Feature 1: Attention Mobile

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `webapp/src/actions/attention-items.ts` | Server action returning item-level data for 3 signals |
| Create | `webapp/src/components/mobile/v2/inicio/inicio-attention.tsx` | Grid chips + accordion panels with inline actions |
| Modify | `webapp/src/components/mobile/v2/inicio/inicio-root.tsx` | Swap `InicioFocus` → `InicioAttention`, pass new props |
| Modify | `webapp/src/app/(dashboard)/dashboard/page.tsx` | Call `getAttentionItems()`, pass to `InicioRoot` |
| Delete | `webapp/src/components/mobile/v2/inicio/inicio-focus.tsx` | Replaced by `InicioAttention` |

### Feature 2: Plan Timeline

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `webapp/src/actions/plan-timeline.ts` | Server action merging real cashflow + projected recurrences |
| Rewrite | `webapp/src/components/mobile/v2/plan/plan-flow-chart.tsx` | New SVG with past/future bars, balance line, danger zone |
| Modify | `webapp/src/components/mobile/v2/plan/plan-root.tsx` | Pass timeline data to new PlanFlowChart |
| Modify | `webapp/src/app/(dashboard)/plan/page.tsx` | Call `getPlanTimelineData()`, pass to PlanRoot |

---

## Task 1: Server Action — `getAttentionItems()`

**Files:**
- Create: `webapp/src/actions/attention-items.ts`

- [ ] **Step 1: Create the server action file**

```ts
// webapp/src/actions/attention-items.ts
"use server";

import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toISODateString } from "@/lib/utils/date";
import { addDays, format } from "date-fns";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import type { CurrencyCode, UpcomingRecurrence, FinancialReminder, PendingEmailTransaction } from "@/types/domain";
import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";

// ── Types ─────────────────────────────────────────────────

export interface AttentionOverdueReminder {
  id: string;
  title: string;
  amount: number | null;
  currency_code: string;
  due_date: string;
}

export interface AttentionUpcomingPayment {
  templateId: string;
  name: string;
  amount: number;
  next_date: string;
  direction: "INFLOW" | "OUTFLOW";
  occurrenceDate: string;
}

export interface AttentionPendingEmail {
  id: string;
  merchant: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  date: string;
  card_last4: string | null;
  suggested_account_id: string | null;
}

export interface AttentionItems {
  overdueReminders: AttentionOverdueReminder[];
  upcomingPayments: AttentionUpcomingPayment[];
  pendingEmails: AttentionPendingEmail[];
}

// ── Cached inner ──────────────────────────────────────────

async function getAttentionItemsCached(userId: string): Promise<AttentionItems> {
  "use cache";
  cacheTag("attention");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const today = toISODateString(new Date());

  const [remindersRes, emailsRes, upcoming] = await Promise.all([
    // Overdue reminders: incomplete + past due date
    supabase
      .from("financial_reminders")
      .select("id, title, amount, currency_code, due_date")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5),

    // Pending email transactions
    supabase
      .from("pending_email_transactions")
      .select("id, parsed_data, suggested_account_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),

    // Upcoming recurrences within 7 days (reuse existing cached function via admin)
    // We query templates directly here to stay in the admin context
    (async () => {
      const sevenDaysLater = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const { data: templates } = await supabase
        .from("recurring_transaction_templates")
        .select("id, name, amount, direction, frequency, start_date, end_date")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!templates || templates.length === 0) return [];

      // Import occurrence computation
      const { getOccurrencesBetween } = await import("@zeta/shared");
      const now = new Date();
      const rangeEnd = addDays(now, 7);
      const results: AttentionUpcomingPayment[] = [];

      for (const t of templates) {
        const dates = getOccurrencesBetween(
          t.start_date,
          t.frequency,
          t.end_date,
          now,
          rangeEnd
        );
        for (const date of dates) {
          results.push({
            templateId: t.id,
            name: t.name,
            amount: t.amount,
            next_date: date,
            direction: t.direction as "INFLOW" | "OUTFLOW",
            occurrenceDate: date,
          });
        }
      }

      results.sort((a, b) => a.next_date.localeCompare(b.next_date));
      return results.slice(0, 5);
    })(),
  ]);

  // Map overdue reminders
  const overdueReminders: AttentionOverdueReminder[] = (remindersRes.data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    amount: r.amount,
    currency_code: r.currency_code,
    due_date: r.due_date,
  }));

  // Map pending emails
  const pendingEmails: AttentionPendingEmail[] = (emailsRes.data ?? []).map((e) => {
    const parsed = e.parsed_data as ParsedEmailTransaction | null;
    return {
      id: e.id,
      merchant: parsed?.merchant || parsed?.destination || "Sin descripción",
      amount: parsed?.amount ?? 0,
      direction: (parsed?.direction ?? "OUTFLOW") as "INFLOW" | "OUTFLOW",
      date: parsed?.transaction_date ?? new Date().toISOString().slice(0, 10),
      card_last4: parsed?.card_last4 ?? null,
      suggested_account_id: e.suggested_account_id ?? null,
    };
  });

  return { overdueReminders, upcomingPayments: upcoming, pendingEmails };
}

// ── Public wrapper ────────────────────────────────────────

export async function getAttentionItems(): Promise<AttentionItems> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { overdueReminders: [], upcomingPayments: [], pendingEmails: [] };
  try {
    return await getAttentionItemsCached(user.id);
  } catch (err) {
    console.error("Error fetching attention items:", err);
    return { overdueReminders: [], upcomingPayments: [], pendingEmails: [] };
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | grep -i "attention-items" || echo "No errors"`

Check that `getOccurrencesBetween` is exported from `@zeta/shared`. If not, find the correct import path:

```bash
cd webapp && grep -r "getOccurrencesBetween" ../packages/shared/src/ --include="*.ts" -l
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/attention-items.ts
git commit -m "feat: add getAttentionItems server action for mobile attention chips"
```

---

## Task 2: `InicioAttention` Component

**Files:**
- Create: `webapp/src/components/mobile/v2/inicio/inicio-attention.tsx`

- [ ] **Step 1: Create the component**

This follows the exact pattern of `MovimientosHerramientas` (`webapp/src/components/mobile/v2/movimientos/movimientos-herramientas.tsx`): grid of 3 chips + accordion panel below.

```tsx
// webapp/src/components/mobile/v2/inicio/inicio-attention.tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, AlertTriangle, Calendar, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileZone } from "@/components/mobile/v2/mobile-zone";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { toggleReminder } from "@/actions/reminders";
import { approveEmailTransaction, dismissEmailTransaction } from "@/actions/email-ingest";
import { recordRecurringOccurrencePayment } from "@/actions/recurring-templates";
import { toast } from "sonner";
import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";
import type { CurrencyCode } from "@/types/domain";

type AttentionZone = "vencidos" | "pagos" | "emails";

const MAX_ITEMS = 5;

const accentStyles = {
  vencidos: {
    chip: "border-red-500/30 bg-[linear-gradient(180deg,rgba(239,68,68,0.08),transparent)]",
    panel: "border-red-500/20",
    eyebrow: "text-red-500",
    dot: "bg-red-500",
  },
  pagos: {
    chip: "border-z-brass/30 bg-[linear-gradient(180deg,rgba(var(--z-brass-rgb,183,165,122),0.08),transparent)]",
    panel: "border-z-brass/20",
    eyebrow: "text-z-brass",
    dot: "bg-z-brass",
  },
  emails: {
    chip: "border-z-sage/30 bg-[linear-gradient(180deg,rgba(var(--z-sage-rgb,142,168,130),0.08),transparent)]",
    panel: "border-z-sage/20",
    eyebrow: "text-z-sage",
    dot: "bg-z-sage",
  },
} as const;

interface InicioAttentionProps {
  overdueReminders: AttentionOverdueReminder[];
  upcomingPayments: AttentionUpcomingPayment[];
  pendingEmails: AttentionPendingEmail[];
  currency: CurrencyCode;
  expanded: string | null;
  onToggle: (zone: string) => void;
}

export function InicioAttention({
  overdueReminders,
  upcomingPayments,
  pendingEmails,
  currency,
  expanded,
  onToggle,
}: InicioAttentionProps) {
  const totalCount = overdueReminders.length + upcomingPayments.length + pendingEmails.length;
  if (totalCount === 0) return null;

  const activeZone = expanded?.startsWith("attention-")
    ? (expanded.replace("attention-", "") as AttentionZone)
    : null;

  const toggle = (zone: AttentionZone) => onToggle(`attention-${zone}`);
  const isActive = (zone: AttentionZone) => activeZone === zone;
  const activeAccent = activeZone ? accentStyles[activeZone] : null;

  return (
    <MobileZone eyebrow="ATENCIÓN">
      <div className="grid grid-cols-3 gap-1.5">
        {/* Chip: Vencidos */}
        <button
          type="button"
          onClick={() => toggle("vencidos")}
          className={cn(
            "rounded-[14px] border p-2.5 text-center transition-colors",
            isActive("vencidos")
              ? accentStyles.vencidos.chip
              : overdueReminders.length > 0
                ? accentStyles.vencidos.chip
                : PANEL_INSET_CLASS
          )}
          aria-expanded={isActive("vencidos")}
        >
          <p className={cn("text-[22px] font-[680] leading-tight", overdueReminders.length > 0 ? "text-red-500" : "text-foreground")}>
            {overdueReminders.length}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Vencidos</p>
          {overdueReminders.length > 0 && (
            <p className="mt-1 flex items-center justify-center gap-1 text-[9px] text-red-500">
              <span className="inline-block size-1.5 rounded-full bg-red-500" />
              por resolver
            </p>
          )}
        </button>

        {/* Chip: Pagos */}
        <button
          type="button"
          onClick={() => toggle("pagos")}
          className={cn(
            "rounded-[14px] border p-2.5 text-center transition-colors",
            isActive("pagos") ? accentStyles.pagos.chip : PANEL_INSET_CLASS
          )}
          aria-expanded={isActive("pagos")}
        >
          <p className="text-[22px] font-[680] leading-tight">{upcomingPayments.length}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Pagos</p>
          <p className="mt-1 text-[9px] text-muted-foreground">en 7 días</p>
        </button>

        {/* Chip: Emails */}
        <button
          type="button"
          onClick={() => toggle("emails")}
          className={cn(
            "rounded-[14px] border p-2.5 text-center transition-colors",
            isActive("emails") ? accentStyles.emails.chip : PANEL_INSET_CLASS
          )}
          aria-expanded={isActive("emails")}
        >
          <p className="text-[22px] font-[680] leading-tight">{pendingEmails.length}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Emails</p>
          <p className="mt-1 text-[9px] text-muted-foreground">
            {pendingEmails.length > 0 ? "sin revisar" : "sin pendientes"}
          </p>
        </button>
      </div>

      {/* Accordion panel */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: activeZone ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={cn("mt-1.5 transition-opacity duration-150", activeZone ? "opacity-100 delay-75" : "opacity-0")}>
            {activeZone && (
              <div className={cn(PANEL_INSET_CLASS, "border-white/8 bg-black/20 p-3", activeAccent?.panel)}>
                {activeZone === "vencidos" && (
                  <VencidosDetail reminders={overdueReminders} currency={currency} />
                )}
                {activeZone === "pagos" && (
                  <PagosDetail payments={upcomingPayments} currency={currency} />
                )}
                {activeZone === "emails" && (
                  <EmailsDetail emails={pendingEmails} currency={currency} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileZone>
  );
}

/* ─── Vencidos Detail ─────────────────────────────────────── */

function VencidosDetail({
  reminders,
  currency,
}: {
  reminders: AttentionOverdueReminder[];
  currency: CurrencyCode;
}) {
  const [isPending, startTransition] = useTransition();
  const items = reminders.slice(0, MAX_ITEMS);

  function handleComplete(id: string) {
    startTransition(async () => {
      const result = await toggleReminder(id);
      if (result.success) {
        toast.success("Marcado como hecho");
      } else {
        toast.error(result.error ?? "Error");
      }
    });
  }

  function handlePostpone(id: string) {
    // Postpone by 1 day: update due_date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formData = new FormData();
    // We only need to call updateReminder with the new due_date
    // But updateReminder expects FormData with all fields.
    // Simpler: use a direct supabase update via a small dedicated action.
    // For now, just toggle + toast explaining.
    startTransition(async () => {
      // Import postponeReminder inline to avoid circular deps
      const { postponeReminder } = await import("@/actions/reminders");
      const result = await postponeReminder(id);
      if (result.success) {
        toast.success("Pospuesto 1 día");
      } else {
        toast.error(result.error ?? "Error");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-500">Pendientes vencidos</p>
        <p className="text-xs text-z-sage-light">Sin pendientes vencidos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-500">Pendientes vencidos</p>
      <div className={cn("space-y-0.5", isPending && "pointer-events-none opacity-60")}>
        {items.map((r) => {
          const daysOverdue = Math.ceil((Date.now() - new Date(r.due_date).getTime()) / 86_400_000);
          const overdueLabel = daysOverdue === 1 ? "Ayer" : `Hace ${daysOverdue} días`;
          return (
            <div key={r.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400">
                <AlertTriangle className="size-3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{r.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {overdueLabel}
                  {r.amount != null && ` · ${formatCurrency(r.amount, currency)}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleComplete(r.id)}
                  className="rounded-lg bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400"
                >
                  Hecho
                </button>
                <button
                  type="button"
                  onClick={() => handlePostpone(r.id)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-muted-foreground"
                >
                  Posponer
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">{items.length} de {reminders.length}</p>
        <Link href="/pendientes" className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500">
          Ir a pendientes <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Pagos Detail ────────────────────────────────────────── */

function PagosDetail({
  payments,
  currency,
}: {
  payments: AttentionUpcomingPayment[];
  currency: CurrencyCode;
}) {
  const [isPending, startTransition] = useTransition();
  const items = payments.slice(0, MAX_ITEMS);
  const totalAmount = payments.filter((p) => p.direction === "OUTFLOW").reduce((s, p) => s + p.amount, 0);

  function handleRegister(p: AttentionUpcomingPayment) {
    startTransition(async () => {
      const result = await recordRecurringOccurrencePayment({
        templateId: p.templateId,
        occurrenceDate: p.occurrenceDate,
        actualAmount: p.amount,
      });
      if (result.success) {
        toast.success("Pago registrado");
      } else {
        toast.error(result.error ?? "Error al registrar");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">Próximos 7 días</p>
        <p className="text-xs text-z-sage-light">Sin pagos próximos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">Próximos 7 días</p>
      <div className={cn("space-y-0.5", isPending && "pointer-events-none opacity-60")}>
        {items.map((p, i) => {
          const daysUntil = Math.ceil((new Date(p.next_date).getTime() - Date.now()) / 86_400_000);
          const daysLabel = daysUntil === 0 ? "Hoy" : daysUntil === 1 ? "Mañana" : `En ${daysUntil} días`;
          return (
            <div key={`${p.templateId}-${p.next_date}-${i}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-z-brass/10 text-z-brass">
                <Calendar className="size-3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{daysLabel}</p>
              </div>
              <p className="shrink-0 text-xs font-semibold tabular-nums">{formatCurrency(p.amount, currency)}</p>
              <button
                type="button"
                onClick={() => handleRegister(p)}
                className="shrink-0 rounded-lg bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400"
              >
                Registrar
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">
          {items.length} de {payments.length} · Total: {formatCurrency(totalAmount, currency)}
        </p>
        <Link href="/recurrentes" className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass">
          Ver todos <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Emails Detail ───────────────────────────────────────── */

function EmailsDetail({
  emails,
  currency,
}: {
  emails: AttentionPendingEmail[];
  currency: CurrencyCode;
}) {
  const [isPending, startTransition] = useTransition();
  const items = emails.slice(0, MAX_ITEMS);

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveEmailTransaction(id);
      if (result.success) {
        toast.success("Importada");
      } else {
        toast.error(result.error ?? "Error al importar");
      }
    });
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      const result = await dismissEmailTransaction(id);
      if (result.success) {
        toast.success("Descartada");
      } else {
        toast.error(result.error ?? "Error al descartar");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-sage">Pendientes por correo</p>
        <p className="text-xs text-z-sage-light">No hay emails pendientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-sage">Pendientes por correo</p>
      <div className={cn("space-y-0.5", isPending && "pointer-events-none opacity-60")}>
        {items.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
            <div className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md",
              e.direction === "OUTFLOW" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
            )}>
              <Mail className="size-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">{e.merchant}</p>
              <p className="text-[10px] text-muted-foreground">
                {e.card_last4 && `*${e.card_last4} · `}{e.date.slice(8, 10)}/{e.date.slice(5, 7)}
              </p>
            </div>
            <p className={cn("shrink-0 text-xs font-semibold tabular-nums", e.direction === "INFLOW" && "text-green-400")}>
              {formatCurrency(e.amount, currency)}
            </p>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => handleApprove(e.id)}
                className="rounded-lg bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400"
              >
                Importar
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(e.id)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-1 text-[10px] text-muted-foreground"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">{emails.length} pendiente{emails.length !== 1 ? "s" : ""}</p>
        <Link href="/movimientos" className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-sage-light">
          Ver movimientos <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
```

**Note:** The `postponeReminder` function does not exist yet. We need to add it in the next step.

- [ ] **Step 2: Add `postponeReminder` action to `reminders.ts`**

Add this function to `webapp/src/actions/reminders.ts` after the `toggleReminder` function (around line 132):

```ts
export async function postponeReminder(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const newDate = tomorrow.toISOString().slice(0, 10);

  const { error } = await supabase
    .from("financial_reminders")
    .update({ due_date: newDate })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("reminders", "zeta");
  revalidateTag("attention", "zeta");
  return { success: true, data: null };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-attention.tsx webapp/src/actions/reminders.ts
git commit -m "feat: add InicioAttention component with expandable chip grid + postponeReminder action"
```

---

## Task 3: Wire Attention Into Dashboard

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-root.tsx`
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`
- Delete: `webapp/src/components/mobile/v2/inicio/inicio-focus.tsx`

- [ ] **Step 1: Update `InicioRootProps` and component**

In `webapp/src/components/mobile/v2/inicio/inicio-root.tsx`:

1. Remove the `InicioFocus` import and replace with `InicioAttention`
2. Replace `signals: AttentionSignal[]` with the new attention items props
3. Swap `<InicioFocus>` for `<InicioAttention>` in the render

```tsx
// Replace import
// REMOVE: import { InicioFocus } from "./inicio-focus";
// REMOVE: import type { AttentionSignal } from "@/types/attention";
// ADD:
import { InicioAttention } from "./inicio-attention";
import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";

// In InicioRootProps, replace:
//   signals: AttentionSignal[];
// With:
  attentionItems: {
    overdueReminders: AttentionOverdueReminder[];
    upcomingPayments: AttentionUpcomingPayment[];
    pendingEmails: AttentionPendingEmail[];
  };

// In the component destructuring, replace `signals` with `attentionItems`

// In the JSX, replace:
//   <InicioFocus signals={signals} />
// With:
      <InicioAttention
        overdueReminders={attentionItems.overdueReminders}
        upcomingPayments={attentionItems.upcomingPayments}
        pendingEmails={attentionItems.pendingEmails}
        currency={currency}
        expanded={activeZone}
        onToggle={toggle}
      />
```

- [ ] **Step 2: Update `dashboard/page.tsx` to fetch and pass attention items**

In `webapp/src/app/(dashboard)/dashboard/page.tsx`:

1. Add import: `import { getAttentionItems } from "@/actions/attention-items";`
2. Add `getAttentionItems()` call to the existing `Promise.all` batch where other data is fetched
3. Replace `signals={attentionSnapshot.signals}` with `attentionItems={attentionItems}` in the `InicioRoot` props

Find the `Promise.all` block that fetches tier-1 data and add `getAttentionItems()` to it. Then pass the result to `InicioRoot`.

- [ ] **Step 3: Delete `inicio-focus.tsx`**

```bash
rm webapp/src/components/mobile/v2/inicio/inicio-focus.tsx
```

- [ ] **Step 4: Verify build compiles**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -30`

Fix any type errors from the prop changes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire InicioAttention into dashboard, remove InicioFocus"
```

---

## Task 4: Server Action — `getPlanTimelineData()`

**Files:**
- Create: `webapp/src/actions/plan-timeline.ts`

- [ ] **Step 1: Create the server action**

```ts
// webapp/src/actions/plan-timeline.ts
"use server";

import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDailyCashflow, type DailyCashflow } from "@/actions/charts";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import { getAccounts } from "@/actions/accounts";
import type { CurrencyCode } from "@/types/domain";

// ── Types ─────────────────────────────────────────────────

export interface TimelineDay {
  day: number;
  income: number;
  expense: number;
  isReal: boolean;
}

export interface PlanTimelineData {
  days: TimelineDay[];
  cumulativeBalance: Array<{ day: number; balance: number }>;
  startingBalance: number;
  totalIncome: number;
  totalExpense: number;
  dangerZone: { startDay: number; endDay: number } | null;
  daysInMonth: number;
  dayOfMonth: number;
}

// ── Implementation ────────────────────────────────────────

export async function getPlanTimelineData(
  month?: string,
  currency?: CurrencyCode
): Promise<PlanTimelineData> {
  const { user } = await getAuthenticatedClient();
  if (!user) {
    return emptyTimeline();
  }

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Fetch real cashflow (income+expenses per day) and upcoming recurrences in parallel
  const [dailyCashflow, upcoming, accounts] = await Promise.all([
    getDailyCashflow(month),
    getUpcomingRecurrences(daysInMonth - dayOfMonth + 1), // remaining days in month
    getAccounts(),
  ]);

  // Compute starting balance: sum of all liquid account balances
  const liquidTypes = new Set(["SAVINGS", "CHECKING", "CASH"]);
  const startingBalance = accounts
    .filter((a) => liquidTypes.has(a.account_type))
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

  // Build day map from real data (dailyCashflow covers full month, all days)
  const dayMap = new Map<number, TimelineDay>();

  for (const dc of dailyCashflow) {
    const day = parseInt(dc.date.slice(8, 10), 10);
    if (day <= dayOfMonth && (dc.income > 0 || dc.expenses > 0)) {
      dayMap.set(day, {
        day,
        income: dc.income,
        expense: dc.expenses,
        isReal: true,
      });
    }
  }

  // Add projected data from upcoming recurrences (future only)
  for (const item of upcoming) {
    const day = parseInt(item.next_date.slice(8, 10), 10);
    if (day <= dayOfMonth) continue; // skip past days, we have real data

    const existing = dayMap.get(day) ?? { day, income: 0, expense: 0, isReal: false };
    if (item.template.direction === "INFLOW") {
      existing.income += item.template.amount;
    } else {
      existing.expense += item.template.amount;
    }
    existing.isReal = false;
    dayMap.set(day, existing);
  }

  // Sort by day
  const days = Array.from(dayMap.values()).sort((a, b) => a.day - b.day);

  // Compute cumulative balance
  // We need to derive the balance at start of month from current balance
  // Approach: current balance = startingBalance + sum(real income) - sum(real expenses) for past days
  // So balance at day 0 = current balance - past net
  const pastNet = days
    .filter((d) => d.isReal)
    .reduce((sum, d) => sum + d.income - d.expense, 0);
  const balanceAtMonthStart = startingBalance - pastNet;

  let runningBalance = balanceAtMonthStart;
  const cumulativeBalance: Array<{ day: number; balance: number }> = [];

  // Walk through all days that have activity
  for (const d of days) {
    runningBalance += d.income - d.expense;
    cumulativeBalance.push({ day: d.day, balance: runningBalance });
  }

  // Compute totals
  const totalIncome = days.reduce((s, d) => s + d.income, 0);
  const totalExpense = days.reduce((s, d) => s + d.expense, 0);

  // Find danger zone (consecutive days where balance is below zero)
  let dangerZone: { startDay: number; endDay: number } | null = null;
  let dangerStart: number | null = null;

  for (const cb of cumulativeBalance) {
    if (cb.balance < 0) {
      if (dangerStart === null) dangerStart = cb.day;
    } else {
      if (dangerStart !== null) {
        const prev = cumulativeBalance.find((c) => c.day < cb.day && c.balance < 0);
        if (prev) {
          dangerZone = { startDay: dangerStart, endDay: prev.day };
        }
        dangerStart = null;
      }
    }
  }
  // If still in danger at end of month
  if (dangerStart !== null) {
    const lastDay = cumulativeBalance[cumulativeBalance.length - 1]?.day ?? daysInMonth;
    dangerZone = { startDay: dangerStart, endDay: lastDay };
  }

  return {
    days,
    cumulativeBalance,
    startingBalance: balanceAtMonthStart,
    totalIncome,
    totalExpense,
    dangerZone,
    daysInMonth,
    dayOfMonth,
  };
}

function emptyTimeline(): PlanTimelineData {
  const now = new Date();
  return {
    days: [],
    cumulativeBalance: [],
    startingBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    dangerZone: null,
    daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    dayOfMonth: now.getDate(),
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/plan-timeline.ts
git commit -m "feat: add getPlanTimelineData server action merging real + projected cashflow"
```

---

## Task 5: Rewrite `PlanFlowChart`

**Files:**
- Rewrite: `webapp/src/components/mobile/v2/plan/plan-flow-chart.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire file with the new implementation that renders:
- Vertical bars (income up, expenses down) centered on active days
- Horizontal brass zero line ("the point")
- Vertical dashed "today" divider
- Past bars at full opacity, future bars at reduced opacity with dashed stroke
- Brass cumulative balance polyline (solid past, dashed future)
- Red gradient danger zone overlay
- Summary row (Ingresos / Gastos / Neto)
- Warning chip when danger zone exists

```tsx
// webapp/src/components/mobile/v2/plan/plan-flow-chart.tsx
"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { MobileZone } from "@/components/mobile/v2/mobile-zone";
import type { PlanTimelineData } from "@/actions/plan-timeline";
import type { CurrencyCode } from "@/types/domain";

interface PlanFlowChartProps {
  timelineData: PlanTimelineData;
  currency: CurrencyCode;
}

export function PlanFlowChart({ timelineData, currency }: PlanFlowChartProps) {
  const { days, cumulativeBalance, totalIncome, totalExpense, dangerZone, daysInMonth, dayOfMonth } = timelineData;

  const { maxVal, balancePoints, todayX, barPositions } = useMemo(() => {
    if (days.length === 0) {
      return { maxVal: 1, balancePoints: "", todayX: 0, barPositions: [] };
    }

    // Chart dimensions
    const W = 360;
    const padL = 32;
    const padR = 10;
    const usableW = W - padL - padR;

    // Find max value for scaling
    let mv = 0;
    for (const d of days) {
      mv = Math.max(mv, d.income, d.expense);
    }
    // Also consider balance range for the zero line position
    let maxBalance = 0;
    let minBalance = 0;
    for (const cb of cumulativeBalance) {
      maxBalance = Math.max(maxBalance, cb.balance);
      minBalance = Math.min(minBalance, cb.balance);
    }
    mv = Math.max(mv, 1);

    // Position each bar along X axis
    const positions = days.map((d) => ({
      ...d,
      x: padL + ((d.day - 1) / Math.max(daysInMonth - 1, 1)) * usableW,
    }));

    // Today position
    const tx = padL + ((dayOfMonth - 1) / Math.max(daysInMonth - 1, 1)) * usableW;

    // Balance polyline points
    const BASELINE_Y = 90;
    const scaleBalance = 55 / Math.max(Math.abs(maxBalance), Math.abs(minBalance), mv, 1);
    const bp = cumulativeBalance
      .map((cb) => {
        const bx = padL + ((cb.day - 1) / Math.max(daysInMonth - 1, 1)) * usableW;
        const by = BASELINE_Y - cb.balance * scaleBalance;
        return `${bx},${by}`;
      })
      .join(" ");

    return { maxVal: mv, balancePoints: bp, todayX: tx, barPositions: positions };
  }, [days, cumulativeBalance, daysInMonth, dayOfMonth]);

  if (days.length === 0) {
    return (
      <MobileZone eyebrow="FLUJO DEL MES">
        <div className={cn(PANEL_INSET_CLASS, "py-8 text-center text-xs text-muted-foreground")}>
          Sin pagos o ingresos en este mes
        </div>
      </MobileZone>
    );
  }

  // SVG constants
  const W = 360;
  const H = 180;
  const BASELINE_Y = 90;
  const padL = 32;
  const padR = 10;
  const padT = 15;
  const usableW = W - padL - padR;
  const barW = Math.min(12, usableW / (days.length * 2.5));
  const scaleUp = (BASELINE_Y - padT) / maxVal;
  const scaleDown = (H - BASELINE_Y - 30) / maxVal;

  // Danger zone X positions
  const dangerX1 = dangerZone
    ? padL + ((dangerZone.startDay - 1) / Math.max(daysInMonth - 1, 1)) * usableW
    : 0;
  const dangerX2 = dangerZone
    ? padL + ((dangerZone.endDay - 1) / Math.max(daysInMonth - 1, 1)) * usableW
    : 0;

  // Split balance polyline into past/future
  const pastBalancePoints = cumulativeBalance
    .filter((cb) => cb.day <= dayOfMonth)
    .map((cb) => {
      const bx = padL + ((cb.day - 1) / Math.max(daysInMonth - 1, 1)) * usableW;
      const scaleB = 55 / Math.max(
        ...cumulativeBalance.map((c) => Math.abs(c.balance)),
        maxVal,
        1
      );
      return `${bx},${BASELINE_Y - cb.balance * scaleB}`;
    })
    .join(" ");

  const futureBalancePoints = cumulativeBalance
    .filter((cb) => cb.day >= dayOfMonth)
    .map((cb) => {
      const bx = padL + ((cb.day - 1) / Math.max(daysInMonth - 1, 1)) * usableW;
      const scaleB = 55 / Math.max(
        ...cumulativeBalance.map((c) => Math.abs(c.balance)),
        maxVal,
        1
      );
      return `${bx},${BASELINE_Y - cb.balance * scaleB}`;
    })
    .join(" ");

  return (
    <MobileZone eyebrow="FLUJO DEL MES">
      <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold">Ingresos vs Gastos</span>
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-[7px] rounded-full bg-z-income" /> Ingreso
            </span>
            <span className="flex items-center gap-1">
              <span className="size-[7px] rounded-full bg-z-debt" /> Gasto
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-[2px] w-2 bg-z-brass" /> Saldo
            </span>
          </div>
        </div>

        {/* Chart */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
          <defs>
            <linearGradient id="dangerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padL} y1={30} x2={W - padR} y2={30} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1={padL} y1={60} x2={W - padR} y2={60} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <line x1={padL} y1={120} x2={W - padR} y2={120} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />

          {/* ZERO LINE — "the point" */}
          <line x1={padL} y1={BASELINE_Y} x2={W - padR} y2={BASELINE_Y} stroke="var(--z-brass)" strokeWidth="1.5" strokeOpacity="0.4" />
          <text x={padL - 4} y={BASELINE_Y + 3} fill="var(--z-brass)" fontSize="7" textAnchor="end" fontWeight="600">$0</text>

          {/* Y axis labels */}
          <text x={padL - 4} y={padT + 4} fill="var(--z-sage-dark)" fontSize="6.5" textAnchor="end">
            {formatCurrency(maxVal, currency)}
          </text>

          {/* Today marker */}
          <line x1={todayX} y1={padT - 2} x2={todayX} y2={H - 18} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,3" />
          <text x={todayX} y={H - 6} fill="var(--z-sage-light)" fontSize="7" textAnchor="middle" fontWeight="600">Hoy</text>

          {/* Danger zone */}
          {dangerZone && (
            <rect
              x={dangerX1}
              y={BASELINE_Y}
              width={Math.max(dangerX2 - dangerX1, 10)}
              height={H - BASELINE_Y - 20}
              fill="url(#dangerGrad)"
              opacity="0.12"
            />
          )}

          {/* Bars */}
          {barPositions.map((bar) => {
            const isPast = bar.day <= dayOfMonth;
            return (
              <g key={bar.day}>
                {bar.income > 0 && (
                  <rect
                    x={bar.x - barW / 2}
                    y={BASELINE_Y - bar.income * scaleUp}
                    width={barW}
                    height={bar.income * scaleUp}
                    rx={3}
                    fill="var(--z-income)"
                    opacity={isPast ? 0.85 : 0.35}
                    {...(!isPast && {
                      stroke: "var(--z-income)",
                      strokeWidth: 0.5,
                      strokeOpacity: 0.3,
                      strokeDasharray: "2,2",
                    })}
                  />
                )}
                {bar.expense > 0 && (
                  <rect
                    x={bar.x - barW / 2}
                    y={BASELINE_Y}
                    width={barW}
                    height={bar.expense * scaleDown}
                    rx={3}
                    fill="var(--z-debt)"
                    opacity={isPast ? 0.75 : 0.35}
                    {...(!isPast && {
                      stroke: "var(--z-debt)",
                      strokeWidth: 0.5,
                      strokeOpacity: 0.3,
                      strokeDasharray: "2,2",
                    })}
                  />
                )}
                {/* Day label — only show for a subset to avoid clutter */}
                {(bar.day === 1 || bar.day % 5 === 0 || bar.day === daysInMonth) && bar.day !== dayOfMonth && (
                  <text x={bar.x} y={H - 6} fill="var(--z-sage-dark)" fontSize="6" textAnchor="middle">{bar.day}</text>
                )}
              </g>
            );
          })}

          {/* Balance line — past (solid) */}
          {pastBalancePoints && (
            <polyline
              points={pastBalancePoints}
              fill="none"
              stroke="var(--z-brass)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.7"
            />
          )}

          {/* Balance line — future (dashed) */}
          {futureBalancePoints && (
            <polyline
              points={futureBalancePoints}
              fill="none"
              stroke="var(--z-brass)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="4,3"
              opacity="0.5"
            />
          )}
        </svg>

        {/* Summary row */}
        <div className="mt-2 flex gap-2 border-t border-white/6 pt-2">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground">Ingresos</p>
            <p className="text-sm font-semibold tabular-nums text-z-income">{formatCurrency(totalIncome, currency)}</p>
          </div>
          <div className="w-px bg-white/6" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground">Gastos</p>
            <p className="text-sm font-semibold tabular-nums text-z-debt">{formatCurrency(totalExpense, currency)}</p>
          </div>
          <div className="w-px bg-white/6" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground">Neto</p>
            <p className={cn(
              "text-sm font-semibold tabular-nums",
              totalIncome - totalExpense >= 0 ? "text-z-brass" : "text-red-500"
            )}>
              {totalIncome - totalExpense >= 0 ? "+" : ""}{formatCurrency(totalIncome - totalExpense, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Warning chip */}
      {dangerZone && (
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/5 px-3 py-2">
          <span className="text-xs">⚠</span>
          <span className="text-[11px] text-red-500">
            Saldo negativo proyectado del {dangerZone.startDay} al {dangerZone.endDay} de este mes
          </span>
        </div>
      )}
    </MobileZone>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-flow-chart.tsx
git commit -m "feat: rewrite PlanFlowChart with real+projected data, balance line, danger zone"
```

---

## Task 6: Wire Timeline Into Plan Page

**Files:**
- Modify: `webapp/src/components/mobile/v2/plan/plan-root.tsx`
- Modify: `webapp/src/app/(dashboard)/plan/page.tsx`

- [ ] **Step 1: Update `PlanRoot` props and component**

In `webapp/src/components/mobile/v2/plan/plan-root.tsx`:

1. Replace the `PlanFlowChart` import to use the new props
2. Add `timelineData` to `PlanRootProps`
3. Remove old `upcoming`, `daysInMonth`, `dayOfMonth` props from `PlanFlowChart` usage
4. Pass `timelineData` and `currency` to the new `PlanFlowChart`

```tsx
// In PlanRootProps, add:
import type { PlanTimelineData } from "@/actions/plan-timeline";

interface PlanRootProps {
  planData: PlanPageData;
  allocationData: AllocationData | null;
  timelineData: PlanTimelineData;  // ADD THIS
  currency: CurrencyCode;
  monthLabel: string;
  dayOfMonth: number;
  daysInMonth: number;
  categories: CategoryBudgetData[];
}

// In the JSX, replace:
//   <PlanFlowChart
//     upcoming={planData.recurring.upcoming}
//     currency={currency}
//     daysInMonth={daysInMonth}
//     dayOfMonth={dayOfMonth}
//   />
// With:
      <PlanFlowChart
        timelineData={timelineData}
        currency={currency}
      />
```

- [ ] **Step 2: Update `plan/page.tsx` to fetch timeline data**

In `webapp/src/app/(dashboard)/plan/page.tsx`:

1. Add import: `import { getPlanTimelineData } from "@/actions/plan-timeline";`
2. Add `getPlanTimelineData(month, currency)` to the existing `Promise.all`
3. Pass `timelineData` to `PlanRoot`

```tsx
// In the Promise.all, add getPlanTimelineData:
const [planData, rhythmResult, categoryBudgetResult, timelineData] = await Promise.all([
  getPlanPageData(month, currency),
  getCategoriesByRhythm(month, currency),
  getCategoriesWithBudgetData(month, currency),
  getPlanTimelineData(month, currency),
]);

// In PlanRoot props, add:
<PlanRoot
  planData={planData}
  allocationData={allocationData}
  timelineData={timelineData}   // ADD THIS
  currency={planData.currency}
  monthLabel={monthLabel}
  dayOfMonth={planDayOfMonth}
  daysInMonth={planDaysInMonth}
  categories={categoryBudgetData}
/>
```

- [ ] **Step 3: Verify build compiles**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-root.tsx webapp/src/app/\(dashboard\)/plan/page.tsx
git commit -m "feat: wire plan timeline data into PlanRoot and page"
```

---

## Task 7: Build Verification

- [ ] **Step 1: Install dependencies (if any were added)**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm install
```

- [ ] **Step 2: Full production build**

```bash
cd webapp && pnpm build
```

Fix any build errors. Common issues:
- Unused imports from old `InicioFocus` references
- Type mismatches in props after swapping components
- Missing `postponeReminder` export

- [ ] **Step 3: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors from attention + timeline integration"
```

---

## Task 8: Mark MANUAL_TODOS as done

- [ ] **Step 1: Update MANUAL_TODOS.md**

Mark item #15 (attention section) and #18 (flow diagram) as done:

```markdown
- [x] En el dashboard, la sección de atención... (Resuelto: InicioAttention con 3 chips expandibles — vencidos, pagos, emails — con acciones inline)
- [x] También debemos conectar el diagrama de flujo... (Resuelto: PlanFlowChart reescrito con datos reales + proyectados, línea de saldo acumulado, zona de peligro)
```

- [ ] **Step 2: Commit**

```bash
git add MANUAL_TODOS.md
git commit -m "docs: mark attention section and flow diagram TODOs as resolved"
```
