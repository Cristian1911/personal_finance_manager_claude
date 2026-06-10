"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CategoryIcon } from "@/components/categories/category-icon";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { MOBILE_SHEET_SAFE_AREA_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import { isLineTouched, type BudgetScenarioLine } from "@zeta/shared";
import { DeltaChip, NuevoBadge, FijoBadge, PromAnchor } from "./scenario-shared";
import type { ScenarioCategoryOption } from "./scenario-model";
import type { CurrencyCode } from "@/types/domain";

// ─── Inline amount editing (tap → numeric input) ─────────────────────────────

function EditAmount({
  value,
  currency,
  locked,
  onChange,
}: {
  value: number;
  currency: CurrencyCode;
  locked: boolean;
  onChange: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (locked) {
    return (
      <span className="text-sm font-semibold tabular-nums text-z-sage-light">
        {formatCurrency(value, currency)}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value > 0 ? String(value) : "");
          setEditing(true);
        }}
        className="rounded-md px-1 py-0.5 transition-colors active:bg-white/5"
        aria-label="Editar monto"
      >
        <span className="border-b border-dashed border-z-alert/25 pb-px text-sm font-bold tabular-nums">
          {formatCurrency(value, currency)}
        </span>
      </button>
    );
  }

  const commit = () => {
    const n = parseInt(draft || "0", 10);
    onChange(Number.isNaN(n) ? value : n);
    setEditing(false);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5 rounded-lg border border-z-alert/35 bg-black/35 px-2 py-1">
        <span className="text-xs text-z-sage-dark">$</span>
        <input
          autoFocus
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          onBlur={commit}
          className="w-[88px] bg-transparent text-[13px] font-bold tabular-nums text-foreground outline-none"
          aria-label="Nuevo monto"
        />
      </span>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          commit();
        }}
        className="flex size-7 items-center justify-center rounded-lg border border-z-alert/35 bg-z-alert/12 text-z-alert"
        aria-label="Confirmar monto"
      >
        <Check className="size-3" strokeWidth={2.5} />
      </button>
    </span>
  );
}

// ─── B3 · Reality-anchor row ──────────────────────────────────────────────────
// Bar fill = real spending (prom 3m) · white marker = scenario budget.
// If the fill passes the marker, the plan collides with current habits.

