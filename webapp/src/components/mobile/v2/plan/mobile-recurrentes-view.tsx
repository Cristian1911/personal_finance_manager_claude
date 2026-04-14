"use client";

import { useState, useMemo, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, MoreVertical, Pause, Pencil, Play, Tag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PANEL_INSET_CLASS, HERO_CARD_GRADIENT_CLASS, MOBILE_ACTION_BUTTON_CLASS, MOBILE_EYEBROW_CLASS, MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import { useRecurringMonth, type OccurrenceItem, type DateStatus } from "@/components/recurring/use-recurring-month";
import type { RecurringOccurrence } from "@/actions/occurrences";
import { RecurringConfirmInline } from "@/components/recurring/recurring-confirm-inline";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringImpactDialog } from "@/components/recurring/recurring-impact-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCategories } from "@/components/providers/app-data-provider";
import {
  deleteRecurringTemplate,
  toggleRecurringTemplate,
} from "@/actions/recurring-templates";
import { revertOccurrence, getCandidateTransactionsForOccurrence } from "@/actions/occurrences";
import type { CandidateTransaction } from "@/actions/occurrences";
import { LinkPickerSheet } from "@/components/recurring/link-picker-sheet";
import { toast } from "sonner";
import type { ActionResult } from "@/types/actions";
import type { CategoryWithChildren, CurrencyCode, RecurringTemplateWithRelations, Account } from "@/types/domain";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MobileRecurrentesViewProps {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
  currency: CurrencyCode;
  initialOccurrences?: RecurringOccurrence[];
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
  initialOccurrences,
}: MobileRecurrentesViewProps) {
  const hook = useRecurringMonth(templates, accounts, initialOccurrences);
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

  /* ---- Link existing transaction flow ---- */
  const [linkingItem, setLinkingItem] = useState<OccurrenceItem | null>(null);
  const [linkCandidates, setLinkCandidates] = useState<CandidateTransaction[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  const handleOpenLinkPicker = async (item: OccurrenceItem) => {
    setLinkingItem(item);
    setIsLoadingCandidates(true);
    const result = await getCandidateTransactionsForOccurrence(item.occurrenceId);
    setIsLoadingCandidates(false);
    if (result.success) {
      setLinkCandidates(result.data);
    } else {
      toast.error(result.error ?? "Error al buscar transacciones");
      setLinkingItem(null);
    }
  };

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
                  <span className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", statusLabel(status))}>
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
                        {/* Payment row — tap to expand, ⋮ for admin */}
                        <div
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2.5",
                            isBusy && "opacity-50 pointer-events-none"
                          )}
                        >
                          {/* Tap area for expand/collapse */}
                          <button
                            type="button"
                            onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left active:bg-white/[0.03]"
                          >
                            {/* Category dot */}
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-md"
                              style={{ backgroundColor: item.categoryColor + "20" }}
                            >
                              <Tag className="size-3" style={{ color: item.categoryColor }} />
                            </span>

                            {/* Merchant + account */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{item.merchant}</p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {item.accountName}
                              </p>
                            </div>
                          </button>

                          {/* Amount */}
                          <span className="shrink-0 text-xs font-semibold tabular-nums">
                            {formatCurrency(item.plannedAmount, item.currencyCode as CurrencyCode)}
                          </span>

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
                              onLinkExisting={() => {
                                setExpandedKey(null);
                                handleOpenLinkPicker(item);
                              }}
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
        <CompletedSection
          completed={hook.completed}
          onRevert={async (occurrenceId) => {
            const result = await revertOccurrence(occurrenceId);
            if (result.success) await hook.refreshOccurrences();
            return result;
          }}
        />
      )}

      {/* Admin action sheet */}
      <TemplateActionSheet
        item={actionItem}
        template={actionItem ? templateMap.get(actionItem.templateId) ?? null : null}
        accounts={accounts}
        categories={categories}
        onClose={() => setActionItem(null)}
        onMutate={hook.refreshOccurrences}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Template Action Sheet                                              */
/* ------------------------------------------------------------------ */

const SHEET_CHIP_CLASS =
  "flex flex-col items-center gap-1.5 rounded-xl border border-white/6 bg-white/4 px-3 py-3 active:bg-white/8 disabled:opacity-50";

