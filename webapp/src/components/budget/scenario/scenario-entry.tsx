"use client";

import { useMemo } from "react";
import { Home, SlidersHorizontal, ChevronRight, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatRelativeDate } from "@/lib/utils/date";
import {
  BRASS_GHOST_BUTTON_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { computeScenarioSummary } from "@zeta/shared";
import type { BudgetScenarioRecord } from "@/actions/budget-scenarios";
import type { ScenarioTemplate } from "./scenario-model";
import type { CurrencyCode } from "@/types/domain";

export function ScenarioEntryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-z-alert/35 bg-z-alert/8 text-[13px] font-semibold text-z-alert transition-colors active:bg-z-alert/14"
    >
      <SlidersHorizontal className="size-3.5" strokeWidth={2} />
      Simular un cambio
    </button>
  );
}

function TemplateRow({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-black/10 p-3 text-left transition-colors active:bg-white/5"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-z-alert/25 bg-z-alert/8 text-z-alert">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[10px] text-z-sage-dark">{sub}</span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-z-sage-dark" strokeWidth={1.5} />
    </button>
  );
}

export function ScenarioEntrySheet({
  open,
  onOpenChange,
  onPickTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickTemplate: (template: ScenarioTemplate) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={MOBILE_SHEET_SAFE_AREA_CLASS}>
        <SheetHeader>
          <SheetTitle>¿Qué cambio quieres probar?</SheetTitle>
          <SheetDescription>Tu presupuesto real no se toca hasta que apliques.</SheetDescription>
        </SheetHeader>
        <div className="space-y-1.5 px-4 pb-4">
          <TemplateRow
            icon={<Home className="size-4" strokeWidth={1.5} />}
            title="Mudanza"
            sub="Arriendo, servicios, internet"
            onClick={() => onPickTemplate("mudanza")}
          />
          <TemplateRow
            icon={<SlidersHorizontal className="size-4" strokeWidth={1.5} />}
            title="Desde cero"
            sub="Copia tu presupuesto tal cual"
            onClick={() => onPickTemplate("desde-cero")}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── E2 · Saved drafts on the real view ──────────────────────────────────────

export function SavedScenarios({
  scenarios,
  income,
  cushion,
  currency,
  onContinue,
  onDelete,
}: {
  scenarios: BudgetScenarioRecord[];
  income: number;
  cushion: number;
  currency: CurrencyCode;
  onContinue: (record: BudgetScenarioRecord) => void;
  onDelete: (id: string) => void;
}) {
  const withSummary = useMemo(
    () =>
      scenarios.map((record) => ({
        record,
        summary: computeScenarioSummary(record.draft, income, cushion),
      })),
    [scenarios, income, cushion],
  );

  if (scenarios.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={SECTION_EYEBROW_CLASS}>
          Simulaciones guardadas
        </span>
        <span className="h-px flex-1 bg-white/6" />
      </div>
      {withSummary.map(({ record, summary }) => {
        return (
          <div
            key={record.id}
            className="flex items-center gap-2.5 rounded-xl border border-dashed border-z-alert/25 bg-z-alert/8 px-3 py-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-z-alert/25 bg-z-alert/12 text-z-alert">
              <Home className="size-3.5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="truncate text-[13px] font-semibold">{record.name}</span>
                <span className="shrink-0 text-[10px] text-z-sage-dark">
                  {formatRelativeDate(record.updated_at)}
                </span>
              </div>
              <p
                className={cn(
                  "text-[10.5px] font-semibold tabular-nums",
                  summary.fits ? "text-z-income" : "text-z-debt",
                )}
              >
                {summary.fits
                  ? `sobran ${formatCurrency(-summary.shortfall, currency)}/mes`
                  : `faltan ${formatCurrency(summary.shortfall, currency)}/mes`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(record.id)}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-z-sage-dark transition-colors active:bg-white/5"
              aria-label={`Eliminar ${record.name}`}
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => onContinue(record)}
              className={cn(
                "h-11 shrink-0 rounded-md border px-3 text-xs font-semibold transition-colors",
                BRASS_GHOST_BUTTON_CLASS,
              )}
            >
              Continuar
            </button>
          </div>
        );
      })}
    </div>
  );
}
