import type { Tables, Enums } from "./database";

// Row types from the database
export type Profile = Tables<"profiles">;
export type Account = Tables<"accounts">;
export type Transaction = Tables<"transactions">;
export type Category = Tables<"categories">;
export type Budget = Tables<"budgets">;

export type RecurringTemplate = Tables<"recurring_transaction_templates">;

// Enum types
export type TransactionDirection = Enums<"transaction_direction">;
export type CurrencyCode = Enums<"currency_code">;
export type AccountType = Enums<"account_type">;
export type ConnectionStatus = Enums<"connection_status">;
export type CategorizationSource = Enums<"categorization_source">;
export type TransactionStatus = Enums<"transaction_status">;
export type DataProvider = Enums<"data_provider">;
export type RecurrenceFrequency = Enums<"recurrence_frequency">;

// Category with children for tree views
export type CategoryWithChildren = Category & {
  children: CategoryWithChildren[];
};

export type CategoryWithBudget = CategoryWithChildren & {
  childBudgetTotal: number; // Sum of children's monthly budgets (0 if none)
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
  account: Pick<Account, "id" | "name" | "icon" | "color">;
  category: Pick<Category, "id" | "name" | "name_es" | "icon" | "color"> | null;
};

// Computed upcoming occurrence from a template
export type UpcomingRecurrence = {
  template: RecurringTemplateWithRelations;
  next_date: string;
};
