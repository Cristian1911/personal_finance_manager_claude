import type { CurrencyCode } from "../types/domain";
import type { DebtAccount } from "./debt";

export type ScenarioStrategy = "snowball" | "avalanche" | "custom";

export interface CashEntry {
  id: string;
  amount: number;
  month: string; // "YYYY-MM"
  label?: string;
  currency: CurrencyCode;
  recurring?: { months: number };
}

export interface ManualOverride {
  month: string;
  cashEntryId: string;
  accountId: string;
  amount: number;
}

export interface CascadeRedirect {
  fromAccountId: string;
  toAccountId: string;
}

export interface ScenarioAllocations {
  manualOverrides: ManualOverride[];
  cascadeRedirects: CascadeRedirect[];
  customPriority?: string[];
}

export interface ScenarioEvent {
  type: "cash_injection" | "account_paid_off" | "cascade_redirect";
  description: string;
  accountId?: string;
  amount?: number;
  fromAccountId?: string;
  toAccountId?: string;
  freedAmount?: number;
}

export interface ScenarioMonthAccount {
  accountId: string;
  balanceBefore: number;
  interestAccrued: number;
  minimumPaymentApplied: number;
  extraPaymentApplied: number;
  cascadePaymentApplied: number;
  balanceAfter: number;
  paidOff: boolean;
}

export interface ScenarioMonth {
  month: number;
  calendarMonth: string; // "YYYY-MM"
  totalBalance: number;
  cumulativeInterest: number;
  accounts: ScenarioMonthAccount[];
  events: ScenarioEvent[];
}

export interface ScenarioPayoffEntry {
  accountId: string;
  accountName: string;
  month: number;
  calendarMonth: string;
}

export interface ScenarioResult {
  totalMonths: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  debtFreeDate: string;
  payoffOrder: ScenarioPayoffEntry[];
  timeline: ScenarioMonth[];
}

export interface ScenarioInput {
  accounts: DebtAccount[];
  cashEntries: CashEntry[];
  strategy: ScenarioStrategy;
  allocations: ScenarioAllocations;
  startMonth: string;
}
