/**
 * Honest month-over-month debt-load trend.
 *
 * The status chip states the TREND of the monthly cuota, never affordability.
 * Thresholds (approved in spec 2026-06-09-deudas-lenses-design.md):
 *   delta <= -5%  -> "mejorando"
 *   delta <= +10% -> "estable"
 *   delta >  +10% -> "mes_pesado"
 * No previous period -> nulls (UI shows "Sin historial suficiente", no chip).
 */
export type DebtTrendStatus = "mejorando" | "estable" | "mes_pesado";

export interface DebtTrendResult {
  deltaPct: number | null;
  status: DebtTrendStatus | null;
}

export function computeDebtTrend(
  currentCuota: number | null,
  previousCuota: number | null
): DebtTrendResult {
  if (
    currentCuota == null ||
    previousCuota == null ||
    !Number.isFinite(currentCuota) ||
    !Number.isFinite(previousCuota) ||
    previousCuota <= 0
  ) {
    return { deltaPct: null, status: null };
  }
  const deltaPct = ((currentCuota - previousCuota) / previousCuota) * 100;
  const status: DebtTrendStatus =
    deltaPct <= -5 ? "mejorando" : deltaPct <= 10 ? "estable" : "mes_pesado";
  return { deltaPct, status };
}
