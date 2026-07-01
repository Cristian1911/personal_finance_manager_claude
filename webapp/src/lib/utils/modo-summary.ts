import type { SharedPaymentGroup } from "@/types/domain";

export type ModoTxRow = {
  id: string;
  amount: number | null;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  category: { id: string; name_es: string | null; name: string; color: string | null } | null;
};

export type CategoryBucket = {
  categoryId: string | null;
  name: string;
  color: string | null;
  total: number;
  count: number;
};

export type ModoSummary = {
  total: number;
  count: number;
  observedFrom: string | null;
  observedTo: string | null;
  byCategory: CategoryBucket[];
};

export function summarizeModo(txs: ModoTxRow[]): ModoSummary {
  const outflows = txs.filter((t) => t.direction === "OUTFLOW");
  const total = outflows.reduce((s, t) => s + (t.amount ?? 0), 0);
  const dates = outflows.map((t) => t.transaction_date).sort();
  const buckets = new Map<string, CategoryBucket>();
  for (const t of outflows) {
    const key = t.category?.id ?? "__uncategorized__";
    const name = t.category?.name_es ?? t.category?.name ?? "Sin categoría";
    const existing = buckets.get(key);
    if (existing) {
      existing.total += t.amount ?? 0;
      existing.count += 1;
    } else {
      buckets.set(key, {
        categoryId: t.category?.id ?? null,
        name,
        color: t.category?.color ?? null,
        total: t.amount ?? 0,
        count: 1,
      });
    }
  }
  const byCategory = [...buckets.values()].sort((a, b) => b.total - a.total);
  return {
    total,
    count: outflows.length,
    observedFrom: dates[0] ?? null,
    observedTo: dates[dates.length - 1] ?? null,
    byCategory,
  };
}

export function filterSharedGroupsByOrigin(
  groups: SharedPaymentGroup[],
  txIds: string[],
): SharedPaymentGroup[] {
  const set = new Set(txIds);
  return groups.filter((g) =>
    g.debts.some((d) => d.origin_transaction_id != null && set.has(d.origin_transaction_id)),
  );
}

export type SettleUpPerson = {
  destinatarioId: string;
  name: string;
  currency: string;
  principal: number;
  outstanding: number;
  /** Deuda activa objetivo del abono (la más antigua por opened_on). */
  oldestActiveDebtId: string | null;
  /** Saldo de ESA deuda — tope del abono; nunca el agregado (evita sobre-abono). */
  oldestActiveDebtOutstanding: number;
};

/**
 * Settle-up agregado por persona+moneda, considerando SOLO las deudas cuyo pago
 * origen cae dentro del modo (txIds). No refleja la deuda global con la persona.
 * Separa por moneda (una fila por persona+moneda) para no sumar COP con USD.
 */
export function settleUpByPerson(
  groups: SharedPaymentGroup[],
  txIds: string[],
): SettleUpPerson[] {
  const set = new Set(txIds);
  const byKey = new Map<string, SettleUpPerson>();
  const chosenOpenedOn = new Map<string, string>();
  for (const g of groups) {
    for (const d of g.debts) {
      if (d.origin_transaction_id == null || !set.has(d.origin_transaction_id)) continue;
      const currency = d.currency_code ?? "COP";
      const key = `${d.destinatario_id}|${currency}`;
      const cur = byKey.get(key) ?? {
        destinatarioId: d.destinatario_id,
        name: d.destinatario_name ?? "—",
        currency,
        principal: 0,
        outstanding: 0,
        oldestActiveDebtId: null,
        oldestActiveDebtOutstanding: 0,
      };
      cur.principal += d.principal_amount;
      if (d.status === "active") {
        cur.outstanding += d.outstanding_amount;
        const prevOpened = chosenOpenedOn.get(key);
        if (prevOpened == null || d.opened_on < prevOpened) {
          chosenOpenedOn.set(key, d.opened_on);
          cur.oldestActiveDebtId = d.id;
          cur.oldestActiveDebtOutstanding = d.outstanding_amount;
        }
      }
      byKey.set(key, cur);
    }
  }
  return [...byKey.values()].sort((a, b) => b.outstanding - a.outstanding);
}
