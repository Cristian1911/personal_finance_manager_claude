import { AlertTriangle } from "lucide-react";
import type { Anomaly } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";
import { monthShort } from "./format";

export function AnomaliesCard({ anomalies, currency }: { anomalies: Anomaly[]; currency: CurrencyCode }) {
  return (
    <div className={`mt-3 ${PANEL_SURFACE_CLASS} p-4`}>
      <p className="mb-3 text-sm font-semibold">Anomalías detectadas</p>
      {anomalies.length === 0 ? (
        <p className="text-sm text-z-sage-dark">Sin anomalías en el periodo.</p>
      ) : (
        anomalies.slice(0, 5).map((a, i) => (
          <div
            key={`${a.categoryId}-${a.month}`}
            className={`flex items-start gap-3 rounded-xl border border-z-brass/25 bg-z-brass/8 p-3 ${i > 0 ? "mt-2" : ""}`}
          >
            <AlertTriangle className="size-4 shrink-0 text-z-brass" />
            <div>
              <p className="text-xs font-semibold">Gasto inusual en {a.nameEs}</p>
              <p className="text-[11px] text-z-sage-dark">
                {formatCurrency(a.amount, currency)} en {monthShort(a.month)} — {a.multiple.toFixed(1)}× tu promedio.
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
