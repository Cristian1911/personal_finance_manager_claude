"use client";

import { useState } from "react";
import { ArrowRight, Bookmark } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StateChip } from "@/components/mobile/v2/state-chip";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  GHOST_BUTTON_CLASS,
  BRASS_BUTTON_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { isLineTouched, type BudgetScenarioDraft, type BudgetScenarioSummary } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

function TotalsCompare({
  currentTotal,
  scenarioTotal,
  income,
  currency,
}: {
  currentTotal: number;
  scenarioTotal: number;
  income: number;
  currency: CurrencyCode;
}) {
  const col = (label: string, assigned: number) => {
    const rest = income - assigned;
    return (
      <div className="flex-1 rounded-xl border border-white/6 bg-black/15 px-3 py-2.5">
        <p className={SECTION_EYEBROW_CLASS}>
          {label}
        </p>
        <p className="mt-1 text-[15px] font-bold tabular-nums">
          {formatCurrency(assigned, currency)}
        </p>
        <p className="mt-0.5 text-[10px] tabular-nums text-z-sage-dark">
          restante{" "}
          <span className={cn("font-bold", rest < 0 ? "text-z-debt" : "text-z-income")}>
            {formatCurrency(rest, currency)}
          </span>
        </p>
      </div>
    );
  };

  return (
    <div className="flex items-stretch gap-2">
      {col("Actual", currentTotal)}
      <ArrowRight className="size-3.5 self-center text-z-sage-dark" strokeWidth={2} />
      {col("Escenario", scenarioTotal)}
    </div>
  );
}

// ─── E2 · Save as named draft ─────────────────────────────────────────────────

export function ScenarioSaveSheet({
  open,
  onOpenChange,
  draft,
  summary,
  currency,
  saving,
  onSave,
  onApplyInstead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: BudgetScenarioDraft;
  summary: BudgetScenarioSummary;
  currency: CurrencyCode;
  saving: boolean;
  onSave: (name: string) => void;
  onApplyInstead: () => void;
}) {
  const [name, setName] = useState(draft.name);

  const newCount = draft.lines.filter((l) => l.current == null).length;
  const changedCount = draft.lines.filter((l) => l.current != null && isLineTouched(l)).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={MOBILE_SHEET_SAFE_AREA_CLASS}>
        <SheetHeader>
          <SheetTitle>Guardar simulación</SheetTitle>
          <SheetDescription>Vuelve cuando quieras — no toca tu presupuesto.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-z-sage-light/16 bg-z-surface-2/55 px-3">
            <Bookmark className="size-3.5 shrink-0 text-z-alert" strokeWidth={1.5} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full bg-transparent text-sm font-semibold outline-none"
              aria-label="Nombre de la simulación"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <StateChip
              label={
                summary.fits
                  ? `sobran ${formatCurrency(-summary.shortfall, currency)}/mes`
                  : `faltan ${formatCurrency(summary.shortfall, currency)}/mes`
              }
              variant={summary.fits ? "sage" : "danger"}
            />
            {(newCount > 0 || changedCount > 0) && (
              <StateChip
                label={`${newCount} ${newCount === 1 ? "nuevo" : "nuevos"} · ${changedCount} ${changedCount === 1 ? "cambia" : "cambian"}`}
                variant="brass"
              />
            )}
            {summary.startupTotal > 0 && (
              <StateChip
                label={`${formatCurrency(summary.startupTotal, currency)} de arranque`}
                variant="brass"
              />
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onApplyInstead}
              className={cn(
                "h-11 flex-1 rounded-md border text-sm font-semibold transition-colors",
                GHOST_BUTTON_CLASS,
              )}
            >
              Aplicar ahora
            </button>
            <button
              type="button"
              disabled={saving || name.trim().length === 0}
              onClick={() => onSave(name.trim())}
              className={cn(
                "h-11 flex-1 rounded-md text-sm font-semibold transition-colors disabled:opacity-60",
                BRASS_BUTTON_CLASS,
              )}
            >
              {saving ? "Guardando…" : "Guardar borrador"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Slim apply confirmation ──────────────────────────────────────────────────

export function ScenarioApplySheet({
  open,
  onOpenChange,
  draft,
  summary,
  income,
  currency,
  applying,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: BudgetScenarioDraft;
  summary: BudgetScenarioSummary;
  income: number;
  currency: CurrencyCode;
  applying: boolean;
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={MOBILE_SHEET_SAFE_AREA_CLASS}>
        <SheetHeader>
          <SheetTitle>{draft.name} → presupuesto real</SheetTitle>
          <SheetDescription>
            Tus límites mensuales se actualizan de inmediato. Lo gastado este mes no cambia.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
          <TotalsCompare
            currentTotal={summary.currentTotal}
            scenarioTotal={summary.scenarioTotal}
            income={income}
            currency={currency}
          />

          {!summary.fits && (
            <p className="rounded-xl border border-z-alert/25 bg-z-alert/8 px-3 py-2 text-[11px] leading-relaxed text-z-sage-light">
              Al escenario todavía le faltan{" "}
              <span className="font-bold tabular-nums text-z-debt">
                {formatCurrency(summary.shortfall, currency)}/mes
              </span>
              . Puedes aplicarlo igual y ajustar después.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(
                "h-11 flex-1 rounded-md border text-sm font-semibold transition-colors",
                GHOST_BUTTON_CLASS,
              )}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={applying}
              onClick={onConfirm}
              className={cn(
                "h-11 flex-[2] rounded-md text-sm font-semibold transition-colors disabled:opacity-60",
                BRASS_BUTTON_CLASS,
              )}
            >
              {applying ? "Aplicando…" : "Aplicar al presupuesto"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