function TemplateActionSheet({
  item,
  template,
  accounts,
  categories,
  onClose,
  onMutate,
}: {
  item: OccurrenceItem | null;
  template: RecurringTemplateWithRelations | null;
  accounts: Account[];
  categories: CategoryWithChildren[];
  onClose: () => void;
  onMutate: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  const open = !!item && !!template;

  const handleActivate = () => {
    if (!template) return;
    startTransition(async () => {
      await toggleRecurringTemplate(template.id, true);
      await onMutate();
      onClose();
    });
  };

  const handlePauseConfirm = () => {
    if (!template) return;
    startTransition(async () => {
      await toggleRecurringTemplate(template.id, false);
      await onMutate();
      onClose();
    });
  };

  const handleDeleteConfirm = () => {
    if (!template) return;
    startTransition(async () => {
      await deleteRecurringTemplate(template.id);
      await onMutate();
      onClose();
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
        <SheetHeader>
          <SheetTitle className="text-left">{template?.merchant_name}</SheetTitle>
        </SheetHeader>

        {template && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {/* Edit */}
            <RecurringFormDialog
              template={template ?? undefined}
              accounts={accounts}
              categories={categories}
              trigger={
                <button
                  type="button"
                  disabled={isPending}
                  className={SHEET_CHIP_CLASS}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-z-brass/15">
                    <Pencil className="size-4 text-z-brass" />
                  </span>
                  <span className="text-xs">Editar</span>
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
                    disabled={isPending}
                    className={SHEET_CHIP_CLASS}
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-z-alert/15">
                      <Pause className="size-4 text-z-alert" />
                    </span>
                    <span className="text-xs">Pausar</span>
                  </button>
                }
              />
            ) : (
              <button
                type="button"
                onClick={handleActivate}
                disabled={isPending}
                className={SHEET_CHIP_CLASS}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-z-income/15">
                  <Play className="size-4 text-z-income" />
                </span>
                <span className="text-xs">{isPending ? "..." : "Activar"}</span>
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
                  disabled={isPending}
                  className={SHEET_CHIP_CLASS}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-z-debt/15">
                    <Trash2 className="size-4 text-z-debt" />
                  </span>
                  <span className="text-xs text-z-debt">Eliminar</span>
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
  onRevert,
}: {
  completed: OccurrenceItem[];
  onRevert: (occurrenceId: string) => Promise<ActionResult>;
}) {
  const [show, setShow] = useState(true);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  async function handleRevert(item: OccurrenceItem) {
    setRevertingId(item.occurrenceId);
    try {
      const result = await onRevert(item.occurrenceId);
      if (!result.success) {
        toast.error(result.error ?? "Error al deshacer");
      } else {
        toast.success("Movido a pendientes");
      }
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        className={cn("flex w-full items-center justify-between py-2", MOBILE_EYEBROW_CLASS)}
      >
        <span>Completados ({completed.length})</span>
        <span>{show ? "Ocultar ↑" : "Ver ↓"}</span>
      </button>
      {show && (
        <div className={cn(PANEL_INSET_CLASS, "divide-y divide-white/5")}>
          {completed.map((item) => {
            const isReverting = revertingId === item.occurrenceId;
            return (
              <div key={item.key} className={cn(
                "flex items-center gap-2 px-3 py-2.5 opacity-60",
                isReverting && "opacity-30 pointer-events-none"
              )}>
                <Check className="size-4 shrink-0 text-z-income" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{item.merchant}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(item.date, "dd MMM")}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(item.plannedAmount, item.currencyCode as CurrencyCode)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRevert(item)}
                  disabled={isReverting}
                  aria-label={`Deshacer ${item.merchant}`}
                  className="shrink-0 rounded-md px-2 py-0.5 text-[10px] text-z-sage-dark active:bg-white/5"
                >
                  Deshacer
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Link existing transaction sheet */}
      <LinkPickerSheet
        open={!!linkingItem}
        onOpenChange={(open) => { if (!open) setLinkingItem(null); }}
        title="Vincular transacción"
        subtitle={linkingItem ? `${linkingItem.merchant} · ${formatCurrency(linkingItem.plannedAmount, linkingItem.currencyCode as CurrencyCode)} esperado · ${formatDate(linkingItem.date)}` : ""}
        candidates={linkCandidates.map((c) => ({
          id: c.id,
          label: c.description,
          sublabel: `${formatDate(c.transaction_date)} · ${c.provider ?? "Manual"}`,
          amount: c.amount,
          currencyCode: c.currency_code,
          direction: linkingItem?.direction ?? "OUTFLOW",
          matchScore: c.matchScore,
        }))}
        onConfirm={(txId) => {
          if (linkingItem) {
            hook.linkExisting(linkingItem, txId);
            setLinkingItem(null);
          }
        }}
        isPending={hook.busyItems[linkingItem?.key ?? ""] ?? false}
        showAllLabel="Mostrar todas las transacciones →"
        onShowAll={async () => {
          if (!linkingItem) return;
          setIsLoadingCandidates(true);
          const result = await getCandidateTransactionsForOccurrence(linkingItem.occurrenceId, true);
          setIsLoadingCandidates(false);
          if (result.success) setLinkCandidates(result.data);
        }}
        isLoadingAll={isLoadingCandidates}
      />
    </div>
  );
}
