import type { PersonalDebtWithDetails } from "@/types/domain";

/**
 * Persona → viaje/grupo → deudas. Pure grouping for the Deudas personales
 * page: every debt hangs from the person it is with, and inside the person
 * the ones that came out of the same viaje (modo) collapse into one group
 * with its own total, recovered and pending. Plain module (no "use server")
 * so the cached read and the tests share one rule.
 *
 * Membership of a debt in a viaje follows the trip's own rule: the ORIGIN
 * transaction carries one of the modo's tags. When several modos share a tag
 * (duplicated trips) the debt's `notes` — stamped with the modo name by
 * `shareModoTransactions` — breaks the tie, then the trip whose dates contain
 * the payment, then the most recent trip.
 */

export type DebtOriginTx = {
  id: string;
  amount: number | null;
  transaction_date: string;
  merchant_name: string | null;
  clean_description: string | null;
  raw_description: string | null;
  account_id: string | null;
  split_group_id: string | null;
  installment_current: number | null;
  installment_total: number | null;
};

export type HierarchyModo = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  tag_ids: string[];
  date_from: string;
  date_to: string;
};

export type PersonDebtItem = PersonalDebtWithDetails & {
  origin: DebtOriginTx | null;
  /** People in the same split group (this one included); 1 when not shared. */
  split_size: number;
  /** Full amount of the shared payment (precio + interés for cuotas); null when not shared. */
  split_total: number | null;
};

export type PersonDebtGroup = {
  /** `${modo.id}|${currency}` — stable across renders for collapse state. */
  key: string;
  modo: HierarchyModo;
  currency_code: string;
  direction: "lent" | "borrowed";
  principal: number;
  /** Settled shares count in full; active ones what was repaid, capped. */
  repaid: number;
  outstanding: number;
  count: number;
  activeCount: number;
  first_on: string;
  last_on: string;
  /** Account the trip's expenses were mostly paid from — default for repayments. */
  origin_account_id: string | null;
  /** Newest first. */
  items: PersonDebtItem[];
};

export type PersonCurrencyTotals = {
  currency_code: string;
  /** Active `lent` outstanding. */
  owedToMe: number;
  /** Active `borrowed` outstanding. */
  iOwe: number;
  principal: number;
  repaid: number;
};

export type PersonDebtSummary = {
  destinatario_id: string;
  name: string;
  is_ad_hoc: boolean;
  /** Active debts only, one row per currency (never summed across currencies). */
  totals: PersonCurrencyTotals[];
  groups: PersonDebtGroup[];
  /** Active debts outside any viaje, newest first. */
  loose: PersonDebtItem[];
  /** Settled / cancelled debts outside any viaje, newest first. */
  settled: PersonDebtItem[];
  activeCount: number;
  overdueCount: number;
};

export type HierarchyInput = {
  debts: PersonalDebtWithDetails[];
  originTxs: DebtOriginTx[];
  /** transaction_id → tag ids on it (origin transactions only). */
  tagRows: Array<{ transaction_id: string; tag_id: string }>;
  modos: HierarchyModo[];
};

function repaidFor(d: PersonalDebtWithDetails): number {
  const principal = Number(d.principal_amount ?? 0);
  if (d.status === "settled") return principal;
  return Math.min(Number(d.total_repaid ?? 0), principal);
}

function byNewest(a: PersonDebtItem, b: PersonDebtItem): number {
  const ad = a.origin?.transaction_date ?? a.opened_on;
  const bd = b.origin?.transaction_date ?? b.opened_on;
  if (ad !== bd) return ad < bd ? 1 : -1;
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}

/**
 * The viaje a debt belongs to, or null. Exported for the tests: this is the
 * tie-break that keeps duplicated trips (same tags) from scattering one
 * person's debts across several groups.
 */
export function resolveDebtModo(
  debt: Pick<PersonalDebtWithDetails, "notes" | "opened_on">,
  originTagIds: ReadonlySet<string> | null,
  originDate: string | null,
  modos: HierarchyModo[],
): HierarchyModo | null {
  const candidates = originTagIds
    ? modos.filter((m) => m.tag_ids.some((id) => originTagIds.has(id)))
    : [];
  if (candidates.length === 0) {
    // No tagged origin (a debt created by hand and noted with the trip name).
    const note = debt.notes?.trim().toLowerCase();
    if (!note) return null;
    return modos.find((m) => m.name.trim().toLowerCase() === note) ?? null;
  }
  if (candidates.length === 1) return candidates[0];
  const note = debt.notes?.trim().toLowerCase();
  const named = note ? candidates.find((m) => m.name.trim().toLowerCase() === note) : undefined;
  if (named) return named;
  const date = originDate ?? debt.opened_on;
  const inRange = candidates.filter((m) => date >= m.date_from && date <= m.date_to);
  const pool = inRange.length > 0 ? inRange : candidates;
  return [...pool].sort((a, b) => (a.date_from < b.date_from ? 1 : a.date_from > b.date_from ? -1 : 0))[0];
}

