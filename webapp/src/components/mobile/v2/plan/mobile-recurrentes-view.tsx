"use client";

import { useState, useMemo } from "react";
import { Check, ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PANEL_INSET_CLASS, HERO_CARD_GRADIENT_CLASS } from "@/lib/constants/styles";
import { useRecurringMonth, type OccurrenceItem, type DateStatus } from "@/components/recurring/use-recurring-month";
import { RecurringConfirmInline } from "@/components/recurring/recurring-confirm-inline";
import type { CurrencyCode, RecurringTemplateWithRelations, Account } from "@/types/domain";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MobileRecurrentesViewProps {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
  currency: CurrencyCode;
}

/* ------------------------------------------------------------------ */
/*  Status styling                                                     */
/* ------------------------------------------------------------------ */

function statusAccent(status: DateStatus) {
  switch (status) {
    case "past":
      return "border-l-2 border-l-z-debt bg-z-debt/5";
    case "today":
      return "border-l-2 border-l-z-alert bg-z-alert/5";
    case "future":
      return "";
  }
}

const STATUS_ORDER: Record<DateStatus, number> = { past: 0, today: 1, future: 2 };

function statusLabel(status: DateStatus) {
  switch (status) {
    case "past":
      return "text-z-debt";
    case "today":
      return "text-z-alert";
    case "future":
      return "text-muted-foreground";
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MobileRecurrentesView({
  templates,
  accounts,
  currency,
}: MobileRecurrentesViewProps) {
  const hook = useRecurringMonth(templates, accounts);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const sourceAccounts = useMemo(
    () => accounts
      .filter((a) => a.account_type === "CHECKING" || a.account_type === "SAVINGS")
      .map((a) => ({ id: a.id, name: a.name })),
    [accounts]
  );

  const sortedDates = useMemo(
    () => Array.from(hook.pendingByDate.keys())
      .map((date) => ({ date, order: STATUS_ORDER[hook.getDateStatus(date)] }))
      .sort((a, b) => a.order - b.order || a.date.localeCompare(b.date))
      .map(({ date }) => date),
    [hook.pendingByDate, hook.getDateStatus]
  );

  return (
    <div className="space-y-3 pb-20">
      {/* Hero card */}
      <div className={cn("rounded-2xl border border-white/6 p-4", HERO_CARD_GRADIENT_CLASS)}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
          Compromiso mensual
        </p>
        <p className="mt-1 text-3xl font-bold">
          {formatCurrency(hook.totalPlanned, currency)}
        </p>

        {/* Month navigation */}
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={hook.goPrevMonth}
            className="flex size-7 items-center justify-center rounded-full border border-white/10 text-muted-foreground active:bg-white/5"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs font-medium capitalize text-muted-foreground">
            {hook.monthLabel}
          </span>
          <button
            type="button"
            onClick={hook.goNextMonth}
            className="flex size-7 items-center justify-center rounded-full border border-white/10 text-muted-foreground active:bg-white/5"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {/* Summary chips */}
        <div className="mt-3 flex gap-3 text-center">
          <div className="flex-1">
            <p className="text-[10px] text-amber-400">Pendientes</p>
            <p className="text-lg font-semibold text-amber-400">{hook.pending.length}</p>
          </div>
          <div className="h-8 w-px bg-white/6 self-center" />
          <div className="flex-1">
            <p className="text-[10px] text-emerald-400">Completados</p>
            <p className="text-lg font-semibold text-emerald-400">{hook.completed.length}</p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {!hook.isHydrated && (
        <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
          Verificando estado de pagos...
        </div>
      )}

      {/* Pending payments grouped by date */}
      {hook.isHydrated && sortedDates.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pendientes
          </p>
          {sortedDates.map((date) => {
            const items = hook.pendingByDate.get(date)!;
            const status = hook.getDateStatus(date);

            return (
              <div
                key={date}
                className={cn(PANEL_INSET_CLASS, "overflow-hidden", statusAccent(status))}
              >
                {/* Date header */}
                <div className="px-3 py-1.5">
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wide", statusLabel(status))}>
                    {status === "today" && "Hoy — "}
                    {formatDate(date, "EEEE d MMM")}
                  </span>
                </div>

                {/* Items */}
                <div className="divide-y divide-white/5">
                  {items.map((item) => {
                    const isExpanded = expandedKey === item.key;
                    const isBusy = !!hook.busyItems[item.key];

                    return (
                      <div key={item.key}>
                        {/* Payment row */}
                        <button
                          type="button"
                          onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors active:bg-white/[0.03]",
                            isBusy && "opacity-50 pointer-events-none"
                          )}
                        >
                          {/* Category dot */}
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: item.categoryColor + "20" }}
                          >
                            <Tag className="size-3" style={{ color: item.categoryColor }} />
                          </span>

                          {/* Merchant + account */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{item.merchant}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.accountName}
                            </p>
                          </div>

                          {/* Amount */}
                          <span className="shrink-0 text-xs font-semibold tabular-nums">
                            {formatCurrency(item.plannedAmount, item.currencyCode as CurrencyCode)}
                          </span>

                          {/* Action hint */}
                          <span className="shrink-0 rounded-md bg-z-brass/10 px-2 py-0.5 text-[10px] text-z-brass">
                            {isExpanded ? "Cerrar" : "Pagar"}
                          </span>
                        </button>

                        {/* Inline confirm panel */}
                        {isExpanded && (
                          <div className="border-t border-white/5 bg-black/20 px-3 py-3">
                            <RecurringConfirmInline
                              item={item}
                              onConfirm={(amount, paymentDate, sourceId) => {
                                hook.confirmPayment(item, {
                                  actualAmount: amount,
                                  paymentDate,
                                  sourceAccountId: sourceId ?? null,
                                });
                                setExpandedKey(null);
                              }}
                              onSkip={() => {
                                hook.skipPayment(item);
                                setExpandedKey(null);
                              }}
                              onCancel={() => setExpandedKey(null)}
                              isPending={isBusy}
                              sourceAccounts={sourceAccounts}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {hook.isHydrated && sortedDates.length === 0 && hook.completed.length === 0 && (
        <div className={cn(PANEL_INSET_CLASS, "py-8 text-center text-xs text-muted-foreground")}>
          No hay pagos recurrentes este mes
        </div>
      )}

      {/* No pending state */}
      {hook.isHydrated && sortedDates.length === 0 && hook.completed.length > 0 && (
        <div className={cn(PANEL_INSET_CLASS, "py-6 text-center")}>
          <Check className="mx-auto size-6 text-emerald-400" />
          <p className="mt-2 text-xs font-medium text-emerald-400">Todo al día</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {hook.completed.length} pago{hook.completed.length !== 1 ? "s" : ""} completado{hook.completed.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Completed section */}
      {hook.isHydrated && hook.completed.length > 0 && (
        <CompletedSection completed={hook.completed} currency={currency} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Completed section                                                  */
/* ------------------------------------------------------------------ */

function CompletedSection({
  completed,
  currency,
}: {
  completed: OccurrenceItem[];
  currency: CurrencyCode;
}) {
  const [show, setShow] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        className="flex w-full items-center justify-between py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      >
        <span>Completados ({completed.length})</span>
        <span>{show ? "Ocultar ↑" : "Ver ↓"}</span>
      </button>
      {show && (
        <div className={cn(PANEL_INSET_CLASS, "divide-y divide-white/5")}>
          {completed.map((item) => (
            <div key={item.key} className="flex items-center gap-2.5 px-3 py-2.5 opacity-60">
              <Check className="size-4 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{item.merchant}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(item.date, "dd MMM")}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatCurrency(item.plannedAmount, item.currencyCode as CurrencyCode)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
