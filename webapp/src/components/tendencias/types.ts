import type {
  AdherencePoint,
  Anomaly,
  CashflowPoint,
  CategoryHierarchyNode,
  CategoryTrend,
  FixedVariable,
  ForecastPoint,
  Mover,
  RecipientRank,
  SavingsPoint,
  Verdict,
} from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

export interface GastosData {
  /** Top-20 by spend — feeds the existing trend/sparkline rows. */
  categories: CategoryTrend[];
  /** Top-5 — kept for the current TopRecipientsCard until it adopts the full list. */
  recipients: RecipientRank[];
  fixedVariable: FixedVariable;
  /** Flat parent+leaf breakdown (windowed totals) for the interactive accordion. */
  categoryHierarchy: CategoryHierarchyNode[];
  /** Full ranked recipient list (capped at 150) for the interactive accordion + search. */
  recipientsFull: RecipientRank[];
}

export interface AhorroData {
  savings: SavingsPoint[];
  cashflow: CashflowPoint[];
  adherence: AdherencePoint[];
}

export interface CambiosData {
  movers: Mover[];
  anomalies: Anomaly[];
  forecast: ForecastPoint[];
  currentBalance: number;
}

export interface TendenciasViewModel {
  range: string;
  currency: CurrencyCode;
  months: string[];
  /** Active period window (YYYY-MM-DD, inclusive) — pass to DrilldownTransactions. */
  windowFrom: string;
  windowTo: string;
  verdict: Verdict;
  gastos: GastosData;
  ahorro: AhorroData;
  cambios: CambiosData;
}
