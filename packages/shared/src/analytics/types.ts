export type ExpenseType = "fixed" | "variable";

/** A transaction row already filtered + normalized by Layer 2 (the cached dataset action). */
export interface AnalyticsTx {
  amount: number; // always positive; sign comes from direction
  direction: "INFLOW" | "OUTFLOW";
  date: string; // transaction_date, YYYY-MM-DD
  categoryId: string | null;
  destinatarioId: string | null;
  accountId: string;
  expenseType: ExpenseType | null; // joined from categories.expense_type
}

export interface CategoryMeta {
  nameEs: string;
  color: string;
  expenseType: ExpenseType | null;
  budgetTarget: number | null;
}

export interface DestinatarioMeta {
  name: string;
  color: string;
}

export interface AnalyticsConfig {
  months: string[]; // ordered "YYYY-MM", oldest → newest
  debtAccountIds: ReadonlySet<string>;
  categoryMeta: ReadonlyMap<string, CategoryMeta>;
  destinatarioMeta: ReadonlyMap<string, DestinatarioMeta>;
}

export interface CategoryTrend {
  categoryId: string;
  nameEs: string;
  color: string;
  monthly: number[]; // aligned to config.months
  total: number;
  momPct: number | null; // last vs prev month; null when prev is 0
}

export interface RecipientRank {
  destinatarioId: string | null;
  name: string;
  color: string;
  total: number;
  count: number;
  momPct: number | null;
  share: number; // 0..1 of total spend in window
}

/**
 * Flat per-category breakdown node for the interactive Tendencias accordion.
 * Top-level rows are nodes with `parentId === null`; their `childIds` are the
 * subcategory leaves. A leaf (childless parent OR subcategory) drills straight
 * to its transactions. A parent with direct spend (`ownTotal > 0`) gets a
 * synthetic "<Parent> (directo)" leaf in the UI that reuses the parent's own id.
 *
 * `ownTotal`    = windowed OUTFLOW spend on tx whose category_id === id.
 * `rolledTotal` = ownTotal + Σ descendants' ownTotal (== ownTotal for leaves).
 * Totals reconcile with `categorySeries` (OUTFLOW-only, same window).
 *
 * `monthly`/`momPct` describe the series for THIS row's displayed total:
 * rolled for a top-level parent (its row shows `rolledTotal`), own for a leaf
 * (its row shows `ownTotal`). Aligned to config.months; momPct null when the
 * prior month is 0. (The synthetic "(directo)" sub-row shows no trend.)
 */
export interface CategoryHierarchyNode {
  id: string;
  parentId: string | null;
  nameEs: string;
  color: string;
  isLeaf: boolean;
  childIds: string[]; // sorted by child ownTotal desc; empty for leaves
  ownTotal: number;
  rolledTotal: number;
  monthly: number[];
  momPct: number | null;
}

export interface FixedVariable {
  fixed: number;
  variable: number;
  variableMoM: number | null;
  variableSeries: number[]; // aligned to config.months
}

export interface CashflowPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface SavingsPoint {
  month: string;
  income: number;
  expense: number;
  rate: number | null;
}

export interface AdherencePoint {
  categoryId: string;
  nameEs: string;
  target: number;
  monthsWithin: number;
  monthsExceeded: number;
  momPct: number | null;
}

export interface Mover {
  categoryId: string;
  nameEs: string;
  color: string;
  from: number;
  to: number;
  deltaPct: number;
}

export interface Anomaly {
  categoryId: string;
  nameEs: string;
  month: string;
  amount: number;
  baseline: number;
  multiple: number; // amount / baseline
}

export interface RecurringObligation {
  month: string;
  amount: number;
}

export interface ForecastPoint {
  month: string;
  balance: number;
  projected: boolean;
}

export interface VerdictTile {
  label: string;
  value: string;
  deltaLabel: string | null;
  tone: "pos" | "neg" | "neutral";
}

export interface Verdict {
  headline: string;
  sub: string | null;
  tiles: VerdictTile[];
}
