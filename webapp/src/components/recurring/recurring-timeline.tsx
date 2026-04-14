"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import { RecurringTemplateCard } from "./recurring-template-card";
import type { CurrencyCode, RecurringTemplateWithRelations } from "@/types/domain";
import type { OccurrenceItem, DateStatus } from "./use-recurring-month";

interface RecurringTimelineProps {
  templates: RecurringTemplateWithRelations[];
  currency: CurrencyCode;
  direction: "OUTFLOW" | "INFLOW";
  pending: OccurrenceItem[];
  completed: OccurrenceItem[];
  expandedId: string | null;
  onToggleExpand: (templateId: string) => void;
  onPauseRequest: (template: RecurringTemplateWithRelations) => void;
  onDeleteRequest: (template: RecurringTemplateWithRelations) => void;
  onResumeRequest: (template: RecurringTemplateWithRelations) => void;
  getDateStatus: (date: string) => DateStatus;
  getEffectiveDirection: (template: RecurringTemplateWithRelations) => "OUTFLOW" | "INFLOW";
}

type EffectiveStatus = "overdue" | "paid" | "today" | "future";

const STATUS_ORDER: Record<EffectiveStatus, number> = { overdue: 0, today: 1, future: 2, paid: 3 };

function dotStyle(status: EffectiveStatus) {
  switch (status) {
    case "overdue":
      return "bg-z-debt shadow-[0_0_8px_rgba(239,68,68,0.4)]";
    case "today":
      return "bg-z-alert shadow-[0_0_8px_rgba(245,158,11,0.4)]";
    case "future":
      return "border-2 border-white/15 bg-transparent";
    case "paid":
      return "bg-z-income shadow-[0_0_6px_rgba(74,222,128,0.3)]";
  }
}

function dateColor(status: EffectiveStatus) {
  switch (status) {
    case "overdue": return "text-z-debt";
    case "today": return "text-z-alert";
    case "future": return "text-muted-foreground";
    case "paid": return "text-z-income";
  }
}

function dateLabel(status: EffectiveStatus) {
  switch (status) {
    case "overdue": return "Vencido — ";
    case "today": return "Hoy — ";
    case "paid": return "";
    case "future": return "";
  }
}

function lineColor(direction: "OUTFLOW" | "INFLOW") {
  return direction === "OUTFLOW"
    ? "from-z-brass/40 to-z-brass/10"
    : "from-z-income/40 to-z-income/10";
}

