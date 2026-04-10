"use client";

import Link from "next/link";
import { FileUp, BarChart3, Tags, Bell } from "lucide-react";
import { BRASS_BUTTON_CLASS, PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

const AFTER_IMPORT_ITEMS = [
  { icon: BarChart3, label: "Métricas activas" },
  { icon: Tags, label: "Auto-categorías" },
  { icon: Bell, label: "Alertas activas" },
] as const;

export function InicioStarter() {
  return (
    <div className="space-y-4">
      {/* Welcome text */}
      <div className="px-1">
        <p className="text-[15px] font-semibold text-foreground">
          Tu base está lista
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Falta activar tu flujo con datos reales.
        </p>
      </div>

      {/* Import CTA card */}
      <div
        className={cn(
          "rounded-2xl border border-z-brass/20 p-4",
          "bg-[linear-gradient(135deg,rgba(var(--z-brass-rgb,183,165,122),0.06),transparent_50%)]"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Icon box */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-z-brass/20 bg-z-brass/10">
            <FileUp className="h-5 w-5 text-z-brass" />
          </div>

          {/* Text + actions */}
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-[15px] font-semibold text-foreground">
                Importa tu primer extracto
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Al importar un extracto PDF, Zeta activa tus métricas, categoriza
                automáticamente y detecta patrones de gasto.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/import"
                className={cn(
                  BRASS_BUTTON_CLASS,
                  "inline-flex items-center rounded-lg px-4 py-2 text-[13px] font-semibold"
                )}
              >
                Importar extracto
              </Link>
              <Link
                href="/transactions"
                className="text-[11px] font-medium text-z-sage-light hover:text-foreground"
              >
                registrar manual
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* After import benefits */}
      <div>
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-z-sage-dark">
          Después de importar
        </p>
        <div className="grid grid-cols-3 gap-2">
          {AFTER_IMPORT_ITEMS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className={cn(PANEL_INSET_CLASS, "flex flex-col items-center gap-1.5 p-3")}
            >
              <Icon className="h-4 w-4 text-z-brass" />
              <span className="text-center text-[10px] font-medium text-z-sage-light">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
