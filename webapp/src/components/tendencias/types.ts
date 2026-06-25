import type {
  AdherencePoint,
  Anomaly,
  CashflowPoint,
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
  categories: CategoryTrend[];
  recipients: RecipientRank[];
  fixedVariable: FixedVariable;
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
  verdict: Verdict;
  gastos: GastosData;
  ahorro: AhorroData;
  cambios: CambiosData;
}
