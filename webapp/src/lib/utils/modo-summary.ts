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
