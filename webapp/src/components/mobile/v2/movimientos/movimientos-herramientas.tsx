"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { MobileZone } from "@/components/mobile/v2/mobile-zone";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { ArrowRight } from "lucide-react";

interface MovimientosHerramientasProps {
  uncategorizedCount: number;
  pendingMatchCount: number;
  pendingEmailCount: number;
  expandedTool: string | null;
  onToggleTool: (id: string) => void;
}

type ToolZone = "categorizar" | "destinatarios" | "importar";

const accentStyles = {
  categorizar: {
    chip: "border-z-brass/30 bg-[linear-gradient(180deg,rgba(var(--z-brass-rgb,183,165,122),0.08),transparent)]",
    panel: "border-z-brass/20",
    eyebrow: "text-z-brass",
    link: "text-z-brass",
  },
  destinatarios: {
    chip: "border-z-alert/30 bg-[linear-gradient(180deg,rgba(var(--z-alert-rgb,230,176,60),0.08),transparent)]",
    panel: "border-z-alert/20",
    eyebrow: "text-z-alert",
    link: "text-z-alert",
  },
  importar: {
    chip: "border-z-sage/30 bg-[linear-gradient(180deg,rgba(var(--z-sage-rgb,142,168,130),0.08),transparent)]",
    panel: "border-z-sage/20",
    eyebrow: "text-z-sage",
    link: "text-z-sage-light",
  },
} as const;

export function MovimientosHerramientas({
  uncategorizedCount,
  pendingMatchCount,
  pendingEmailCount,
  expandedTool,
  onToggleTool,
}: MovimientosHerramientasProps) {
  const activeZone = expandedTool as ToolZone | null;
  const toggle = onToggleTool;
  const isActive = (zone: ToolZone) => activeZone === zone;

  const activeAccent = activeZone ? accentStyles[activeZone] : null;

  return (
    <MobileZone eyebrow="HERRAMIENTAS">
      {/* Tool chips row */}
      <div className="grid grid-cols-3 gap-1.5">
        {/* PRIMARY — Categorizar */}
        <button
          type="button"
          onClick={() => toggle("categorizar")}
          className={cn(
            "rounded-[14px] border p-2.5 text-center transition-colors",
            isActive("categorizar")
              ? accentStyles.categorizar.chip
              : cn(
                  "border-z-brass/30",
                  "bg-[linear-gradient(180deg,rgba(var(--z-brass-rgb,183,165,122),0.08),transparent)]"
                )
          )}
          aria-expanded={isActive("categorizar")}
        >
          <p className="text-[22px] font-[680] leading-tight text-z-brass">
            {uncategorizedCount}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Categorizar
          </p>
          {uncategorizedCount > 0 && (
            <p className="mt-1 flex items-center justify-center gap-1 text-[9px] text-z-debt">
              <span className="inline-block size-1.5 rounded-full bg-z-debt" />
              {uncategorizedCount} por resolver
            </p>
          )}
        </button>

        {/* Destinatarios */}
        <button
          type="button"
          onClick={() => toggle("destinatarios")}
          className={cn(
            "rounded-[14px] p-2.5 text-center transition-colors",
            isActive("destinatarios")
              ? cn("border", accentStyles.destinatarios.chip)
              : cn(PANEL_INSET_CLASS)
          )}
          aria-expanded={isActive("destinatarios")}
        >
          <p className="text-[22px] font-[680] leading-tight">
            {pendingMatchCount}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Destinatarios
          </p>
          {pendingMatchCount > 0 && (
            <p className="mt-1 flex items-center justify-center gap-1 text-[9px] text-z-alert">
              <span className="inline-block size-1.5 rounded-full bg-z-alert" />
              {pendingMatchCount} sugerencias
            </p>
          )}
        </button>

        {/* Importar — email pending */}
        <button
          type="button"
          onClick={() => toggle("importar")}
          className={cn(
            "rounded-[14px] p-2.5 text-center transition-colors",
            isActive("importar")
              ? cn("border", accentStyles.importar.chip)
              : cn(PANEL_INSET_CLASS)
          )}
          aria-expanded={isActive("importar")}
        >
          <p className="text-[22px] font-[680] leading-tight">
            {pendingEmailCount}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Importar
          </p>
          <p className="mt-1 text-[9px] text-muted-foreground">
            {pendingEmailCount > 0 ? "emails pendientes" : "sin pendientes"}
          </p>
        </button>
      </div>

      {/* Expandable detail panel — full width below all 3 chips */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: activeZone ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-1.5 transition-opacity duration-150",
              activeZone ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {activeZone && (
              <div
                className={cn(
                  PANEL_INSET_CLASS,
                  "border-white/8 bg-black/20 p-3",
                  activeAccent?.panel
                )}
              >
                {activeZone === "categorizar" && (
                  <CategorizarDetail count={uncategorizedCount} />
                )}
                {activeZone === "destinatarios" && (
                  <DestinatariosDetail count={pendingMatchCount} />
                )}
                {activeZone === "importar" && (
                  <ImportarDetail count={pendingEmailCount} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileZone>
  );
}

/* ─── Detail panels ──────────────────────────────────────────────────────── */

function CategorizarDetail({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
        Transacciones sin categoría
      </p>
      <p className="text-xs text-z-sage-light">
        {count > 0
          ? `${count} transaccion${count !== 1 ? "es" : ""} esperan ser categorizadas para mejorar tu presupuesto.`
          : "Todas las transacciones están categorizadas."}
      </p>
      {count > 0 && (
        <Link
          href="/categorizar"
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
        >
          Categorizar todas
          <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

function DestinatariosDetail({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-alert">
        Asignaciones pendientes
      </p>
      <p className="text-xs text-z-sage-light">
        {count > 0
          ? `${count} transaccion${count !== 1 ? "es" : ""} sin destinatario asignado. Asignarlos mejora la detección automática.`
          : "Todos los destinatarios están asignados."}
      </p>
      {count > 0 && (
        <Link
          href="/destinatarios"
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-z-alert"
        >
          Ir a destinatarios
          <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

function ImportarDetail({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-sage">
        Importación por email
      </p>
      <p className="text-xs text-z-sage-light">
        {count > 0
          ? `${count} transaccion${count !== 1 ? "es" : ""} por email esperando importación.`
          : "No hay transacciones pendientes de importar."}
      </p>
      {count > 0 && (
        <Link
          href="/import"
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-z-sage-light"
        >
          Ir a importar
          <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