export function buildPersonHierarchy(
  input: HierarchyInput,
  primaryCurrency: string,
): PersonDebtSummary[] {
  const txById = new Map(input.originTxs.map((t) => [t.id, t]));
  const tagsByTx = new Map<string, Set<string>>();
  for (const row of input.tagRows) {
    const set = tagsByTx.get(row.transaction_id) ?? new Set<string>();
    set.add(row.tag_id);
    tagsByTx.set(row.transaction_id, set);
  }
  const splitSize = new Map<string, number>();
  for (const d of input.debts) {
    if (d.split_group_id) splitSize.set(d.split_group_id, (splitSize.get(d.split_group_id) ?? 0) + 1);
  }

  const people = new Map<string, PersonDebtSummary & { _groups: Map<string, PersonDebtGroup> }>();

  for (const d of input.debts) {
    const origin = d.origin_transaction_id ? txById.get(d.origin_transaction_id) ?? null : null;
    const item: PersonDebtItem = {
      ...d,
      origin,
      split_size: d.split_group_id ? splitSize.get(d.split_group_id) ?? 1 : 1,
      split_total: d.split_group_id
        ? d.group_total_amount != null
          ? Number(d.group_total_amount)
          : origin?.amount != null
            ? Number(origin.amount)
            : null
        : null,
    };

    const person =
      people.get(d.destinatario_id) ??
      {
        destinatario_id: d.destinatario_id,
        name: d.destinatario_name,
        is_ad_hoc: d.destinatario_is_ad_hoc,
        totals: [],
        groups: [],
        loose: [],
        settled: [],
        activeCount: 0,
        overdueCount: 0,
        _groups: new Map<string, PersonDebtGroup>(),
      };
    people.set(d.destinatario_id, person);

    const isActive = d.status === "active";
    if (isActive) {
      person.activeCount += 1;
      if (d.is_overdue) person.overdueCount += 1;
      let tot = person.totals.find((t) => t.currency_code === d.currency_code);
      if (!tot) {
        tot = { currency_code: d.currency_code, owedToMe: 0, iOwe: 0, principal: 0, repaid: 0 };
        person.totals.push(tot);
      }
      if (d.direction === "lent") tot.owedToMe += Number(d.outstanding_amount);
      else tot.iOwe += Number(d.outstanding_amount);
      tot.principal += Number(d.principal_amount);
      tot.repaid += repaidFor(d);
    }

    const modo = resolveDebtModo(
      d,
      origin ? tagsByTx.get(origin.id) ?? null : null,
      origin?.transaction_date ?? null,
      input.modos,
    );
    if (!modo) {
      if (isActive) person.loose.push(item);
      else person.settled.push(item);
      continue;
    }

    const key = `${modo.id}|${d.currency_code}`;
    const when = origin?.transaction_date ?? d.opened_on;
    let group = person._groups.get(key);
    if (!group) {
      group = {
        key,
        modo,
        currency_code: d.currency_code,
        direction: d.direction,
        principal: 0,
        repaid: 0,
        outstanding: 0,
        count: 0,
        activeCount: 0,
        first_on: when,
        last_on: when,
        origin_account_id: null,
        items: [],
      };
      person._groups.set(key, group);
    }
    group.items.push(item);
    group.count += 1;
    group.principal += Number(d.principal_amount);
    group.repaid += repaidFor(d);
    if (isActive) {
      group.activeCount += 1;
      group.outstanding += Number(d.outstanding_amount);
    }
    if (when < group.first_on) group.first_on = when;
    if (when > group.last_on) group.last_on = when;
  }

  const out: PersonDebtSummary[] = [];
  for (const p of people.values()) {
    const { _groups, ...rest } = p;
    const groups = [..._groups.values()];
    for (const g of groups) {
      g.items.sort(byNewest);
      // Most-used origin account wins as the repayment default.
      const counts = new Map<string, number>();
      for (const it of g.items) {
        if (it.origin?.account_id) counts.set(it.origin.account_id, (counts.get(it.origin.account_id) ?? 0) + 1);
      }
      g.origin_account_id = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }
    groups.sort((a, b) => {
      // Trips with something pending first, then newest.
      const ap = a.outstanding > 0 ? 0 : 1;
      const bp = b.outstanding > 0 ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.last_on < b.last_on ? 1 : a.last_on > b.last_on ? -1 : 0;
    });
    rest.loose.sort(byNewest);
    rest.settled.sort(byNewest);
    rest.totals.sort((a, b) =>
      a.currency_code === primaryCurrency ? -1 : b.currency_code === primaryCurrency ? 1 : a.currency_code.localeCompare(b.currency_code),
    );
    out.push({ ...rest, groups });
  }

  // People with something pending first, biggest primary-currency balance
  // first, then by name — the settled ones sink to the bottom.
  const pending = (p: PersonDebtSummary) => {
    const t = p.totals.find((x) => x.currency_code === primaryCurrency);
    return t ? t.owedToMe + t.iOwe : 0;
  };
  out.sort((a, b) => {
    const aa = a.activeCount > 0 ? 0 : 1;
    const bb = b.activeCount > 0 ? 0 : 1;
    if (aa !== bb) return aa - bb;
    const diff = pending(b) - pending(a);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "es");
  });
  return out;
}

