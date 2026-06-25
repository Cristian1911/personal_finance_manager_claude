"use client";
import { useState } from "react";
import type { TendenciasViewModel } from "./types";
import { VerdictHeader } from "./verdict-header";
import { PeriodControl } from "./period-control";
import { LensGastos } from "./lens-gastos";

type Lens = "gastos" | "ahorro" | "cambios";
const LENSES: { id: Lens; label: string }[] = [
  { id: "gastos", label: "¿A dónde va?" },
  { id: "ahorro", label: "¿Voy bien?" },
  { id: "cambios", label: "¿Cambios?" },
];

export function TendenciasShell({ vm }: { vm: TendenciasViewModel }) {
  const [lens, setLens] = useState<Lens>("gastos");
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10">
      <div className="pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">Análisis</p>
        <h1 className="text-2xl font-semibold tracking-tight">Tendencias</h1>
      </div>

      <VerdictHeader verdict={vm.verdict} />
      <PeriodControl range={vm.range} />

      <div role="tablist" className="mt-4 flex gap-1 rounded-xl border border-white/6 bg-z-surface-2/60 p-1">
        {LENSES.map((l) => (
          <button
            key={l.id}
            role="tab"
            type="button"
            aria-selected={lens === l.id}
            onClick={() => setLens(l.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              lens === l.id ? "bg-z-brass/12 text-z-brass" : "text-z-sage-dark hover:text-z-sage-light"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {lens === "gastos" && <LensGastos data={vm.gastos} currency={vm.currency} />}
        {lens === "ahorro" && (
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/80 p-6 text-center text-sm text-z-sage-dark">
            Lente de ahorro — próximamente
          </div>
        )}
        {lens === "cambios" && (
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/80 p-6 text-center text-sm text-z-sage-dark">
            Lente de cambios — próximamente
          </div>
        )}
      </div>
    </div>
  );
}
