"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileZone } from "@/components/mobile/v2/mobile-zone";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { toggleReminder, postponeReminder } from "@/actions/reminders";
import { recordRecurringOccurrencePayment } from "@/actions/recurring-templates";
import {
  approveEmailTransaction,
  dismissEmailTransaction,
} from "@/actions/email-ingest";
import { toast } from "sonner";
import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";
import type { CurrencyCode } from "@/types/domain";

const MAX_ITEMS = 5;

// ─── Types ─────────────────────────────────────────────────────────────────────

type AttentionZone = "vencidos" | "pagos" | "emails";

interface InicioAttentionProps {
  overdueReminders: AttentionOverdueReminder[];
  upcomingPayments: AttentionUpcomingPayment[];
  pendingEmails: AttentionPendingEmail[];
  currency: CurrencyCode;
  expanded: string | null;
  onToggle: (zone: string) => void;
}

// ─── Accent styles ─────────────────────────────────────────────────────────────

const accentStyles = {
  vencidos: {
    chip: "border-red-500/30 bg-[linear-gradient(180deg,rgba(239,68,68,0.08),transparent)]",
    panel: "border-red-500/20",
    eyebrow: "text-red-500",
  },
  pagos: {
    chip: "border-z-brass/30 bg-[linear-gradient(180deg,rgba(var(--z-brass-rgb,183,165,122),0.08),transparent)]",
    panel: "border-z-brass/20",
    eyebrow: "text-z-brass",
  },
  emails: {
    chip: "border-z-sage/30 bg-[linear-gradient(180deg,rgba(var(--z-sage-rgb,142,168,130),0.08),transparent)]",
    panel: "border-z-sage/20",
    eyebrow: "text-z-sage",
  },
} as const;

// ─── Main component ────────────────────────────────────────────────────────────

