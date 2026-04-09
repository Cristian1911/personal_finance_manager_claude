"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS, BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { PurchaseRecommenderDrawer } from "./purchase-recommender-drawer";

// ─── Icons ───────────────────────────────────────────────────────────────────

function LightbulbIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="var(--color-z-brass)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 12.5h4M6.5 14h3M8 1.5a4.5 4.5 0 0 0-2.5 8.2c.4.3.5.6.5 1v.8h4v-.8c0-.4.2-.7.5-1A4.5 4.5 0 0 0 8 1.5z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="var(--color-z-brass)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x={2} y={3} width={12} height={11} rx={2} />
      <path d="M5 1.5v3M11 1.5v3M2 7h12" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-z-brass/20 bg-z-brass/10">
      {children}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface InicioDiscoveryProps {
  expanded: string | null;
  onToggle: (id: string) => void;
}

export function InicioDiscovery({ expanded, onToggle }: InicioDiscoveryProps) {
  const activeId = expanded?.startsWith("discovery-") ? expanded : null;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div>
      {/* Chip row — always visible */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* ¿Puedo comprarlo? → expands to preview, then opens drawer */}
        <button
          type="button"
          onClick={() => onToggle("discovery-compra")}
          className={cn(
            PANEL_INSET_CLASS,
            "flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors active:bg-white/[0.03]",
            activeId === "discovery-compra" && "ring-1 ring-z-brass/30 bg-z-brass/[0.06]"
          )}
          aria-expanded={activeId === "discovery-compra"}
        >
          <IconBox><LightbulbIcon /></IconBox>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-tight">¿Puedo comprarlo?</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Evalúa contra tu plan</p>
          </div>
        </button>

        {/* Plan del mes → expands to show plan teaser */}
        <button
          type="button"
          onClick={() => onToggle("discovery-mapa")}
          className={cn(
            PANEL_INSET_CLASS,
            "flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors active:bg-white/[0.03]",
            activeId === "discovery-mapa" && "ring-1 ring-z-brass/30 bg-z-brass/[0.06]"
          )}
          aria-expanded={activeId === "discovery-mapa"}
        >
          <IconBox><CalendarIcon /></IconBox>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-tight">Plan del mes</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Tu estrategia financiera</p>
          </div>
        </button>
      </div>

      {/* Expanded panel — full width below both chips */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: activeId ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-1.5 transition-opacity duration-150",
              activeId ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {/* ¿Puedo comprarlo? preview */}
            {activeId === "discovery-compra" && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3.5 space-y-3")}>
                <p className="text-[12px] font-medium leading-snug text-foreground/90">
                  Analiza el impacto real de una compra antes de hacerla.
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Ingresa el monto y Zeta cruza tu liquidez, deuda, presupuesto y pagos próximos para
                  decirte si es buen momento — o si es mejor esperar.
                </p>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className={cn(
                    BRASS_BUTTON_CLASS,
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                  )}
                >
                  Evaluar una compra
                  <ArrowRightIcon />
                </button>
              </div>
            )}

            {/* Plan del mes preview */}
            {activeId === "discovery-mapa" && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3.5 space-y-3")}>
                <p className="text-[12px] font-medium leading-snug text-foreground/90">
                  Presupuesto, obligaciones y deuda en un solo lugar.
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Revisa cuánto tienes comprometido, cuánto puedes gastar con libertad y cómo va tu
                  estrategia de pago de deuda — todo antes de que empiece el detalle del día a día.
                </p>
                <Link
                  href="/plan"
                  className={cn(
                    BRASS_BUTTON_CLASS,
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                  )}
                >
                  Abrir mi plan
                  <ArrowRightIcon />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purchase recommender drawer */}
      <PurchaseRecommenderDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
