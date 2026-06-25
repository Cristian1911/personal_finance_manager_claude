import type {
  Account,
  Category,
  CurrencyCode,
  PlanningAssignment,
  PlanningEntry,
  PlanningPeriod,
  RecurringTemplate,
} from "./domain";
import type { IncomeState, ExpenseCommitment } from "@/lib/utils/plan-commitments";

/**
 * Sentinel stored in `planning_entries.notes` to flag entries that mirror an
 * account's current balance (managed by `upsertBalanceEnvelopes`). If the user
 * edits the notes, the entry stops being treated as balance-managed.
 */
export const BALANCE_SEED_NOTES = "[saldo]";

export interface PlanningEntryWithRelations extends PlanningEntry {
  account: Pick<Account, "id" | "name" | "icon" | "color"> | null;
  category: Pick<Category, "id" | "name" | "name_es" | "icon" | "color"> | null;
  recurring_template: Pick<RecurringTemplate, "id" | "merchant_name" | "frequency"> | null;
  /** Amount converted to the period's currency (equals amount when same currency) */
  converted_amount: number;
}

export interface AssignmentDetail {
  assignment: PlanningAssignment;
  expense_entry: PlanningEntryWithRelations;
}

export interface IncomeEnvelope {
  entry: PlanningEntryWithRelations;
  total_amount: number;
  assigned_amount: number;
  remaining_amount: number;
  assignments: AssignmentDetail[];
  /** Lifecycle state; opening-balance seeds are reported as "confirmado". */
  state: IncomeState;
  /** True when this envelope mirrors an account's opening balance (`[saldo]`). */
  is_opening_balance: boolean;
}

export interface PeriodPlanData {
  period: PlanningPeriod;
  currency: CurrencyCode;
  income_envelopes: IncomeEnvelope[];
  expense_entries: PlanningEntryWithRelations[];
  unassigned_expenses: PlanningEntryWithRelations[];
  total_income: number;
  total_expenses: number;
  total_assigned: number;
  total_unassigned: number;
  /** Exchange rates used: { "USD": 4200 } means 1 USD = 4200 period-currency units */
  exchange_rates: Partial<Record<CurrencyCode, number>>;
  /** True when entries use currencies other than the period's */
  is_multi_currency: boolean;
  /** Live spendable accounts balance, in period currency (read from `accounts`). */
  saldo_actual: number;
  /** saldo_actual − comprometido_ahora. May be negative (over-committed). */
  puedo_gastar: number;
  /** Unpaid commitments that must come from money in hand (subtract from puedo_gastar). */
  comprometido_ahora: number;
  /** Unpaid commitments covered by an upcoming income that lands in time. */
  comprometido_cubierto: number;
  /** Earliest expected (esperado) income date on/after today, or null. */
  next_income_date: string | null;
  /** Per-expense commitment classification, keyed by expense entry id. */
  commitments: Record<string, ExpenseCommitment>;
}
