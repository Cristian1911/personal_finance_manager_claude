"use client";

import { useState, useMemo } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  PANEL_INSET_CLASS,
  HERO_CARD_GRADIENT_CLASS,
  MOBILE_EYEBROW_CLASS,
  MOBILE_TAB_BAR_CLEARANCE_CLASS,
} from "@/lib/constants/styles";
import { useRecurringMonth, type OccurrenceItem, type DateStatus } from "@/components/recurring/use-recurring-month";
import type { RecurringOccurrence } from "@/actions/occurrences";
import { OccurrenceActions } from "@/components/recurring/occurrence-actions";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringImpactDialog } from "@/components/recurring/recurring-impact-dialog";
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
/*  Status helpers                                                     */
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
  const categories = useCategories();

  const templateMap = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  );

  const sourceAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.account_type === "CHECKING" || a.account_type === "SAVINGS")
        .map((a) => ({ id: a.id, name: a.name })),
    [accounts],
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

  /* ---- Impact dialog state (pause/delete) ---- */
  const [impactAction, setImpactAction] = useState<{
    item: OccurrenceItem;
    template: RecurringTemplateWithRelations;
    action: "pause" | "delete";
  } | null>(null);

  /* ---- Edit dialog state ---- */
  const [editTemplate, setEditTemplate] = useState<RecurringTemplateWithRelations | null>(null);

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
    setExpandedKey(null);
  };

  const sortedDates = useMemo(
    () =>
      Array.from(hook.pendingByDate.keys())
        .map((date) => ({ date, order: STATUS_ORDER[hook.getDateStatus(date)] }))
        .sort((a, b) => a.order - b.order || a.date.localeCompare(b.date))
        .map(({ date }) => date),
    [hook.pendingByDate, hook.getDateStatus],
  );

  /* ---- Shared action handlers ---- */
  function makeActions(item: OccurrenceItem) {
    const template = templateMap.get(item.templateId) ?? null;
    return {
      template,
      onConfirm: (amount: number, paymentDate: string, sourceId?: string) => {
        hook.confirmPayment(item, {
          actualAmount: amount,
          paymentDate,
          sourceAccountId: sourceId ?? null,
        });
        setExpandedKey(null);
      },
      onSkip: () => {
        hook.skipPayment(item);
        setExpandedKey(null);
      },
      onLinkExisting: () => {
        setExpandedKey(null);
        handleOpenLinkPicker(item);
      },
      onEdit: template
        ? () => {
            setExpandedKey(null);
            setEditTemplate(template);
          }
        : undefined,
      onPause: template
        ? () => {
            setExpandedKey(null);
            setImpactAction({ item, template, action: "pause" });
          }
        : undefined,
      onResume: template
        ? async () => {
            setExpandedKey(null);
            await toggleRecurringTemplate(template.id, true);
            await hook.refreshOccurrences();
          }
        : undefined,
      onDelete: template
        ? () => {
            setExpandedKey(null);
            setImpactAction({ item, template, action: "delete" });
          }
        : undefined,
    };
  }

  function handleRowTap(item: OccurrenceItem) {
    setExpandedKey(expandedKey === item.key ? null : item.key);
  }

  return (
    <div className={cn("space-y-3", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
      {/* Hero card */}
      <div className={cn("rounded-2xl border border-white/6 p-4", HERO_CARD_GRADIENT_CLASS)}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
          Compromiso mensual
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
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
          <div className="h-8 w-px self-center bg-white/6" />
          <div className="flex-1">
            <p className="text-[10px] text-z-income">Completados</p>
            <p className="text-lg font-semibold text-z-income">{hook.completed.length}</p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {!hook.isHydrated && (
        <div className="animate-pulse py-8 text-center text-sm text-muted-foreground">
          Verificando estado de pagos...
        </div>
      )}

      {/* Pending payments grouped by date */}
      {hook.isHydrated && sortedDates.length > 0 && (
        <div className="space-y-2">
          <p className={MOBILE_EYEBROW_CLASS}>Pendientes</p>
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
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.18em]",
                      statusLabel(status),
                    )}
                  >
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
                          onClick={() => handleRowTap(item)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors active:bg-white/[0.03]",
                            isBusy && "pointer-events-none opacity-50",
                          )}
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

                          {/* Amount */}
                          <span className="shrink-0 text-xs font-semibold tabular-nums">
                            {formatCurrency(item.plannedAmount, item.currencyCode as CurrencyCode)}
                          </span>
                        </button>

                        {/* Option A: Inline expand */}
                        {isExpanded && (
                          <div className="border-t border-white/5 bg-black/20 px-3 py-3">
                            <OccurrenceActions
                              item={item}
                              isPending={isBusy}
                              sourceAccounts={sourceAccounts}
                              {...makeActions(item)}
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

      {/* All done state */}
      {hook.isHydrated && sortedDates.length === 0 && hook.completed.length > 0 && (
        <div className={cn(PANEL_INSET_CLASS, "py-6 text-center")}>
          <Check className="mx-auto size-6 text-z-income" />
          <p className="mt-2 text-xs font-medium text-z-income">Todo al día</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {hook.completed.length} pago{hook.completed.length !== 1 ? "s" : ""} completado
            {hook.completed.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Completed section */}
      {hook.isHydrated && hook.completed.length > 0 && (
        <CompletedSection
          completed={hook.completed}
          onRevert={async (occurrenceId) => {
            const result = await revertOccurrence(occurrenceId);
            if (result.success) {
              hook.optimisticRevert(occurrenceId);
            }
            return result;
          }}
        />
      )}

      {/* Templates section — admin for non-checklist management */}
      {hook.isHydrated && (
        <TemplatesSection
          templates={templates}
          accounts={accounts}
          categories={categories}
          currency={currency}
          onMutate={hook.refreshOccurrences}
        />
      )}

      {/* Link existing transaction sheet */}
      <LinkPickerSheet
        open={!!linkingItem}
        onOpenChange={(open) => {
          if (!open) setLinkingItem(null);
        }}
        title="Vincular transacción"
        subtitle={
          linkingItem
            ? `${linkingItem.merchant} · ${formatCurrency(linkingItem.plannedAmount, linkingItem.currencyCode as CurrencyCode)} esperado · ${formatDate(linkingItem.date)}`
            : ""
        }
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
          const result = await getCandidateTransactionsForOccurrence(
            linkingItem.occurrenceId,
            true,
          );
          setIsLoadingCandidates(false);
          if (result.success) setLinkCandidates(result.data);
        }}
        isLoadingAll={isLoadingCandidates}
      />

      {/* Edit dialog (controlled, opens AFTER sheet closes to avoid z-index bug) */}
      {editTemplate && (
        <RecurringFormDialog
          template={editTemplate}
          accounts={accounts}
          categories={categories}
          trigger={null}
          controlledOpen
          onClose={() => {
            setEditTemplate(null);
            hook.refreshOccurrences();
          }}
        />
      )}

      {/* Impact dialog (pause/delete) */}
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
              <div
                key={item.key}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 opacity-60",
                  isReverting && "pointer-events-none opacity-30",
                )}
              >
                <Check className="size-4 shrink-0 text-z-income" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{item.merchant}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(item.date, "dd MMM")}
                  </p>
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Templates section (admin — create, see all, manage paused)         */
/* ------------------------------------------------------------------ */

function TemplatesSection({
  templates,
  accounts,
  categories,
  currency,
  onMutate,
}: {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
  categories: CategoryWithChildren[];
  currency: CurrencyCode;
  onMutate: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);

  let activeCount = 0;
  let pausedCount = 0;
  for (const t of templates) {
    if (t.is_active) activeCount++;
    else pausedCount++;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        className={cn("flex w-full items-center justify-between py-2", MOBILE_EYEBROW_CLASS)}
      >
        <span>
          Mis plantillas ({activeCount} activas{pausedCount > 0 ? ` · ${pausedCount} pausadas` : ""})
        </span>
        <span>{show ? "Ocultar ↑" : "Ver ↓"}</span>
      </button>

      {show && (
        <div className="space-y-2">
          {/* Create new */}
          <RecurringFormDialog
            accounts={accounts}
            categories={categories}
            onClose={onMutate}
            trigger={
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-z-brass/20 py-3 text-xs font-semibold text-z-brass active:bg-z-brass/5",
                )}
              >
                <Plus className="size-3.5" />
                Nueva plantilla
              </button>
            }
          />

          {/* Template list */}
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
        </div>
      )}
    </div>
  );
}
