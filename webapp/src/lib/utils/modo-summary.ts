import type { Modo, SharedPaymentGroup } from "@/types/domain";

export type ModoTxTag = { id: string; name: string; color: string | null };

/**
 * A transaction row as the Modo (viaje/evento) views consume it. Everything
 * beyond the first four fields is optional so the aggregation helpers keep
 * working on the lean rows `listModosWithTotals` fetches, while the detail
 * page gets the full shape (merchant, account, split state, tags).
 */
export type ModoTxRow = {
  id: string;
  amount: number | null;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  currency_code?: string | null;
  merchant_name?: string | null;
  clean_description?: string | null;
  raw_description?: string | null;
  is_excluded?: boolean | null;
  transfer_group_id?: string | null;
  split_group_id?: string | null;
  split_repaid_amount?: number | null;
  personal_debt_id?: string | null;
  category: { id: string; name_es: string | null; name: string; color: string | null } | null;
  account?: { id: string; name: string; color: string | null } | null;
  destinatario?: { id: string; name: string } | null;
  transaction_tags?: Array<{ tag: ModoTxTag | null }> | null;
};

export type CurrencyTotal = { currency: string; total: number; count: number };

export type CategoryBucket = {
  categoryId: string | null;
  name: string;
  color: string | null;
  currency: string;
  total: number;
  count: number;
};

export type ModoSummary = {
  /** Currency with the most spend rows — the headline number's currency. */
  currency: string;
  /** Spend total in the headline currency. */
  total: number;
  /** Spend rows across every currency. */
  count: number;
  /** One entry per currency, headline currency first. */
  totals: CurrencyTotal[];
  observedFrom: string | null;
  observedTo: string | null;
  /** Per (currency, category); headline currency first, then desc by total. */
  byCategory: CategoryBucket[];
};

const DEFAULT_CURRENCY = "COP";

export function txCurrency(t: Pick<ModoTxRow, "currency_code">): string {
  return t.currency_code ?? DEFAULT_CURRENCY;
}

/**
 * What counts as "gasto del viaje": money that left, that the user did not
 * exclude, and that is not a balance move (transfers between own accounts,
 * loans to / repayments from people). A shared payment keeps its FULL amount
 * here — the trip cost what it cost; what others owe back shows up separately
 * in the shared summary.
 */
export function isModoSpend(t: ModoTxRow): boolean {
  return (
    t.direction === "OUTFLOW" &&
    !t.is_excluded &&
    !t.transfer_group_id &&
    !t.personal_debt_id
  );
}

export type ModoTxKind = "spend" | "inflow" | "transfer" | "excluded" | "person";

/** Why a row is (or is not) part of the spend total — drives the row's status chip. */
export function classifyModoTx(t: ModoTxRow): ModoTxKind {
  if (t.transfer_group_id) return "transfer";
  if (t.personal_debt_id) return "person";
  if (t.is_excluded) return "excluded";
  if (t.direction === "INFLOW") return "inflow";
  return "spend";
}

/** Title for a row: merchant first, then the cleaned/raw description, then the category. */
export function describeModoTx(t: ModoTxRow): string {
  return (
    t.merchant_name?.trim() ||
    t.clean_description?.trim() ||
    t.raw_description?.trim() ||
    t.category?.name_es ||
    t.category?.name ||
    "Movimiento"
  );
}

