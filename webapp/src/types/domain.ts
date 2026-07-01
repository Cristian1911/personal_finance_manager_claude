import type { Tables, Enums } from "./database";

// Row types from the database
export type Profile = Tables<"profiles">;
export type AccountRow = Tables<"accounts">;
/** Account without sensitive fields — safe for client serialization */
export type Account = Omit<AccountRow, "pdf_password">;
export type Transaction = Tables<"transactions">;
export type Modo = Tables<"modos">;

/** Approximate location captured by mobile and linked to a transaction. */
export interface TransactionLocation {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  place_name: string | null;
  place_locality: string | null;
  place_country: string | null;
  captured_at: string;
  linked_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}
export type Category = Tables<"categories">;
export type Budget = Tables<"budgets">;

export type RecurringTemplate = Tables<"recurring_transaction_templates">;

/** Per-currency entry within a multi-currency recurring template */
export interface SubPayment {
  currency_code: string;
  amount: number;
}

export type EmailIngestAddress = Tables<"email_ingest_addresses">;
export type PendingEmailTransaction = Tables<"pending_email_transactions">;
export type EmailIngestLog = Tables<"email_ingest_logs">;
export type UnrecognizedEmail = Tables<"unrecognized_emails">;
export type FinancialReminder = Tables<"financial_reminders">;
export type PendingEmailStatement = Tables<"pending_email_statements">;
export type WishlistItem = Tables<"wishlist_items">;
export type WishlistReflection = Tables<"wishlist_reflections">;

export type Subscription = Tables<"subscriptions">;
export type SubscriptionStatus = Enums<"subscription_status">;

export type SubscriptionWithDetails = Subscription & {
  destinatario_name: string;
  default_category_id: string | null;
  category_name: string | null;
  template_amount: number | null;
  template_frequency: string | null;
  next_occurrence_date: string | null;
  monthly_expected: number | null;
};

export type PersonalDebt = Tables<"personal_debts">;
export type PersonalDebtDirection = Enums<"personal_debt_direction">;
export type PersonalDebtStatus = Enums<"personal_debt_status">;
export type PdRole = Enums<"pd_role">;
export type DestinatarioKind = Enums<"destinatario_kind">;

/** Flattened shape returned by getPersonalDebtsCached (FK-joined destinatario). */
export type PersonalDebtWithDetails = PersonalDebt & {
  destinatario_name: string;
  destinatario_default_category_id: string | null;
  /** Sum of linked repayment transaction amounts (>= 0). */
  total_repaid: number;
  /** True when due_date is past and status is 'active'. */
  is_overdue: boolean;
};

/**
 * A shared payment ("Pago compartido"): the user's own share plus the group of
 * `lent` personal_debts created from one payment, all sharing a split_group_id.
 * Derived client-side by grouping PersonalDebtWithDetails by split_group_id.
 */
export type SharedPaymentGroup = {
  split_group_id: string;
  /** Total of the payment = the real transaction's full amount. */
  total: number;
  /** The payer's own portion = total − Σ debts.principal_amount. */
  userShare: number;
  /** Amount repaid so far by participants (origin tx split_repaid_amount). */
  recovered: number;
  currency_code: string;
  paid_on: string;
  description: string | null;
  /** Sum of outstanding across the group's active debts. */
  outstanding_total: number;
  /** Account the origin expense was paid from — default target for repayments. */
  origin_account_id: string | null;
  debts: PersonalDebtWithDetails[];
};

// Cashflow planner
export type PlanningPeriodPreset = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";
export type PlanningEntryType = "INCOME" | "EXPENSE";
export type PlanningEntryStatus = "PLANNED" | "COMPLETED" | "SKIPPED";

