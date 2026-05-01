import type { AllocationData } from "@/actions/allocation";
import type { DashboardHeroData } from "@/actions/charts";
import type { DebtCountdownData } from "@/actions/debt-countdown";
import type { IncomeEstimate } from "@/actions/income";
import type { AccountType, CategoryBudgetData, CurrencyCode, UpcomingRecurrence } from "@/types/domain";
import type { Database } from "@/types/database";
import type { DebtOverview } from "@zeta/shared";

export type DebtScenario = Database["public"]["Tables"]["debt_scenarios"]["Row"];
export type PlanPressure = "stable" | "watch" | "critical";

export interface PlanHeroSummary {
  headline: string;
  guidance: string;
  recommendedAction: {
    href: string;
    label: string;
  };
  pressure: PlanPressure;
  availableToSpend: number;
  pendingTotal: number;
  activeDebtCount: number;
}

export interface PlanBudgetSummary {
  categories: CategoryBudgetData[];
  totalBudgeted: number;
  totalSpent: number;
  overLimitCount: number;
  nearLimitCount: number;
  uncategorizedCount: number;
  attentionCategories: CategoryBudgetData[];
  allocation: AllocationData | null;
}

export interface PlanDebtSummary {
  overview: DebtOverview;
  countdown: DebtCountdownData | null;
  activeDebtCount: number;
  highestInterestAccountName: string | null;
}

export interface PlanRecurringSummary {
  upcoming: UpcomingRecurrence[];
  upcomingIncome: UpcomingRecurrence[];
  totalMonthlyExpenses: number;
  totalMonthlyIncome: number;
  activeCount: number;
  dueSoonCount: number;
  dueSoonTotal: number;
  overdueCount: number;
}

export interface PlanScenarioSummary {
  savedScenarios: DebtScenario[];
  latestScenario: DebtScenario | null;
  count: number;
}

export interface PlanMainAccount {
  id: string;
  name: string;
  account_type: AccountType;
  current_balance: number;
  currency_code: CurrencyCode;
  /** Balance converted to the active plan currency (same as current_balance when currency matches). */
  balance_in_base: number;
  icon: string | null;
  color: string | null;
  bank_key: string | null;
  mask: string | null;
}

export interface PlanMainAccountsSummary {
  accounts: PlanMainAccount[];
  totalInBase: number;
  hasUnconvertibleAccounts: boolean;
}

export interface PlanPageData {
  currency: CurrencyCode;
  month?: string;
  heroData: DashboardHeroData;
  heroSummary: PlanHeroSummary;
  budget: PlanBudgetSummary;
  debt: PlanDebtSummary;
  recurring: PlanRecurringSummary;
  mainAccounts: PlanMainAccountsSummary;
  scenarios: PlanScenarioSummary;
  incomeEstimate: IncomeEstimate | null;
}