export function InicioAttention({
  overdueReminders,
  upcomingPayments,
  pendingEmails,
  currency,
  expanded,
  onToggle,
}: InicioAttentionProps) {
  const totalCount =
    overdueReminders.length + upcomingPayments.length + pendingEmails.length;

  if (totalCount === 0) return null;

  // Extract active zone from namespaced expanded string
  const activeZone = expanded?.startsWith("attention-")
    ? (expanded.replace("attention-", "") as AttentionZone)
    : null;

  const toggle = (zone: AttentionZone) => onToggle(`attention-${zone}`);
  const isActive = (zone: AttentionZone) => activeZone === zone;
  const activeAccent = activeZone ? accentStyles[activeZone] : null;

  return (
    <MobileZone eyebrow="ATENCION">
      <div className="grid grid-cols-3 gap-1.5">
        {/* Vencidos chip */}
        <button
          type="button"
          onClick={() => toggle("vencidos")}
          className={cn(
            "rounded-[14px] border p-2.5 text-center transition-colors",
            isActive("vencidos")
              ? accentStyles.vencidos.chip
              : cn(PANEL_INSET_CLASS)
          )}
          aria-expanded={isActive("vencidos")}
        >
          <p className="text-[22px] font-[680] leading-tight text-red-500">
            {overdueReminders.length}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Vencidos
          </p>
          {overdueReminders.length > 0 && (
            <p className="mt-1 flex items-center justify-center gap-1 text-[9px] text-red-400">
              <span className="inline-block size-1.5 rounded-full bg-red-500" />
              por resolver
            </p>
          )}
        </button>

        {/* Pagos chip */}
        <button
          type="button"
          onClick={() => toggle("pagos")}
          className={cn(
            "rounded-[14px] border p-2.5 text-center transition-colors",
            isActive("pagos")
              ? accentStyles.pagos.chip
              : cn(PANEL_INSET_CLASS)
          )}
          aria-expanded={isActive("pagos")}
        >
          <p className="text-[22px] font-[680] leading-tight text-z-brass">
            {upcomingPayments.length}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Pagos
          </p>
          <p className="mt-1 text-[9px] text-muted-foreground">
            en 7 dias
          </p>
        </button>

        {/* Emails chip */}
        <button
          type="button"
          onClick={() => toggle("emails")}
          className={cn(
            "rounded-[14px] border p-2.5 text-center transition-colors",
            isActive("emails")
              ? accentStyles.emails.chip
              : cn(PANEL_INSET_CLASS)
          )}
          aria-expanded={isActive("emails")}
        >
          <p className="text-[22px] font-[680] leading-tight text-z-sage">
            {pendingEmails.length}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Emails
          </p>
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
          <div
            className={cn(
              "mt-1.5 transition-opacity duration-150",
              activeZone ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {activeZone && (
              <div
                className={cn(
                  PANEL_INSET_CLASS,
                  "border-white/8 bg-black/20 p-3",
                  activeAccent?.panel
                )}
              >
                {activeZone === "vencidos" && (
                  <VencidosDetail
                    reminders={overdueReminders}
                    currency={currency}
                  />
                )}
                {activeZone === "pagos" && (
                  <PagosDetail
                    payments={upcomingPayments}
                    currency={currency}
                  />
                )}
                {activeZone === "emails" && (
                  <EmailsDetail
                    emails={pendingEmails}
                    currency={currency}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileZone>
  );
}

// ─── Action pill ───────────────────────────────────────────────────────────────

function ActionPill({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger" | "success";
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded-lg border px-2 py-0.5 text-[10px] transition-colors",
        variant === "danger"
          ? "border-red-500/20 bg-red-500/5 text-red-400"
          : variant === "success"
            ? "border-green-500/20 bg-green-500/5 text-green-400"
            : "border-white/10 bg-white/[0.03] text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ─── Direction icon ────────────────────────────────────────────────────────────

function DirectionIcon({ direction }: { direction: "OUTFLOW" | "INFLOW" }) {
  const isOutflow = direction === "OUTFLOW";
  return (
    <div
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md",
        isOutflow
          ? "bg-red-500/10 text-red-400"
          : "bg-green-500/10 text-green-400"
      )}
    >
      {isOutflow ? (
        <ArrowUpRight className="size-3" />
      ) : (
        <ArrowDownLeft className="size-3" />
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysAgoLabel(dateStr: string): string {
  const due = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Hace 1 dia";
  return `Hace ${diff} dias`;
}

function daysUntilLabel(dateStr: string): string {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Manana";
  return `En ${diff} dias`;
}

// ─── Vencidos detail ───────────────────────────────────────────────────────────

function VencidosDetail({
  reminders,
  currency,
}: {
  reminders: AttentionOverdueReminder[];
  currency: CurrencyCode;
}) {
  const [isPending, startTransition] = useTransition();
  const items = reminders.slice(0, MAX_ITEMS);
  const totalCount = reminders.length;

  function handleDone(id: string) {
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
    startTransition(async () => {
      const result = await postponeReminder(id);
      if (result.success) {
        toast.success("Pospuesto a manana");
      } else {
        toast.error(result.error ?? "Error al posponer");
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-500">
        Recordatorios vencidos
      </p>

      <div
        className={cn(
          "space-y-0.5",
          isPending && "pointer-events-none opacity-60"
        )}
      >
        {items.map((r) => {
          const amountStr = r.amount
            ? formatCurrency(r.amount, currency)
            : null;
          return (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-lg px-1.5 py-1.5"
            >
              <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-red-500/10">
                <AlertTriangle className="size-3 text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{r.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {daysAgoLabel(r.due_date)}
                  {amountStr && (
                    <span className="ml-1.5 font-semibold tabular-nums">
                      {amountStr}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ActionPill onClick={() => handleDone(r.id)} variant="success">
                  Hecho
                </ActionPill>
                <ActionPill onClick={() => handlePostpone(r.id)}>
                  Posponer
                </ActionPill>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">
          {items.length} de {totalCount}
        </p>
        <Link
          href="/pendientes"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400"
        >
          Ir a pendientes
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── Pagos detail ──────────────────────────────────────────────────────────────

function PagosDetail({
  payments,
  currency,
}: {
  payments: AttentionUpcomingPayment[];
  currency: CurrencyCode;
}) {
  const [isPending, startTransition] = useTransition();
  const items = payments.slice(0, MAX_ITEMS);
  const totalCount = payments.length;
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  function handleRecord(p: AttentionUpcomingPayment) {
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

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
        Pagos proximos
      </p>

      <div
        className={cn(
          "space-y-0.5",
          isPending && "pointer-events-none opacity-60"
        )}
      >
        {items.map((p, i) => (
          <div
            key={`${p.templateId}-${p.occurrenceDate}-${i}`}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1.5"
          >
            <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-z-brass/10">
              <Calendar className="size-3 text-z-brass" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {daysUntilLabel(p.occurrenceDate)}
              </p>
            </div>
            <p className="shrink-0 text-xs font-semibold tabular-nums">
              {formatCurrency(p.amount, currency)}
            </p>
            <ActionPill onClick={() => handleRecord(p)} variant="success">
              Registrar
            </ActionPill>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">
          {items.length} de {totalCount} &middot; Total:{" "}
          <span className="font-semibold tabular-nums">
            {formatCurrency(totalAmount, currency)}
          </span>
        </p>
        <Link
          href="/recurrentes"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
        >
          Ver todos
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── Emails detail ─────────────────────────────────────────────────────────────

function EmailsDetail({
  emails,
  currency,
}: {
  emails: AttentionPendingEmail[];
  currency: CurrencyCode;
}) {
  const [isPending, startTransition] = useTransition();
  const items = emails.slice(0, MAX_ITEMS);
  const totalCount = emails.length;

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

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-sage">
        Pendientes por correo
      </p>

      <div
        className={cn(
          "space-y-0.5",
          isPending && "pointer-events-none opacity-60"
        )}
      >
        {items.map((email) => {
          const dateStr = email.date
            ? `${email.date.slice(8, 10)}/${email.date.slice(5, 7)}`
            : "";
          const cardInfo = email.card_last4 ? `*${email.card_last4}` : null;

          return (
            <div
              key={email.id}
              className="flex items-center gap-2 rounded-lg px-1.5 py-1.5"
            >
              <DirectionIcon direction={email.direction} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{email.merchant}</p>
                <p className="text-[10px] text-muted-foreground">
                  {cardInfo && <span>{cardInfo}</span>}
                  {cardInfo && dateStr && <span> &middot; </span>}
                  {dateStr && <span>{dateStr}</span>}
                </p>
              </div>
              <p className="shrink-0 text-xs font-semibold tabular-nums">
                {formatCurrency(email.amount, currency)}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <ActionPill
                  onClick={() => handleApprove(email.id)}
                  variant="success"
                >
                  Importar
                </ActionPill>
                <ActionPill
                  onClick={() => handleDismiss(email.id)}
                  variant="danger"
                >
                  &times;
                </ActionPill>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">
          {totalCount} pendiente{totalCount !== 1 ? "s" : ""}
        </p>
        <Link
          href="/movimientos"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-sage-light"
        >
          Ver movimientos
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
