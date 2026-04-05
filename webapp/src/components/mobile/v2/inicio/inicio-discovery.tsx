"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";

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

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-z-brass/20 bg-z-brass/10">
      {children}
    </div>
  );
}

// ─── Detail content per card ─────────────────────────────────────────────────

const details: Record<string, { text: string; href: string; label: string }> = {
  "discovery-deseos": {
    text: "Describe lo que quieres comprar y Zeta evalúa si cabe en tu plan.",
    href: "/deseos",
    label: "Ir a deseos →",
  },
  "discovery-mapa": {
    text: "Tu presupuesto distribuido en el calendario.",
    href: "/plan",
    label: "Ver plan →",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface InicioDiscoveryProps {
  expanded: string | null;
  onToggle: (id: string) => void;
}

export function InicioDiscovery({ expanded, onToggle }: InicioDiscoveryProps) {
  const activeId = expanded?.startsWith("discovery-") ? expanded : null;
  const detail = activeId ? details[activeId] : null;

  return (
    <div>
      {/* Chip row — always visible */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onToggle("discovery-deseos")}
          className={cn(
            PANEL_INSET_CLASS,
            "flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors active:bg-white/[0.03]",
            activeId === "discovery-deseos" && "ring-1 ring-z-brass/30 bg-z-brass/[0.06]"
          )}
          aria-expanded={activeId === "discovery-deseos"}
        >
          <IconBox><LightbulbIcon /></IconBox>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-tight">¿Puedo comprarlo?</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Evalúa contra tu plan</p>
          </div>
        </button>

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
            <p className="text-[12px] font-semibold leading-tight">Mapa del mes</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Tu gasto en el tiempo</p>
          </div>
        </button>
      </div>

      {/* Expanded panel — FULL WIDTH below both cards */}
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
            {detail && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3 space-y-2")}>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {detail.text}
                </p>
                <Link href={detail.href} className="inline-block text-[11px] font-semibold text-z-brass">
                  {detail.label}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