export interface PlanningPeriod {
  id: string;
  user_id: string;
  name: string | null;
  preset: PlanningPeriodPreset;
  start_date: string;
  end_date: string;
  currency_code: CurrencyCode;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanningEntry {
  id: string;
  user_id: string;
  period_id: string;
  entry_type: PlanningEntryType;
  label: string;
  amount: number;
  currency_code: CurrencyCode;
  expected_date: string;
  status: PlanningEntryStatus;
  completed_at: string | null;
  recurring_template_id: string | null;
  account_id: string | null;
  category_id: string | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanningAssignment {
  id: string;
  user_id: string;
  period_id: string;
  income_entry_id: string;
  expense_entry_id: string;
  assigned_amount: number;
  created_at: string;
  updated_at: string;
}

// Enum types
export type TransactionDirection = Enums<"transaction_direction">;
export type CurrencyCode = Enums<"currency_code">;
export type AccountType = Enums<"account_type">;
export type ConnectionStatus = Enums<"connection_status">;
export type CategorizationSource = Enums<"categorization_source">;
export type TransactionStatus = Enums<"transaction_status">;
export type DataProvider = Enums<"data_provider">;
export type TransactionCaptureMethod = Enums<"transaction_capture_method">;
export type RecurrenceFrequency = Enums<"recurrence_frequency">;

// Category with children for tree views
export type CategoryWithChildren = Category & {
  children: CategoryWithChildren[];
};

export type CategoryWithBudget = CategoryWithChildren & {
  childBudgetTotal: number; // Sum of children's monthly budgets (0 if none)
};

export type ExpenseType = "fixed" | "variable";
export type BudgetMode = "per_category" | "zero_based" | "50_30_20";

export type CategoryBudgetData = {
  id: string;
  name: string;
  name_es: string | null;
  slug: string;
  icon: string;
  color: string;
  is_essential: boolean;
  is_active: boolean;
  direction: TransactionDirection;
  expense_type: ExpenseType | null;
  /** Combined group budget: baseBudget + Σ childBudgets. Null when no rows exist. */
  budget: number | null;
  /** The parent category's OWN budget row ("Base" line). Null when absent. */
  baseBudget: number | null;
  spent: number;
  committedRecurring: number;
  percentUsed: number;
  average3m: number;
  children: CategoryWithChildren[];
  /** Spending per child category: childId → amount spent this month */
  childrenSpent: Record<string, number>;
  /** Budget rows on child categories ("lines"): childId → amount */
  childBudgets: Record<string, number>;
  /** 3-month average spend per child: childId → amount */
  childAvg3m: Record<string, number>;
  /** Monthly recurring committed per child: childId → amount */
  childRecurring: Record<string, number>;
};

// Transaction with account join (used by main transaction views)
export type TransactionWithAccount = Transaction & {
  account: Pick<Account, "id" | "name" | "icon" | "color">;
  category: Pick<Category, "id" | "name" | "name_es" | "icon" | "color"> | null;
  destinatario: { id: string; name: string } | null;
};

// Transaction with linked location (detail view)
export type TransactionWithLocation = TransactionWithAccount & {
  location: TransactionLocation | null;
};

// Transaction with joined relations
export type TransactionWithRelations = Transaction & {
  account: Pick<Account, "id" | "name" | "icon" | "color">;
  category: Pick<Category, "id" | "name" | "name_es" | "icon" | "color"> | null;
};

// Account with computed summary
export type AccountWithSummary = Account & {
  transaction_count: number;
  total_inflow: number;
  total_outflow: number;
};

// Recurring template with joined relations
export type RecurringTemplateWithRelations = RecurringTemplate & {
  account: Pick<Account, "id" | "name" | "icon" | "color" | "account_type" | "currency_code" | "mask" | "bank_key">;
  category: Pick<Category, "id" | "name" | "name_es" | "icon" | "color"> | null;
  transfer_source_account: Pick<Account, "id" | "name" | "account_type" | "currency_code"> | null;
};

// Computed upcoming occurrence from a template
export type UpcomingRecurrence = {
  template: RecurringTemplateWithRelations;
  next_date: string;
};

// Tags
export type TagGroup = Tables<"tag_groups">;
export type Tag = Tables<"tags">;
export type TagWithGroup = Tag & { group: TagGroup | null };
export type TagGroupWithTags = TagGroup & { tags: Tag[] };

export type TaggableEntity = "category" | "destinatario" | "transaction" | "recurring_template";

// Impact Events — track positive financial movements across debt accounts
export interface ImpactEventMetrics {
  utilizationBefore?: number;
  utilizationAfter?: number;
  monthlyInterestBefore?: number;
  monthlyInterestAfter?: number;
  monthsToFreedomBefore?: number;
  monthsToFreedomAfter?: number;
  availableCreditBefore?: number;
  availableCreditAfter?: number;
}

export interface ImpactEvent {
  accountId: string;
  accountName: string;
  accountType: string;
  date: string;
  amountPaid: number;
  currencyCode: string;
  metrics: ImpactEventMetrics;
}
