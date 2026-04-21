"use client";

import { ArrowRight, Lightbulb } from "lucide-react";
import { ChipEyebrow } from "../widget-chip";
import type { WidgetRender } from "../widget-grid";
import { BRASS_BUTTON_CLASS, PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

interface PuedoComprarloWidgetProps {
  /** Invoked by the CTA inside the expanded detail — navigates to /puedo-pagar. */
  onOpen: () => void;
}

export function renderPuedoComprarloWidget({
  onOpen,
}: PuedoComprarloWidgetProps): WidgetRender {
  return {
    tone: "brass",
    accessibilityLabel: "¿Puedo comprarlo? — ver info",
    chip: (
      <div className="flex h-full flex-col items-center gap-1.5 text-center">
        <ChipEyebrow tone="brass">¿Comprarlo?</ChipEyebrow>
        <span className="flex flex-1 items-center justify-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-z-brass/12">
            <Lightbulb className="size-5 text-z-brass" aria-hidden />
          </span>
        </span>
        <p className="text-[10px] text-muted-foreground">Evaluar</p>
      </div>
    ),
    detail: (
      <div className={cn(PANEL_INSET_CLASS, "space-y-3 p-3")}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Decidí sin culpa
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Cuéntale a Zeta qué quieres comprar y cuánto cuesta. Revisamos tu
            liquidez, pagos próximos y presupuesto para darte una respuesta
            honesta: sí, espera o no recomendado.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            BRASS_BUTTON_CLASS,
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
          )}
        >
          Abrir analizador
          <ArrowRight className="size-4" />
        </button>
      </div>
    ),
  };
}
