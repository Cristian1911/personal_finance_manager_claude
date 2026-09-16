/**
 * Reparte lo que los participantes ya devolvieron entre las transacciones que
 * llevan el mismo split_group_id — normalmente una sola (el pago compartido),
 * pero una compra a cuotas compartida como "compra completa" estampa TODAS sus
 * cuotas con el grupo. Cada fila absorbe como máximo su propio monto, en orden
 * de cuota (y de fecha), para que el gasto efectivo (`amount −
 * split_repaid_amount`) nunca sea negativo; el exceso queda sin asignar hasta
 * que llegue la siguiente cuota.
 */
export type RepaidTargetRow = {
  id: string;
  amount: number | null;
  installment_current: number | null;
  transaction_date: string;
};

export function allocateRepaidAcrossRows(
  rows: RepaidTargetRow[],
  repaid: number,
): Map<string, number> {
  const sorted = [...rows].sort((a, b) => {
    const ai = a.installment_current ?? Number.POSITIVE_INFINITY;
    const bi = b.installment_current ?? Number.POSITIVE_INFINITY;
    if (ai !== bi) return ai - bi;
    if (a.transaction_date !== b.transaction_date) return a.transaction_date < b.transaction_date ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  let remaining = Math.max(0, Number(repaid) || 0);
  const out = new Map<string, number>();
  for (const row of sorted) {
    const cap = Math.max(0, Number(row.amount ?? 0));
    const take = Math.min(remaining, cap);
    out.set(row.id, take);
    remaining -= take;
  }
  return out;
}