// ── Abono por grupo ────────────────────────────────────────────────────────

export type AllocatableDebt = {
  id: string;
  outstanding_amount: number;
  opened_on: string;
  created_at: string;
};

export type DebtAllocation = { id: string; amount: number };

/**
 * One payment against several debts of the same person: fill the oldest
 * first, each up to its own pending balance. Returns the per-debt amounts and
 * whatever could not be placed (the caller rejects an over-payment instead of
 * inventing a credit balance).
 */
export function allocatePaymentAcrossDebts(
  debts: AllocatableDebt[],
  amount: number,
  decimals = 2,
): { allocations: DebtAllocation[]; unallocated: number } {
  const factor = 10 ** decimals;
  const round = (n: number) => Math.round(n * factor) / factor;
  const sorted = [...debts].sort((a, b) => {
    if (a.opened_on !== b.opened_on) return a.opened_on < b.opened_on ? -1 : 1;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  // Truncate, never round up: a sub-unit amount typed in a 0-decimal currency
  // must not turn into more money than the user entered.
  let remaining = Math.floor(Math.max(0, Number(amount) || 0) * factor) / factor;
  const allocations: DebtAllocation[] = [];
  for (const d of sorted) {
    if (remaining <= 0) break;
    const cap = round(Math.max(0, Number(d.outstanding_amount) || 0));
    const take = round(Math.min(remaining, cap));
    if (take <= 0) continue;
    allocations.push({ id: d.id, amount: take });
    remaining = round(remaining - take);
  }
  return { allocations, unallocated: remaining };
}

// ── Resumen derivado ───────────────────────────────────────────────────────

export type HierarchyOverview = {
  iOwe: { totals: { currency_code: string; total: number }[] };
  owedToMe: { totals: { currency_code: string; total: number }[] };
  overdue: { destinatario_name: string; amount: number; currency_code: string; due_date: string }[];
};

/**
 * The page-level Debo / Me deben / vencidas summary, read off the hierarchy
 * so the page runs one debts query, not two that can disagree.
 */
export function overviewFromHierarchy(people: PersonDebtSummary[]): HierarchyOverview {
  const iOwe = new Map<string, number>();
  const owedToMe = new Map<string, number>();
  const overdue: HierarchyOverview["overdue"] = [];
  for (const p of people) {
    for (const t of p.totals) {
      if (t.iOwe > 0) iOwe.set(t.currency_code, (iOwe.get(t.currency_code) ?? 0) + t.iOwe);
      if (t.owedToMe > 0) owedToMe.set(t.currency_code, (owedToMe.get(t.currency_code) ?? 0) + t.owedToMe);
    }
    const items = [...p.groups.flatMap((g) => g.items), ...p.loose];
    for (const d of items) {
      if (d.status === "active" && d.is_overdue && d.due_date) {
        overdue.push({
          destinatario_name: p.name,
          amount: Number(d.outstanding_amount),
          currency_code: d.currency_code,
          due_date: d.due_date,
        });
      }
    }
  }
  const rows = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([currency_code, total]) => ({ currency_code, total }))
      .sort((a, b) => a.currency_code.localeCompare(b.currency_code));
  overdue.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
  return { iOwe: { totals: rows(iOwe) }, owedToMe: { totals: rows(owedToMe) }, overdue };
}