export function summarizeModo(txs: ModoTxRow[]): ModoSummary {
  const spend = txs.filter(isModoSpend);
  const dates = spend.map((t) => t.transaction_date).sort();

  const totalsByCurrency = new Map<string, CurrencyTotal>();
  for (const t of spend) {
    const currency = txCurrency(t);
    const cur = totalsByCurrency.get(currency) ?? { currency, total: 0, count: 0 };
    cur.total += t.amount ?? 0;
    cur.count += 1;
    totalsByCurrency.set(currency, cur);
  }
  // Headline currency = most rows (ties → larger total). A trip abroad paid
  // mostly in pesos with a few USD card charges reads in COP, not in USD.
  const totals = [...totalsByCurrency.values()].sort(
    (a, b) => b.count - a.count || b.total - a.total || a.currency.localeCompare(b.currency),
  );
  const primary = totals[0]?.currency ?? DEFAULT_CURRENCY;

  const buckets = new Map<string, CategoryBucket>();
  for (const t of spend) {
    const currency = txCurrency(t);
    const key = `${currency}|${t.category?.id ?? "__uncategorized__"}`;
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
        currency,
        total: t.amount ?? 0,
        count: 1,
      });
    }
  }
  const currencyRank = new Map(totals.map((c, i) => [c.currency, i]));
  const byCategory = [...buckets.values()].sort(
    (a, b) =>
      (currencyRank.get(a.currency) ?? 99) - (currencyRank.get(b.currency) ?? 99) ||
      b.total - a.total,
  );

  return {
    currency: primary,
    total: totals[0]?.total ?? 0,
    count: spend.length,
    totals,
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

export type SharedTotals = {
  currency: string;
  /** Σ total of the shared payments (full amounts). */
  sharedTotal: number;
  /** Σ what the user keeps for themself. */
  userShare: number;
  /** Σ what the others owe in principal (sharedTotal − userShare). */
  owedToUser: number;
  /** Σ already repaid. */
  recovered: number;
  /** Σ still pending across active debts. */
  outstanding: number;
  /** Number of shared payments in this currency. */
  count: number;
};

/**
 * Per-currency roll-up of the shared payments whose origin lies in the modo.
 * Never adds COP to USD: one row per currency, biggest first.
 */
export function summarizeShared(groups: SharedPaymentGroup[], txIds: string[]): SharedTotals[] {
  const byCurrency = new Map<string, SharedTotals>();
  for (const g of filterSharedGroupsByOrigin(groups, txIds)) {
    const currency = g.currency_code ?? DEFAULT_CURRENCY;
    const cur = byCurrency.get(currency) ?? {
      currency,
      sharedTotal: 0,
      userShare: 0,
      owedToUser: 0,
      recovered: 0,
      outstanding: 0,
      count: 0,
    };
    cur.sharedTotal += g.total;
    cur.userShare += g.userShare;
    cur.owedToUser += Math.max(0, g.total - g.userShare);
    cur.recovered += g.recovered;
    cur.outstanding += g.outstanding_total;
    cur.count += 1;
    byCurrency.set(currency, cur);
  }
  return [...byCurrency.values()].sort((a, b) => b.count - a.count || b.sharedTotal - a.sharedTotal);
}

export type SpendSplit = {
  currency: string;
  /** All trip spend in this currency. */
  spendTotal: number;
  spendCount: number;
  /** The part that was split with someone (full amounts). */
  sharedTotal: number;
  sharedCount: number;
  /** Spend the user kept for themself (not split). */
  ownOnlyTotal: number;
  ownOnlyCount: number;
  /** What the trip really cost the user: own-only + their share of the shared. */
  yourPart: number;
  outstanding: number;
  recovered: number;
  owedToUser: number;
};

/**
 * A trip is rarely all-shared: some buys are just yours. Per currency, split
 * the spend into "shared with someone" and "only mine", and derive what the
 * trip costs you once the others pay their part.
 */
export function summarizeSpendSplit(spendRows: ModoTxRow[], shared: SharedTotals[]): SpendSplit[] {
  const byCurrency = new Map<string, SpendSplit>();
  for (const t of spendRows) {
    const currency = txCurrency(t);
    const cur = byCurrency.get(currency) ?? {
      currency,
      spendTotal: 0,
      spendCount: 0,
      sharedTotal: 0,
      sharedCount: 0,
      ownOnlyTotal: 0,
      ownOnlyCount: 0,
      yourPart: 0,
      outstanding: 0,
      recovered: 0,
      owedToUser: 0,
    };
    cur.spendTotal += t.amount ?? 0;
    cur.spendCount += 1;
    if (t.split_group_id) cur.sharedCount += 1;
    byCurrency.set(currency, cur);
  }
  for (const st of shared) {
    const cur = byCurrency.get(st.currency);
    if (!cur) continue;
    cur.sharedTotal = st.sharedTotal;
    cur.outstanding = st.outstanding;
    cur.recovered = st.recovered;
    cur.owedToUser = st.owedToUser;
    cur.yourPart = st.userShare;
  }
  for (const cur of byCurrency.values()) {
    cur.ownOnlyTotal = Math.max(0, cur.spendTotal - cur.sharedTotal);
    cur.ownOnlyCount = Math.max(0, cur.spendCount - cur.sharedCount);
    cur.yourPart += cur.ownOnlyTotal;
  }
  return [...byCurrency.values()].sort((a, b) => b.spendCount - a.spendCount || b.spendTotal - a.spendTotal);
}

/** Lookup of a modo's shared groups by the `split_group_id` its origin tx carries. */
export function indexSharedGroups(groups: SharedPaymentGroup[]): Map<string, SharedPaymentGroup> {
  return new Map(groups.map((g) => [g.split_group_id, g]));
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
      const currency = d.currency_code ?? DEFAULT_CURRENCY;
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
  // Agrupar por moneda (alfabético) y luego desc por pendiente dentro de cada
  // moneda — nunca restar montos de monedas distintas.
  return [...byKey.values()].sort(
    (a, b) => a.currency.localeCompare(b.currency) || b.outstanding - a.outstanding,
  );
}

// ── Membership without a round-trip per modo ─────────────────────────────

export type ModoMembership = Pick<Modo, "id" | "tag_ids">;

/**
 * Same rule as `getModoTransactionIds` (any of the modo's tags, whatever the
 * date — the range only gates auto-tagging and candidates), applied in memory
 * to one batch of tag rows + transactions so a list of modos costs two
 * queries, not two per modo.
 */
export function assignTransactionsToModos<T extends Pick<ModoTxRow, "id">>(
  modos: ModoMembership[],
  tagRows: Array<{ transaction_id: string; tag_id: string }>,
  txs: T[],
): Map<string, T[]> {
  const tagsByTx = new Map<string, Set<string>>();
  for (const row of tagRows) {
    const set = tagsByTx.get(row.transaction_id) ?? new Set<string>();
    set.add(row.tag_id);
    tagsByTx.set(row.transaction_id, set);
  }
  const out = new Map<string, T[]>();
  for (const modo of modos) {
    const members: T[] = [];
    if (modo.tag_ids && modo.tag_ids.length > 0) {
      for (const tx of txs) {
        const txTags = tagsByTx.get(tx.id);
        if (!txTags) continue;
        if (modo.tag_ids.some((id) => txTags.has(id))) members.push(tx);
      }
    }
    out.set(modo.id, members);
  }
  return out;
}

/**
 * The modo a tag filter "belongs" to: the one sharing the most selected tags,
 * most recent first on ties. `null` when no saved modo covers any of them —
 * the caller then offers to create one.
 */
export function findModoForTags<M extends Pick<Modo, "id" | "tag_ids" | "date_from">>(
  modos: M[],
  selectedTagIds: string[],
): M | null {
  if (selectedTagIds.length === 0) return null;
  const selected = new Set(selectedTagIds);
  let best: { modo: M; overlap: number } | null = null;
  for (const modo of modos) {
    const overlap = (modo.tag_ids ?? []).filter((id) => selected.has(id)).length;
    if (overlap === 0) continue;
    if (
      !best ||
      overlap > best.overlap ||
      (overlap === best.overlap && modo.date_from > best.modo.date_from)
    ) {
      best = { modo, overlap };
    }
  }
  return best?.modo ?? null;
}

/** Where a member row sits relative to the trip's dates (tagged rows outside the range still count). */
export function modoDatePosition(
  date: string,
  modo: Pick<Modo, "date_from" | "date_to">,
): "before" | "during" | "after" {
  if (date < modo.date_from) return "before";
  if (date > modo.date_to) return "after";
  return "during";
}

/** True when the modo's range covers today (or is still ahead). Not the `is_active` flag. */
export function isModoOngoing(modo: Pick<Modo, "date_to">, today: string): boolean {
  return modo.date_to >= today;
}

/** Ranges overlap (inclusive, YYYY-MM-DD strings). */
export function modoOverlapsWindow(
  modo: Pick<Modo, "date_from" | "date_to">,
  from: string,
  to: string,
): boolean {
  return modo.date_from <= to && modo.date_to >= from;
}
