export type AppPurpose =
  | "manage_debt"
  | "track_spending"
  | "save_money"
  | "improve_habits";

export type CurrencyCode = "COP" | "USD" | "EUR" | "MXN" | "BRL";

export type OnboardingAccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "CASH";

export type OnboardingData = {
  /** Null until the user explicitly picks a purpose on step 1 (no default). */
  purpose: AppPurpose | null;
  firstName: string;
  currency: CurrencyCode;
  incomeMonthly: string;
  expensesMonthly: string;
  debtCount: string;
  accountName: string;
  accountType: OnboardingAccountType;
  balance: string;
};

export const DEFAULT_ONBOARDING: OnboardingData = {
  purpose: null,
  firstName: "",
  currency: "COP",
  incomeMonthly: "",
  expensesMonthly: "",
  debtCount: "",
  accountName: "",
  accountType: "SAVINGS",
  balance: "",
};
