"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RowGauge } from "@/lib/utils/entity-row-model";

/** Número de tics de la barra. Igual que la fila de /deudas, para que las dos
 *  pantallas se vean como la misma cosa cuando la ola 4 las unifique. */
const TICK_COUNT = 14;

const GAUGE_FILL: Record<RowGauge["tone"], string> = {
  brass: "bg-z-brass",
  alert: "bg-z-alert",
  income: "bg-z-income",
};

const GAUGE_TEXT: Record<RowGauge["tone"], string> = {
  brass: "text-z-brass",
  alert: "text-z-alert",
  income: "text-z-income",
};

const TRAILING_COLOR = {
  debt: "text-z-debt",
  income: "text-z-income",
  neutral: "text-z-sage-light",
} as const;

function TickGauge({ gauge }: { gauge: RowGauge }) {
  const filled = Math.round((Math.min(100, gauge.pct) / 100) * TICK_COUNT);
  return (
    <span className="flex flex-1 items-center gap-0.5" aria-hidden>
      {Array.from({ length: TICK_COUNT }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 flex-1 rounded-[1.5px]",
            i < filled ? GAUGE_FILL[gauge.tone] : "bg-white/8",
          )}
        />
      ))}
    </span>
  );
}

export interface EntityRowProps {
  /** Insignia o avatar. La pantalla decide qué es. */
  leading: React.ReactNode;
  title: string;
  gauge?: RowGauge | null;
  /** Partes que se unen con " · ". */
  meta?: string[];
  trailing: {
    value: string;
    caption?: string;
    tone?: keyof typeof TRAILING_COLOR;
  };
  /** Contenido de la expansión. Sin esto la fila no expande. */
  children?: React.ReactNode;
  /** Abierto controlado. Omítelo para que la fila gestione el suyo. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Fila de entidad: colapsada muestra identidad + progreso + cifra; expandida
 * muestra lo que le pases. TODA la fila es el disparador — nada de un segundo
 * blanco táctil dentro de la fila colapsada.
 *
 * No hace fetching y no define acciones: eso vive en `children`, para que
 * /accounts pueda ofrecer "Archivar" donde /deudas ofrece "Abonar" sin que
 * esta primitiva sepa qué es una obligación.
 */
export function EntityRow({
  leading,
  title,
  gauge,
  meta,
  trailing,
  children,
  open,
  onOpenChange,
  className,
}: EntityRowProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const expandable = Boolean(children);

  function toggle() {
    const next = !isOpen;
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  const header = (
    <>
      <span className="shrink-0">{leading}</span>
      <span className="min-w-0 flex-1">
        {/* Compacta trunca para respetar el presupuesto de 86px; abierta deja
            envolver, que es cuando el usuario pidió el nombre completo. */}
        <span
          className={cn(
            "block text-[13px] font-semibold text-z-sage-light",
            isOpen ? "break-words" : "truncate",
          )}
        >
          {title}
        </span>
        {gauge && (
          <span className="mt-1.5 flex items-center gap-2">
            <TickGauge gauge={gauge} />
            <span
              className={cn(
                "shrink-0 text-[10px] font-bold tabular-nums",
                GAUGE_TEXT[gauge.tone],
              )}
            >
              {gauge.pct.toFixed(0)}%
            </span>
            <span className="shrink-0 text-[9px] text-muted-foreground">
              {gauge.label}
            </span>
          </span>
        )}
        {meta && meta.length > 0 && (
          <span
            className={cn(
              "mt-1 block text-[10px] tabular-nums text-muted-foreground",
              isOpen ? "break-words" : "truncate",
            )}
          >
            {meta.join(" · ")}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            "block text-sm font-bold tabular-nums",
            TRAILING_COLOR[trailing.tone ?? "neutral"],
          )}
        >
          {trailing.value}
        </span>
        {trailing.caption && (
          <span className="mt-0.5 block text-[9px] text-muted-foreground">
            {trailing.caption}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-white/6 bg-z-surface-2/60",
        isOpen && "border-z-brass/30",
        className,
      )}
    >
      {expandable ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-3 p-3 text-left"
        >
          {header}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
      ) : (
        <div className="flex w-full items-center gap-3 p-3">{header}</div>
      )}

      {expandable && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="px-3 pb-3">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