export function RecurringTimeline({
  templates,
  currency,
  direction,
  pending,
  completed,
  expandedId,
  onToggleExpand,
  onPauseRequest,
  onDeleteRequest,
  onResumeRequest,
  getDateStatus,
  getEffectiveDirection,
}: RecurringTimelineProps) {
  const templateMap = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates]
  );

  const pausedTemplates = templates.filter((t) => getEffectiveDirection(t) === direction && !t.is_active);

  // Build date-grouped items from pending + completed, filtered by direction
  const allItems = useMemo(() => [...pending, ...completed], [pending, completed]);

  const dateGroups = useMemo(() => {
    const groups = new Map<string, OccurrenceItem[]>();
    for (const item of allItems) {
      const tmpl = templateMap.get(item.templateId);
      if (!tmpl || getEffectiveDirection(tmpl) !== direction || !tmpl.is_active) continue;
      if (!groups.has(item.date)) groups.set(item.date, []);
      groups.get(item.date)!.push(item);
    }
    return groups;
  }, [allItems, templateMap, direction]);

  // Build occurrence status map (templateId:date → paid/pending)
  const completedKeys = useMemo(() => new Set(completed.map((c) => c.key)), [completed]);

  const occurrenceStatuses = useMemo(() => {
    const statuses = new Map<string, "paid" | "pending" | "skipped">();
    for (const item of allItems) {
      statuses.set(`${item.templateId}:${item.date}`, completedKeys.has(item.key) ? "paid" : "pending");
    }
    return statuses;
  }, [allItems, completedKeys]);

  // Compute effective status per date group: combines date + payment status
  const getGroupStatus = useMemo(() => {
    return (date: string, items: OccurrenceItem[]): EffectiveStatus => {
      const dateStatus = getDateStatus(date);
      const allPaid = items.every((item) => completedKeys.has(item.key));
      if (allPaid) return "paid";
      if (dateStatus === "past") return "overdue";
      if (dateStatus === "today") return "today";
      return "future";
    };
  }, [getDateStatus, completedKeys]);

  const sortedDates = useMemo(
    () => Array.from(dateGroups.keys())
      .map((date) => {
        const items = dateGroups.get(date)!;
        return { date, order: STATUS_ORDER[getGroupStatus(date, items)] };
      })
      .sort((a, b) => a.order - b.order || a.date.localeCompare(b.date))
      .map((d) => d.date),
    [dateGroups, getGroupStatus]
  );

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className={cn("absolute bottom-0 left-[7px] top-0 w-0.5 bg-gradient-to-b", lineColor(direction))} />

      {/* Date groups */}
      {sortedDates.map((date) => {
        const items = dateGroups.get(date)!;
        const status = getGroupStatus(date, items);

        return (
          <div key={date} className="relative mb-5">
            {/* Dot */}
            <div className={cn("absolute -left-6 top-0.5 size-3 rounded-full", dotStyle(status))} />
            {/* Date label */}
            <p className={cn("mb-2 text-[10px] font-semibold uppercase tracking-[0.1em]", dateColor(status))}>
              {dateLabel(status)}
              {formatDate(date, "EEEE d MMM")}
            </p>

            {/* Template cards */}
            <div className="space-y-2">
              {items.map((item) => {
                const tmpl = templateMap.get(item.templateId);
                if (!tmpl) return null;
                const occKey = `${item.templateId}:${item.date}`;
                return (
                  <RecurringTemplateCard
                    key={occKey}
                    template={tmpl}
                    currency={currency}
                    isExpanded={expandedId === tmpl.id}
                    onToggleExpand={() => onToggleExpand(tmpl.id)}
                    onPauseRequest={onPauseRequest}
                    onDeleteRequest={onDeleteRequest}
                    occurrenceStatus={occurrenceStatuses.get(occKey) ?? null}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Completed section — items already paid this month (green dots) */}
      {completed.filter((c) => {
        const tmpl = templateMap.get(c.templateId);
        return tmpl && getEffectiveDirection(tmpl) === direction && tmpl.is_active && !dateGroups.has(c.date);
      }).length > 0 && (
        <div className="relative mb-5">
          <div className="absolute -left-6 top-0.5 size-3 rounded-full bg-z-income shadow-[0_0_6px_rgba(74,222,128,0.3)]" />
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-z-income">
            Completados
          </p>
          <div className="space-y-2">
            {completed
              .filter((c) => {
                const tmpl = templateMap.get(c.templateId);
                return tmpl && getEffectiveDirection(tmpl) === direction && tmpl.is_active && !dateGroups.has(c.date);
              })
              .map((item) => {
                const tmpl = templateMap.get(item.templateId);
                if (!tmpl) return null;
                return (
                  <RecurringTemplateCard
                    key={`completed-${item.key}`}
                    template={tmpl}
                    currency={currency}
                    isExpanded={expandedId === tmpl.id}
                    onToggleExpand={() => onToggleExpand(tmpl.id)}
                    onPauseRequest={onPauseRequest}
                    onDeleteRequest={onDeleteRequest}
                    occurrenceStatus="paid"
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Paused templates */}
      {pausedTemplates.length > 0 && (
        <div className="relative mb-5 mt-6">
          <div className="absolute -left-6 top-0.5 size-3 rounded-full border-2 border-dashed border-white/15" />
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
            Pausados
          </p>
          <div className="space-y-2">
            {pausedTemplates.map((tmpl) => (
              <PausedTemplateCard
                key={tmpl.id}
                template={tmpl}
                currency={currency}
                isExpanded={expandedId === tmpl.id}
                onToggleExpand={() => onToggleExpand(tmpl.id)}
                onResumeRequest={onResumeRequest}
                onDeleteRequest={onDeleteRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sortedDates.length === 0 && pausedTemplates.length === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No hay {direction === "OUTFLOW" ? "gastos" : "ingresos"} recurrentes
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Paused template card — expandable with Resume/Edit/Delete          */
/* ------------------------------------------------------------------ */

function PausedTemplateCard({
  template,
  currency,
  isExpanded,
  onToggleExpand,
  onResumeRequest,
  onDeleteRequest,
}: {
  template: RecurringTemplateWithRelations;
  currency: CurrencyCode;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onResumeRequest: (template: RecurringTemplateWithRelations) => void;
  onDeleteRequest: (template: RecurringTemplateWithRelations) => void;
}) {
  const router = useRouter();

  return (
    <div className={cn(
      "overflow-hidden rounded-xl border border-dashed border-white/8 bg-white/[0.02] transition-all",
      isExpanded && "border-z-brass/20 border-solid opacity-100",
      !isExpanded && "opacity-50"
    )}>
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left active:bg-white/[0.02]"
      >
        <div>
          <p className="text-xs font-semibold">{template.merchant_name}</p>
          <p className="text-[10px] text-muted-foreground">Pausado</p>
        </div>
        <p className="text-xs font-bold tabular-nums opacity-50 line-through">
          {formatCurrency(Number(template.amount), currency)}
        </p>
      </button>

      {isExpanded && (
        <div className="grid grid-cols-3 gap-1.5 border-t border-white/5 px-3 py-3">
          <button
            type="button"
            onClick={() => onResumeRequest(template)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-z-income/20 bg-z-income/10 py-2.5 text-[11px] font-semibold text-z-income active:opacity-70"
          >
            <Play className="size-3.5" />
            Activar
          </button>
          <button
            type="button"
            onClick={() => router.push(`/recurrentes/${template.id}/edit`)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-z-brass/20 bg-z-brass/10 py-2.5 text-[11px] font-semibold text-z-brass active:opacity-70"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDeleteRequest(template)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-z-debt/15 bg-z-debt/8 py-2.5 text-[11px] font-semibold text-z-debt active:opacity-70"
          >
            <Trash2 className="size-3.5" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
