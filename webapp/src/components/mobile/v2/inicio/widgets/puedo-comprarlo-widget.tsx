"use client";

import { Lightbulb } from "lucide-react";
import { ChipEyebrow } from "../widget-chip";
import type { WidgetRender } from "../widget-grid";

interface PuedoComprarloWidgetProps {
  /** Invoked when the chip is tapped — opens the recommender drawer from the host. */
  onOpen: () => void;
}

export function renderPuedoComprarloWidget(
  props: PuedoComprarloWidgetProps,
): WidgetRender {
  const { onOpen } = props;

  return {
    tone: "brass",
    accessibilityLabel: "¿Puedo comprarlo? — abrir calculadora",
    onPress: onOpen,
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
    detail: null,
  };
}
