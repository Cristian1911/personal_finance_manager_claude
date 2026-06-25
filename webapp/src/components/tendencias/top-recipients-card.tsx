import type { RecipientRank } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export function TopRecipientsCard({ recipients, currency }: { recipients: RecipientRank[]; currency: CurrencyCode }) {
  if (recipients.length === 0) return null;
  const max = Math.max(...recipients.map((r) => r.total), 1);
  return (
    <div className={`mt-3 ${PANEL_SURFACE_CLASS} p-4`}>
      <p className="mb-3 text-sm font-semibold">¿A dónde va? · Top destinatarios</p>
      {recipients.map((r) => (
        <div
          key={r.destinatarioId ?? "none"}
          className="flex items-center gap-3 border-t border-white/6 py-2.5 first:border-t-0"
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-z-ink"
            style={{ background: r.color }}
          >
            {r.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold">{r.name}</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.total, currency)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full" style={{ width: `${(r.total / max) * 100}%`, background: r.color }} />
            </div>
            <p className="mt-1 text-[11px] text-z-sage-dark">
              {r.count} mov.
              {r.momPct !== null && (
                <span className={r.momPct > 0 ? " text-z-expense" : r.momPct < 0 ? " text-z-income" : " text-z-sage-dark"}>
                  {" · "}
                  {r.momPct > 0 ? "▲" : r.momPct < 0 ? "▼" : "~"} {Math.abs(Math.round(r.momPct))}%
                </span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
