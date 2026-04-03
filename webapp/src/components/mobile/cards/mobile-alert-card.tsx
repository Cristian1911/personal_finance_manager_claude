"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight, CircleAlert, Inbox, Bell } from "lucide-react";
import type { AttentionSignal } from "@/types/attention";
import { ExpandableCard } from "./expandable-card";

interface MobileAlertCardProps {
  signals: AttentionSignal[];
}

const SIGNAL_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string }> = {
  uncategorized: { icon: Inbox, label: "transacciones sin categoría" },
  destinatario_suggestions: { icon: Inbox, label: "comercios por asignar" },
  overdue_reminders: { icon: Bell, label: "recordatorios vencidos" },
};

function getTopSignal(signals: AttentionSignal[]): AttentionSignal | null {
  const sorted = [...signals].sort((a, b) => {
    if (a.priority === "action" && b.priority !== "action") return -1;
    if (b.priority === "action" && a.priority !== "action") return 1;
    return b.count - a.count;
  });
  return sorted[0] ?? null;
}

export function MobileAlertCard({ signals }: MobileAlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const signal = getTopSignal(signals);

  if (!signal) return null;

  const config = SIGNAL_CONFIG[signal.key];
  const Icon = config?.icon ?? CircleAlert;
  const isAction = signal.priority === "action";

  return (
    <ExpandableCard
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      className={cn(
        "border-z-brass/20 bg-gradient-to-br from-[rgba(212,168,83,0.08)] to-transparent",
        isAction && "border-z-debt/20 from-[rgba(204,68,68,0.08)]"
      )}
      compact={
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              isAction ? "bg-z-debt/15" : "bg-z-brass/15"
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", isAction ? "text-z-debt" : "text-z-brass")} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-xs font-semibold", isAction ? "text-z-debt" : "text-z-brass")}>
              {signal.label}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {signal.count} {signal.count === 1 ? "pendiente" : "pendientes"}
            </p>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              expanded && "rotate-90",
              isAction ? "text-z-debt/50" : "text-z-brass/50"
            )}
          />
        </div>
      }
      detail={
        <div className="px-4 pb-3 pt-0">
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            {signal.priority === "action"
              ? "Esto necesita tu atención para mantener tus finanzas al día."
              : "Una sugerencia para mejorar la organización de tus datos."}
          </p>
          <Link
            href={signal.actionHref}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors",
              isAction
                ? "border-z-debt/25 bg-z-debt/10 text-z-debt hover:bg-z-debt/15"
                : "border-z-brass/25 bg-z-brass/10 text-z-brass hover:bg-z-brass/15"
            )}
          >
            Ir a {signal.page === "transactions" ? "movimientos" : signal.page}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      }
    />
  );
}
