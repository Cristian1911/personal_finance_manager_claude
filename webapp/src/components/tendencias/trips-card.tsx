import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ModoWithTotals } from "@/actions/modos";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { modoOverlapsWindow } from "@/lib/utils/modo-summary";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/domain";

export interface TripsCardProps {
  trips: ModoWithTotals[];
  currency: CurrencyCode;
  windowFrom: string;
  windowTo: string;
}

/**
 * "¿A dónde va?" · Viajes y eventos — the trips that overlap the period, each
 * with its total. A trip paid in the view's currency shows that figure;
 * otherwise its own headline currency (never converted, never summed across).
 */
export function TripsCard({ trips, currency, windowFrom, windowTo }: TripsCardProps) {
  const inWindow = trips.filter((m) => modoOverlapsWindow(m, windowFrom, windowTo));
  if (inWindow.length === 0) return null;

  return (
    <div className={cn(PANEL_SURFACE_CLASS, "mt-3 p-4")}>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold">¿A dónde va? · Viajes y eventos</p>
        <Link href="/modos" className="text-xs text-z-brass hover:underline">
          Ver todos
        </Link>
      </div>
      {inWindow.map((m) => {
        const inView = m.summary.totals.find((t) => t.currency === currency);
        const shown = inView ?? m.summary.totals[0];
        return (
          <Link
            key={m.id}
            href={`/modos/${m.id}`}
            className="flex items-center gap-3 border-t border-white/6 py-2.5 transition-colors first:border-t-0 hover:bg-white/[0.02]"
          >
            <span className="text-xl leading-none" aria-hidden>
              {m.emoji ?? "📍"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{m.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {formatDate(m.date_from, "d MMM")} – {formatDate(m.date_to, "d MMM")} · {m.summary.count}{" "}
                {m.summary.count === 1 ? "gasto" : "gastos"}
                {m.is_shared ? " · compartido" : ""}
                {m.pendingReviewCount > 0 ? ` · ${m.pendingReviewCount} por revisar` : ""}
              </span>
            </span>
            <span className={cn("shrink-0 text-sm tabular-nums", !shown && "text-muted-foreground")}>
              {shown ? formatCurrency(shown.total, shown.currency as CurrencyCode) : "—"}
            </span>
            <ChevronRight className="size-4 shrink-0 text-z-sage-dark" />
          </Link>
        );
      })}
    </div>
  );
}
