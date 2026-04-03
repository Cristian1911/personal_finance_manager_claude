import type { Tables, Enums } from "./database";

// Row types from the database
export type Profile = Tables<"profiles">;
export type AccountRow = Tables<"accounts">;
/** Account without sensitive fields — safe for client serialization */
export type Account = Omit<AccountRow, "pdf_password">;
export type Transaction = Tables<"transactions">;
export type Category = Tables<"categories">;
export type Budget = Tables<"budgets">;

export type RecurringTemplate = Tables<"recurring_transaction_templates">;
export type EmailIngestAddress = Tables<"email_ingest_addresses">;
export type PendingEmailTransaction = Tables<"pending_email_transactions">;
export type EmailIngestLog = Tables<"email_ingest_logs">;
export type UnrecognizedEmail = Tables<"unrecognized_emails">;
export type FinancialReminder = Tables<"financial_reminders">;
export type PendingEmailStatement = Tables<"pending_email_statements">;
export type WishlistItem = Tables<"wishlist_items">;
export type WishlistReflection = Tables<"wishlist_reflections">;

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
  budget: number | null;
  spent: number;
  committedRecurring: number;
  percentUsed: number;
  average3m: number;
  children: CategoryWithChildren[];
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
  account: Pick<Account, "id" | "name" | "icon" | "color" | "account_type" | "currency_code">;
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

export type TaggableEntity = "category" | "destinatario" | "transaction";

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
