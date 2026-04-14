"use client";

import { useState, useMemo, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, MoreVertical, Pause, Pencil, Play, Tag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PANEL_INSET_CLASS, HERO_CARD_GRADIENT_CLASS, MOBILE_ACTION_BUTTON_CLASS, MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { useRecurringMonth, type OccurrenceItem, type DateStatus } from "@/components/recurring/use-recurring-month";
import { RecurringConfirmInline } from "@/components/recurring/recurring-confirm-inline";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringImpactDialog } from "@/components/recurring/recurring-impact-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCategories } from "@/components/providers/app-data-provider";
import {
  deleteRecurringTemplate,
  toggleRecurringTemplate,
} from "@/actions/recurring-templates";
import type { CategoryWithChildren, CurrencyCode, RecurringTemplateWithRelations, Account } from "@/types/domain";

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
  const [actionItem, setActionItem] = useState<OccurrenceItem | null>(null);
  const categories = useCategories();

  const templateMap = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates]
  );

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
            className="flex size-7 items-center justify-center rounded-full border border-white/6 text-muted-foreground active:bg-white/5"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs font-medium capitalize text-muted-foreground">
            {hook.monthLabel}
          </span>
          <button
            type="button"
            onClick={hook.goNextMonth}
            className="flex size-7 items-center justify-center rounded-full border border-white/6 text-muted-foreground active:bg-white/5"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {/* Summary chips */}
        <div className="mt-3 flex gap-3 text-center">
          <div className="flex-1">
            <p className="text-[10px] text-z-alert">Pendientes</p>
            <p className="text-lg font-semibold text-z-alert">{hook.pending.length}</p>
          </div>
          <div className="h-8 w-px bg-white/6 self-center" />
          <div className="flex-1">
            <p className="text-[10px] text-z-income">Completados</p>
            <p className="text-lg font-semibold text-z-income">{hook.completed.length}</p>
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
          <p className={MOBILE_EYEBROW_CLASS}>
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
                        {/* Payment row — split into tap area + action button */}
                        <div
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2.5",
                            isBusy && "opacity-50 pointer-events-none"
                          )}
                        >
                          {/* Tap area for expand/collapse */}
                          <button
                            type="button"
                            onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                            className="flex flex-1 items-center gap-2.5 text-left transition-colors active:bg-white/[0.03]"
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
                          </button>

                          {/* Action hint */}
                          <button
                            type="button"
                            onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                            className={cn("shrink-0", MOBILE_ACTION_BUTTON_CLASS)}
                          >
                            {isExpanded ? "Cerrar" : "Pagar"}
                          </button>

                          {/* Admin actions */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionItem(item);
                            }}
                            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-white/10"
                          >
                            <MoreVertical className="size-3.5" />
                          </button>
                        </div>

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
          <Check className="mx-auto size-6 text-z-income" />
          <p className="mt-2 text-xs font-medium text-z-income">Todo al día</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {hook.completed.length} pago{hook.completed.length !== 1 ? "s" : ""} completado{hook.completed.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Completed section */}
      {hook.isHydrated && hook.completed.length > 0 && (
        <CompletedSection completed={hook.completed} />
      )}

      {/* Admin action sheet */}
      <TemplateActionSheet
        item={actionItem}
        template={actionItem ? templateMap.get(actionItem.templateId) ?? null : null}
        accounts={accounts}
        categories={categories}
        onClose={() => setActionItem(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Template Action Sheet                                              */
/* ------------------------------------------------------------------ */

function TemplateActionSheet({
  item,
  template,
  accounts,
  categories,
  onClose,
}: {
  item: OccurrenceItem | null;
  template: RecurringTemplateWithRelations | null;
  accounts: Account[];
  categories: CategoryWithChildren[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const open = !!item && !!template;

  const handleActivate = () => {
    if (!template) return;
    startTransition(async () => {
      await toggleRecurringTemplate(template.id, true);
      onClose();
    });
  };

  const handlePauseConfirm = async () => {
    if (!template) return;
    await toggleRecurringTemplate(template.id, false);
    onClose();
  };

  const handleDeleteConfirm = async () => {
    if (!template) return;
    await deleteRecurringTemplate(template.id);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader>
          <SheetTitle className="text-left">{template?.merchant_name}</SheetTitle>
        </SheetHeader>

        {template && (
          <div className="mt-4 space-y-1">
            {/* Edit */}
            <RecurringFormDialog
              template={template ?? undefined}
              accounts={accounts}
              categories={categories}
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left active:bg-white/5"
                >
                  <Pencil className="size-4 text-muted-foreground" />
                  <span className="text-sm">Editar</span>
                </button>
              }
            />

            {/* Pause / Activate */}
            {template.is_active ? (
              <RecurringImpactDialog
                templateId={template.id}
                templateName={template.merchant_name ?? "Recurrente"}
                currencyCode={(template.currency_code ?? "COP") as CurrencyCode}
                action="pause"
                onConfirm={handlePauseConfirm}
                trigger={
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left active:bg-white/5"
                    disabled={isPending}
                  >
                    <Pause className="size-4 text-muted-foreground" />
                    <span className="text-sm">Pausar</span>
                  </button>
                }
              />
            ) : (
              <button
                type="button"
                onClick={handleActivate}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left active:bg-white/5"
                disabled={isPending}
              >
                <Play className="size-4 text-muted-foreground" />
                <span className="text-sm">{isPending ? "Activando..." : "Activar"}</span>
              </button>
            )}

            {/* Delete */}
            <RecurringImpactDialog
              templateId={template.id}
              templateName={template.merchant_name ?? "Recurrente"}
              currencyCode={(template.currency_code ?? "COP") as CurrencyCode}
              action="delete"
              onConfirm={handleDeleteConfirm}
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-z-debt active:bg-white/5"
                >
                  <Trash2 className="size-4" />
                  <span className="text-sm">Eliminar</span>
                </button>
              }
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Completed section                                                  */
/* ------------------------------------------------------------------ */

function CompletedSection({
  completed,
}: {
  completed: OccurrenceItem[];
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
              <Check className="size-4 shrink-0 text-z-income" />
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
