import type { Tables, Enums } from "./database";

// Row types from the database
export type Profile = Tables<"profiles">;
export type Account = Tables<"accounts">;
export type Transaction = Tables<"transactions">;
export type Category = Tables<"categories">;

// Enum types
export type TransactionDirection = Enums<"transaction_direction">;
export type CurrencyCode = Enums<"currency_code">;
export type AccountType = Enums<"account_type">;
export type ConnectionStatus = Enums<"connection_status">;
export type CategorizationSource = Enums<"categorization_source">;
export type TransactionStatus = Enums<"transaction_status">;
export type DataProvider = Enums<"data_provider">;

// Category with children for tree views
export type CategoryWithChildren = Category & {
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
