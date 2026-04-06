import type {
  Account,
  Category,
  CurrencyCode,
  PlanningAssignment,
  PlanningEntry,
  PlanningPeriod,
  RecurringTemplate,
} from "./domain";

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
}