function RealityRow({
  line,
  currency,
  onChange,
}: {
  line: BudgetScenarioLine;
  currency: CurrencyCode;
  onChange: (n: number) => void;
}) {
  const max = Math.max(line.avg3m ?? 0, line.scenario, 1) * 1.15;
  const delta = line.current == null ? null : line.scenario - line.current;
  const overReal = line.avg3m != null && line.avg3m > line.scenario;
  const isNew = line.current == null;

  return (
    <div className="rounded-xl border border-white/6 bg-[#111] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold">{line.name}</span>
          {isNew && <NuevoBadge />}
          {line.isFixed && <FijoBadge />}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {delta != null && delta !== 0 && <DeltaChip value={delta} currency={currency} />}
          {isNew && line.scenario > 0 && <DeltaChip value={line.scenario} currency={currency} />}
          <EditAmount
            value={line.scenario}
            currency={currency}
            locked={line.isFixed}
            onChange={onChange}
          />
        </span>
      </div>

      <div className="relative mt-2 h-2 rounded-full bg-white/6">
        {line.avg3m != null && (
          <div
            className={cn(
              "absolute left-0 top-px h-1.5 rounded-full",
              overReal ? "bg-z-alert/55" : "bg-z-sage/55",
            )}
            style={{ width: `${Math.min(100, (line.avg3m / max) * 100)}%` }}
          />
        )}
        <div
          className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-foreground"
          style={{ left: `${Math.min(100, (line.scenario / max) * 100)}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <PromAnchor avg3m={line.avg3m} scenario={line.scenario} currency={currency} />
        <span className="text-[9px] text-z-sage-dark">presupuesto │</span>
      </div>
    </div>
  );
}

// ─── Sticky total footer ──────────────────────────────────────────────────────

export function ScenarioEditorFooter({
  total,
  income,
  currency,
}: {
  total: number;
  income: number;
  currency: CurrencyCode;
}) {
  const diff = income - total;
  const short = diff < 0;
  const max = Math.max(total, income, 1);

  return (
    <div
      className={cn(
        "sticky bottom-2 z-10 rounded-xl border bg-[#111]/95 px-3.5 py-2.5 backdrop-blur-sm",
        short ? "border-z-debt/30" : "border-z-income/30",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-z-sage-dark">Total escenario</span>
        <span className="text-[17px] font-bold tabular-nums">
          {formatCurrency(total, currency)}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-white/6">
        <div
          className={cn("h-full rounded-full", short ? "bg-z-debt" : "bg-z-income")}
          style={{ width: `${(total / max) * 100}%` }}
        />
        <div
          className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-foreground/55"
          style={{ left: `${(income / max) * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums">
        <span className="text-z-sage-dark">Ingreso {formatCurrency(income, currency)}</span>
        <span className={cn("font-bold", short ? "text-z-debt" : "text-z-income")}>
          {short
            ? `${formatCurrency(-diff, currency)} sobre tu ingreso`
            : `${formatCurrency(diff, currency)} libres`}
        </span>
      </div>
    </div>
  );
}

// ─── Editor: friction lines first, calm lines after ──────────────────────────

export function ScenarioEditor({
  lines,
  currency,
  categories,
  onChangeLine,
  onAddCategory,
}: {
  lines: BudgetScenarioLine[];
  currency: CurrencyCode;
  categories: ScenarioCategoryOption[];
  onChangeLine: (categoryId: string, amount: number) => void;
  onAddCategory: (cat: ScenarioCategoryOption) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasFriction = (l: BudgetScenarioLine) =>
    isLineTouched(l) || (l.avg3m != null && l.avg3m > l.scenario);
  const friction = lines.filter(hasFriction);
  const calm = lines.filter((l) => !hasFriction(l));
  const available = categories.filter((c) => !lines.some((l) => l.categoryId === c.id));

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-z-sage-dark">
        La barra muestra tu gasto real (prom 3m) contra el presupuesto del escenario (│). Si la
        barra pasa la marca, el plan choca con tus hábitos.
      </p>

      <div className="space-y-1.5">
        {friction.map((l) => (
          <RealityRow
            key={l.categoryId}
            line={l}
            currency={currency}
            onChange={(n) => onChangeLine(l.categoryId, n)}
          />
        ))}
      </div>

      {calm.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <span className={SECTION_EYEBROW_CLASS}>
              Sin fricción
            </span>
            <span className="h-px flex-1 bg-white/6" />
          </div>
          <div className="space-y-1.5">
            {calm.map((l) => (
              <RealityRow
                key={l.categoryId}
                line={l}
                currency={currency}
                onChange={(n) => onChangeLine(l.categoryId, n)}
              />
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-z-alert/25 text-xs font-semibold text-z-alert transition-colors active:bg-z-alert/8"
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
        Agregar categoría
      </button>

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className={cn("max-h-[75dvh]", MOBILE_SHEET_SAFE_AREA_CLASS)}>
          <SheetHeader>
            <SheetTitle>Agregar categoría al escenario</SheetTitle>
            <SheetDescription>
              Las categorías sin presupuesto entran como líneas nuevas.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-1.5 overflow-y-auto px-4 pb-4">
            {available.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Todas tus categorías ya están en el escenario.
              </p>
            )}
            {available.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onAddCategory(cat);
                  setPickerOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-[#111] px-3 py-2.5 text-left transition-colors active:bg-white/5"
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  <CategoryIcon icon={cat.icon} className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{cat.name}</span>
                  <span className="block text-[10px] text-z-sage-dark">
                    {cat.avg3m != null && cat.avg3m > 0
                      ? `gastas ${formatCurrency(cat.avg3m, currency)} prom 3m`
                      : "sin historial"}
                  </span>
                </span>
                <NuevoBadge />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
