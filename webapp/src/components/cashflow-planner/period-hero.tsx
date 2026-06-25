"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  PANEL_SURFACE_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import type { PeriodPlanData } from "@/types/cashflow-planner";

/**
 * The living-timeline hero. A segmented toggle swaps the headline between
 * "Puedo gastar" (saldo actual − comprometido_ahora) and "Comprometido"
 * (the time-aware ahora figure). Both stay legible via the secondary line,
 * the split bar, and the two stat tiles. "Cubierto por próximo ingreso" is
 * surfaced as context — it does NOT drain Puedo gastar.
 */
export function PeriodHero({ data }: { data: PeriodPlanData }) {
  const [mode, setMode] = useState<"libre" | "comprometido">("libre");

  const {
    currency,
    saldo_actual,
    puedo_gastar,
    comprometido_ahora,
    comprometido_cubierto,
  } = data;

  const negative = puedo_gastar < 0;
  const pendingCount = data.expense_entries.filter(
    (e) => e.status !== "COMPLETED" && e.status !== "SKIPPED"
  ).length;

  const heroAmount = mode === "libre" ? puedo_gastar : comprometido_ahora;
  const heroEyebrow = mode === "libre" ? "Puedo gastar" : "Comprometido";
  const heroColor =
    mode === "libre"
      ? negative
        ? "text-z-expense"
        : "text-z-brass"
      : "text-z-alert";
  const secondary =
    mode === "libre"
      ? `Comprometido ${formatCurrency(comprometido_ahora, currency)}`
      : `Puedo gastar ${formatCurrency(puedo_gastar, currency)}`;

  const librePos = Math.max(puedo_gastar, 0);
  const barTotal = librePos + comprometido_ahora || 1;
  const librePct = (librePos / barTotal) * 100;
  const compPct = (comprometido_ahora / barTotal) * 100;

  const segBase =
    "flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors";

  return (
    <div className={cn(PANEL_SURFACE_CLASS, "flex flex-wrap gap-5 p-4")}>
      {/* Left: toggle + headline + bar */}
      <div className="flex-1 min-w-[16rem]">
        <div
          role="radiogroup"
          aria-label="Ver puedo gastar o comprometido"
          className="inline-flex gap-1 rounded-lg border border-white/6 bg-black/25 p-[3px]"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "libre"}
            onClick={() => setMode("libre")}
            className={cn(
              segBase,
              mode === "libre"
                ? "bg-z-brass/15 text-z-brass"
                : "text-muted-foreground"
            )}
          >
            Puedo gastar
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "comprometido"}
            onClick={() => setMode("comprometido")}
            className={cn(
              segBase,
              mode === "comprometido"
                ? "bg-z-alert/15 text-z-alert"
                : "text-muted-foreground"
            )}
          >
            Comprometido
          </button>
        </div>

        <div className="mt-4 min-h-[4rem]">
          <div className={SECTION_EYEBROW_CLASS}>{heroEyebrow}</div>
          <div
            className={cn(
              "mt-1.5 text-[2.6rem] font-extrabold leading-none tracking-tight tabular-nums",
              heroColor
            )}
          >
            {formatCurrency(heroAmount, currency)}
          </div>
        </div>
        <div className="mt-1 text-[12.5px] text-muted-foreground tabular-nums">
          {secondary}
        </div>

        {/* Split bar: libre vs comprometido-ahora */}
        <div className="mt-4 flex h-2 overflow-hidden rounded-md bg-white/5">
          <div
            className="bg-z-brass transition-[width,opacity] duration-200"
            style={{ width: `${librePct}%`, opacity: mode === "libre" ? 1 : 0.4 }}
          />
          <div
            className="bg-z-alert transition-[width,opacity] duration-200"
            style={{ width: `${compPct}%`, opacity: mode === "comprometido" ? 1 : 0.4 }}
          />
        </div>
        <div className="mt-2 flex justify-between gap-2 text-[11px] tabular-nums">
          <span className="text-z-brass">
            Libre {formatCurrency(librePos, currency)}
          </span>
          <span className="text-z-alert">
            Comprometido {formatCurrency(comprometido_ahora, currency)}
          </span>
        </div>
      </div>

      {/* Right: stat tiles */}
      <div className="flex flex-1 min-w-[16rem] gap-2.5">
        <div className={cn(PANEL_INSET_CLASS, "flex flex-1 flex-col p-3.5")}>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-z-income" />
            <span className={SECTION_EYEBROW_CLASS}>Saldo actual</span>
          </div>
          <div className="mt-2.5 text-xl font-bold tabular-nums tracking-tight text-z-white">
            {formatCurrency(saldo_actual, currency)}
          </div>
          <div className="mt-1 text-[10.5px] text-muted-foreground">
            cuentas reales · vivo
          </div>
        </div>

        <div className={cn(PANEL_INSET_CLASS, "flex flex-1 flex-col p-3.5")}>
          <span className={SECTION_EYEBROW_CLASS}>Comprometido</span>
          <div className="mt-2.5 text-xl font-bold tabular-nums tracking-tight text-z-alert">
            {formatCurrency(comprometido_ahora, currency)}
          </div>
          <div className="mt-1 text-[10.5px] text-muted-foreground">
            {pendingCount} {pendingCount === 1 ? "gasto" : "gastos"} por pagar
          </div>
          {comprometido_cubierto > 0 && (
            <div className="mt-1 text-[10.5px] text-z-income">
              + {formatCurrency(comprometido_cubierto, currency)} cubierto
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
