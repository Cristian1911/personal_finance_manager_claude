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
  purpose: AppPurpose;
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
  purpose: "manage_debt",
  firstName: "",
  currency: "COP",
  incomeMonthly: "",
  expensesMonthly: "",
  debtCount: "",
  accountName: "",
  accountType: "SAVINGS",
  balance: "",
};
