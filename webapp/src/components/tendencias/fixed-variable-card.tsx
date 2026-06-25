import type { FixedVariable } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export function FixedVariableCard({ data, currency }: { data: FixedVariable; currency: CurrencyCode }) {
  const total = data.fixed + data.variable || 1;
  const fixedPct = Math.round((data.fixed / total) * 100);
  return (
    <div className={`mt-3 ${PANEL_SURFACE_CLASS} p-4`}>
      <p className="mb-3 text-sm font-semibold">Fijos vs. variables</p>
      <div className="flex h-7 overflow-hidden rounded-lg border border-white/6">
        <div
          className="flex items-center justify-center bg-z-brass text-[11px] font-semibold text-z-ink"
          style={{ width: `${fixedPct}%` }}
        >
          Fijos {fixedPct}%
        </div>
        <div
          className="flex items-center justify-center bg-z-expense text-[11px] font-semibold text-z-ink"
          style={{ width: `${100 - fixedPct}%` }}
        >
          Variables {100 - fixedPct}%
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-z-sage-dark">
        <span>
          Fijos <b className="tabular-nums text-z-white">{formatCurrency(data.fixed, currency)}</b>
        </span>
        <span>
          Variables <b className="tabular-nums text-z-white">{formatCurrency(data.variable, currency)}</b>
          {data.variableMoM !== null && (
            <span
              className={
                data.variableMoM > 0 ? " text-z-expense" : data.variableMoM < 0 ? " text-z-income" : " text-z-sage-dark"
              }
            >
              {" "}
              {data.variableMoM > 0 ? "▲" : data.variableMoM < 0 ? "▼" : "~"} {Math.abs(Math.round(data.variableMoM))}%
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
