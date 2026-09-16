import Link from "next/link";
import type { ModoWithTotals } from "@/actions/modos";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export function ModoCard({ modo }: { modo: ModoWithTotals }) {
  const range = `${formatDate(modo.date_from, "d MMM")} – ${formatDate(modo.date_to, "d MMM yyyy")}`;
  const { summary } = modo;
  const extra = summary.totals.length - 1;
  return (
    <Link
      href={`/modos/${modo.id}`}
      className={cn(PANEL_SURFACE_CLASS, "flex items-start gap-3 p-4 transition-colors hover:bg-z-surface-3")}
      style={modo.color ? { borderLeftColor: modo.color, borderLeftWidth: 4 } : undefined}
    >
      <span className="text-2xl leading-none" aria-hidden>
        {modo.emoji ?? "📍"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-medium">{modo.name}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {formatCurrency(summary.total, summary.currency as CurrencyCode)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {range} · {summary.count} {summary.count === 1 ? "gasto" : "gastos"}
          {extra > 0 ? ` · +${extra} ${extra === 1 ? "moneda" : "monedas"}` : ""}
        </p>
        {(modo.is_active || modo.is_shared || modo.pendingReviewCount > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {modo.is_active && (
              <span className="rounded-full border border-z-brass/30 bg-z-brass/10 px-2 py-0.5 text-[10px] font-medium text-z-brass">
                Activo
              </span>
            )}
            {modo.is_shared && (
              <span className="rounded-full border border-white/6 px-2 py-0.5 text-[10px] text-muted-foreground">
                Compartido · {modo.sharedCount} de {summary.count} repartidos
              </span>
            )}
            {modo.pendingReviewCount > 0 && (
              <span className="rounded-full border border-z-alert/30 bg-z-alert/10 px-2 py-0.5 text-[10px] text-z-alert">
                {modo.pendingReviewCount} por revisar
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
