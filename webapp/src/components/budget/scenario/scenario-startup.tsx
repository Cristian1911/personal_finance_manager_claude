"use client";

import { useState } from "react";
import { Plus, Heart, RotateCcw, CalendarClock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  PANEL_SURFACE_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
  BRASS_BUTTON_CLASS,
} from "@/lib/constants/styles";
import { computeFundingTimeline, computeStartupPlan, type BudgetScenarioDraft } from "@zeta/shared";
import { AffordChip } from "./scenario-shared";
import { STARTUP_RATE_OPTIONS, type ScenarioDeseoOption } from "./scenario-model";
import type { CurrencyCode } from "@/types/domain";

const VERDICT_DOT: Record<string, string> = {
  BUY: "border-z-income",
  BUY_WITH_CAUTION: "border-z-alert",
  WAIT: "border-z-expense",
  NOT_RECOMMENDED: "border-z-debt",
};

function monthLabels(count: number): string[] {
  const labels = ["hoy"];
  const fmt = new Intl.DateTimeFormat("es-CO", { month: "short" });
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + i);
    labels.push(fmt.format(d).replace(".", ""));
  }
  return labels;
}

// ─── Add-item sheet: pull from Deseos or ad hoc ──────────────────────────────

function AddStartupSheet({
  open,
  onOpenChange,
  deseos,
  usedWishlistIds,
  currency,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deseos: ScenarioDeseoOption[];
  usedWishlistIds: Set<string>;
  currency: CurrencyCode;
  onAdd: (item: { name: string; amount: number; deseo: ScenarioDeseoOption | null }) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const available = deseos.filter((d) => !usedWishlistIds.has(d.id));

  const addAdhoc = () => {
    const n = parseInt(amount || "0", 10);
    if (!name.trim() || Number.isNaN(n) || n <= 0) return;
    onAdd({ name: name.trim(), amount: n, deseo: null });
    setName("");
    setAmount("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("max-h-[80dvh]", MOBILE_SHEET_SAFE_AREA_CLASS)}>
        <SheetHeader>
          <SheetTitle>Agregar gasto de arranque</SheetTitle>
          <SheetDescription>
            Compras de una sola vez para que el cambio arranque.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-4">
          {available.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Desde tus Deseos
              </p>
              <div className="space-y-1.5">
                {available.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onAdd({ name: d.name, amount: d.amount, deseo: d });
                      onOpenChange(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-white/6 bg-[#111] px-3 py-2.5 text-left transition-colors active:bg-white/5"
                  >
                    <Heart className="size-3.5 shrink-0 text-z-brass" strokeWidth={1.5} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                    <AffordChip verdict={d.verdict} />
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(d.amount, currency)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Otro gasto
            </p>
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre — ej. Nevera"
                className="h-11 w-full rounded-xl border border-white/6 bg-[#111] px-3 text-sm outline-none placeholder:text-z-sage-dark focus-visible:border-z-alert/35"
              />
              <div className="flex gap-2">
                <div className="flex h-11 flex-1 items-center gap-1 rounded-xl border border-white/6 bg-[#111] px-3">
                  <span className="text-sm text-z-sage-dark">$</span>
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-z-sage-dark"
                    aria-label="Monto del gasto"
                  />
                </div>
                <button
                  type="button"
                  onClick={addAdhoc}
                  className={cn(
                    "h-11 rounded-md px-4 text-sm font-semibold transition-colors",
                    BRASS_BUTTON_CLASS,
                  )}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── D2 · Funding timeline (interactive) ─────────────────────────────────────

export function ScenarioStartup({
  draft,
  cushion,
  deseos,
  currency,
  onSetRate,
  onToggleCushion,
  onAddItem,
  onToggleDefer,
}: {
  draft: BudgetScenarioDraft;
  cushion: number;
  deseos: ScenarioDeseoOption[];
  currency: CurrencyCode;
  onSetRate: (rate: number) => void;
  onToggleCushion: () => void;
  onAddItem: (item: { name: string; amount: number; deseo: ScenarioDeseoOption | null }) => void;
  onToggleDefer: (itemId: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { items, monthlyRate, useCushion } = draft.startup;

  const plan = computeStartupPlan(draft, cushion);
  const timeline = computeFundingTimeline(draft, cushion);
  const maxMonth = Math.max(0, ...timeline.map((e) => e.readyInMonths ?? 0));
  const span = Math.max(maxMonth, 5);
  const labels = monthLabels(span);
  const usedWishlistIds = new Set(
    items.map((i) => i.wishlistItemId).filter((id): id is string => id != null),
  );
  const byId = new Map(timeline.map((e) => [e.itemId, e]));

  return (
    <div className="space-y-2">
      <div className={cn(PANEL_SURFACE_CLASS, "p-4")}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Gastos de arranque
          </p>
          <span className="text-[10px] text-z-sage-dark">una sola vez</span>
        </div>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[22px] font-extrabold tabular-nums">
            {formatCurrency(plan.total, currency)}
          </span>
          {items.length > 0 && (
            <span
              className={cn(
                "text-[11px]",
                plan.months === 0 ? "text-z-income" : "text-z-sage-light",
              )}
            >
              todo listo{" "}
              {plan.months === 0
                ? "hoy"
                : `en ${plan.months} ${plan.months === 1 ? "mes" : "meses"}`}
            </span>
          )}
        </div>

        {items.length > 0 && (
          <>
            <div
              role="group"
              aria-label="Ritmo de ahorro mensual"
              className="mt-3 flex gap-1 rounded-xl border border-white/6 bg-black/25 p-0.5"
            >
              {STARTUP_RATE_OPTIONS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onSetRate(rate)}
                  className={cn(
                    "h-8 flex-1 rounded-lg text-[11px] font-semibold tabular-nums transition-colors",
                    monthlyRate === rate
                      ? "border border-z-brass/35 bg-z-surface-3 text-foreground"
                      : "text-z-sage-dark",
                  )}
                >
                  $ {rate / 1000}K/mes
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleCushion}
              role="switch"
              aria-checked={useCushion}
              className={cn(
                "mt-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
                useCushion ? "border-z-income/30 bg-z-income/6" : "border-white/6 bg-black/15",
              )}
            >
              <span
                className={cn(
                  "relative h-4 w-7 shrink-0 rounded-full transition-colors",
                  useCushion ? "bg-z-income" : "bg-white/12",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-3 rounded-full bg-z-ink transition-all",
                    useCushion ? "left-3.5" : "left-0.5",
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-[11.5px] font-semibold",
                  useCushion ? "text-z-income" : "text-z-sage-light",
                )}
              >
                Usar colchón actual · {formatCurrency(cushion, currency)}
              </span>
            </button>

            {/* Timeline */}
            <div className="relative mx-1.5 mt-5 h-0.5 rounded-full bg-white/8">
              {labels.map((_, m) => (
                <span
                  key={m}
                  className="absolute -top-0.5 h-1.5 w-px bg-white/14"
                  style={{ left: `${(m / span) * 100}%` }}
                />
              ))}
              {timeline.map((entry) => {
                if (entry.readyInMonths == null) return null;
                const item = items.find((i) => i.id === entry.itemId);
                return (
                  <span
                    key={entry.itemId}
                    title={`${entry.name} · ${entry.readyInMonths === 0 ? "hoy" : labels[Math.min(entry.readyInMonths, span)]}`}
                    className={cn(
                      "absolute -top-[7px] size-4 -translate-x-1/2 rounded-full border-2 bg-z-ink transition-[left] duration-200",
                      VERDICT_DOT[item?.verdict ?? "BUY"],
                    )}
                    style={{ left: `${(Math.min(entry.readyInMonths, span) / span) * 100}%` }}
                  />
                );
              })}
            </div>
            <div className="mx-1.5 mt-2.5 flex justify-between">
              {labels.map((label, m) => (
                <span
                  key={m}
                  className="text-[9px] font-semibold uppercase tracking-[0.06em] text-z-sage-dark"
                >
                  {label}
                </span>
              ))}
            </div>
          </>
        )}

        {items.length === 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-z-sage-dark">
            Agrega las compras que el cambio necesita (nevera, muebles…) y calcula cuándo estarán
            fondeadas.
          </p>
        )}
      </div>

      {items.map((item) => {
        const entry = byId.get(item.id);
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border border-white/6 bg-[#111] px-3 py-2",
              item.deferred && "opacity-55",
            )}
          >
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full border-2",
                VERDICT_DOT[item.verdict ?? "BUY"],
              )}
            />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-[12.5px] font-semibold",
                  item.deferred && "line-through decoration-z-sage-dark/60",
                )}
              >
                {item.name}
              </span>
              {item.wishlistItemId && (
                <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-z-brass">
                  <Heart className="size-2.5" strokeWidth={2} /> de Deseos
                </span>
              )}
            </span>
            <AffordChip verdict={item.verdict} />
            <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-z-sage-light">
              {formatCurrency(item.amount, currency)}
            </span>
            <span
              className={cn(
                "w-10 shrink-0 text-right text-[11px] font-bold tabular-nums",
                item.deferred
                  ? "text-z-sage-dark"
                  : entry?.readyInMonths === 0
                    ? "text-z-income"
                    : "text-z-sage-light",
              )}
            >
              {item.deferred
                ? "—"
                : entry?.readyInMonths === 0
                  ? "hoy"
                  : labels[Math.min(entry?.readyInMonths ?? 0, span)]}
            </span>
            <button
              type="button"
              onClick={() => onToggleDefer(item.id)}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-z-sage-dark transition-colors active:bg-white/5"
              aria-label={item.deferred ? `Retomar ${item.name}` : `Aplazar ${item.name}`}
            >
              {item.deferred ? (
                <RotateCcw className="size-3.5" strokeWidth={1.5} />
              ) : (
                <CalendarClock className="size-3.5" strokeWidth={1.5} />
              )}
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-z-alert/25 text-xs font-semibold text-z-alert transition-colors active:bg-z-alert/8"
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
        Agregar gasto de arranque
      </button>

      {items.some((i) => !i.deferred) && (
        <p className="text-[10px] leading-relaxed text-z-sage-dark">
          Orden de compra sugerido por el veredicto de Deseos: primero lo que el motor aprueba.
        </p>
      )}

      <AddStartupSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        deseos={deseos}
        usedWishlistIds={usedWishlistIds}
        currency={currency}
        onAdd={onAddItem}
      />
    </div>
  );
}
