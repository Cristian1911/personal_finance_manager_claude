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

/** A payment (INFLOW transaction) made to a debt account this month. */
export interface DebtPaymentTx {
  accountId: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

/** Expected cuota for one debt account this month. */
export interface ExpectedCuota {
  accountId: string;
  cuota: number;
}

export interface ExtraPaymentsResult {
  /** Number of payment transactions made after the cuota was already covered. */
  count: number;
  /** Total amount paid above the expected cuotas. */
  totalExtra: number;
}

export function detectExtraPayments(
  payments: DebtPaymentTx[],
  expected: ExpectedCuota[]
): ExtraPaymentsResult {
  const cuotaByAccount = new Map(expected.map((e) => [e.accountId, e.cuota]));

  const byAccount = new Map<string, DebtPaymentTx[]>();
  for (const p of payments) {
    const list = byAccount.get(p.accountId) ?? [];
    list.push(p);
    byAccount.set(p.accountId, list);
  }

  let count = 0;
  let totalExtra = 0;

  for (const [accountId, txs] of byAccount) {
    const cuota = cuotaByAccount.get(accountId) ?? 0;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

    if (cuota <= 0) {
      // No expected cuota for this account: every payment is "extra".
      count += sorted.length;
      totalExtra += sorted.reduce((s, t) => s + t.amount, 0);
      continue;
    }

    let paid = 0;
    for (const tx of sorted) {
      if (paid >= cuota) count += 1;
      paid += tx.amount;
    }
    if (paid > cuota) totalExtra += paid - cuota;
  }

  return { count, totalExtra };
}
