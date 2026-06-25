"use client";
import { useState } from "react";
import { PANEL_SURFACE_CLASS, SEGMENTED_TAB_ACTIVE_CLASS, SEGMENTED_TAB_CLASS } from "@/lib/constants/styles";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
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
    <div className="mx-auto w-full max-w-2xl px-4">
      <div className="pt-4">
        <SectionEyebrow>Análisis</SectionEyebrow>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Tendencias</h1>
      </div>

      <VerdictHeader verdict={vm.verdict} />
      <PeriodControl range={vm.range} />

      <div role="tablist" className="mt-4 flex gap-1 rounded-full border border-white/6 bg-black/10 p-1">
        {LENSES.map((l) => (
          <button
            key={l.id}
            role="tab"
            type="button"
            aria-selected={lens === l.id}
            onClick={() => setLens(l.id)}
            className={lens === l.id ? SEGMENTED_TAB_ACTIVE_CLASS : SEGMENTED_TAB_CLASS}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {lens === "gastos" && <LensGastos data={vm.gastos} currency={vm.currency} />}
        {lens === "ahorro" && (
          <div className={`${PANEL_SURFACE_CLASS} p-6 text-center text-sm text-z-sage-dark`}>
            Lente de ahorro — próximamente
          </div>
        )}
        {lens === "cambios" && (
          <div className={`${PANEL_SURFACE_CLASS} p-6 text-center text-sm text-z-sage-dark`}>
            Lente de cambios — próximamente
          </div>
        )}
      </div>
    </div>
  );
}
