"use client";
import { useState } from "react";
import { SEGMENTED_TAB_ACTIVE_CLASS, SEGMENTED_TAB_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import type { TendenciasViewModel } from "./types";
import { VerdictHeader } from "./verdict-header";
import { PeriodControl } from "./period-control";
import { LensGastos } from "./lens-gastos";
import { LensAhorro } from "./lens-ahorro";
import { LensCambios } from "./lens-cambios";
import { ExportButton } from "./export-button";

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
      <div className="flex items-start justify-between pt-4">
        <div>
          <SectionEyebrow>Análisis</SectionEyebrow>
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Tendencias</h1>
        </div>
        <ExportButton categories={vm.gastos.categories} months={vm.months} range={vm.range} />
      </div>

      <VerdictHeader verdict={vm.verdict} />
      <PeriodControl range={vm.range} />

      <div role="tablist" className="mt-4 flex gap-1 overflow-x-auto rounded-full border border-white/6 bg-black/10 p-1">
        {LENSES.map((l) => (
          <button
            key={l.id}
            role="tab"
            type="button"
            aria-selected={lens === l.id}
            onClick={() => setLens(l.id)}
            className={cn(
              lens === l.id ? SEGMENTED_TAB_ACTIVE_CLASS : SEGMENTED_TAB_CLASS,
              "flex-none whitespace-nowrap sm:flex-1",
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {lens === "gastos" && (
          <LensGastos
            data={vm.gastos}
            currency={vm.currency}
            windowFrom={vm.windowFrom}
            windowTo={vm.windowTo}
          />
        )}
        {lens === "ahorro" && <LensAhorro data={vm.ahorro} currency={vm.currency} />}
        {lens === "cambios" && <LensCambios data={vm.cambios} currency={vm.currency} />}
      </div>
    </div>
  );
}
