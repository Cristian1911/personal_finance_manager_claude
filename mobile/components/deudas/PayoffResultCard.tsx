import { View, Text } from "react-native";
import {
  formatCurrency,
  expandCashEntries,
  runScenario,
  type CashEntry,
  type CurrencyCode,
  type DebtAccount,
  type ScenarioInput,
  type ScenarioResult,
} from "@zeta/shared";
import { Calendar, TrendingDown, DollarSign } from "lucide-react-native";
import { MCard } from "../ui/MCard";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";
import type { DebtAccountInfo } from "../../lib/repositories/debt";

type Strategy = "avalanche" | "snowball";

const SIMULATION_HORIZON_MONTHS = 360; // 30-year cap, matches shared engine behavior

interface PayoffResult {
  accountId: string;
  name: string;
  balance: number;
  interestRate: number;
  monthlyPayment: number;
  payoffMonth: number;
  totalInterest: number;
}

interface PayoffSummary {
  totalMonths: number;
  totalInterestPaid: number;
  baselineMonths: number;
  baselineInterest: number;
  results: PayoffResult[];
}

interface PayoffResultCardProps {
  accounts: DebtAccountInfo[];
  strategy: Strategy;
  extraCash: number;
  currency: CurrencyCode;
}

function toSharedDebtAccount(info: DebtAccountInfo): DebtAccount {
  return {
    id: info.id,
    name: info.name,
    type: info.type,
    balance: info.balance,
    creditLimit: info.creditLimit > 0 ? info.creditLimit : null,
    interestRate: info.interestRate,
    monthlyPayment: info.monthlyPayment,
    paymentDay: info.paymentDay,
    cutoffDay: null,
    currency: info.currency as CurrencyCode,
    color: null,
    institutionName: null,
    currencyBreakdown: null,
    loanAmount: null,
  };
}

function buildCashEntries(
  extraCash: number,
  currency: CurrencyCode,
  startMonth: string
): CashEntry[] {
  if (extraCash <= 0) return [];
  return expandCashEntries([
    {
      id: "extra",
      amount: extraCash,
      month: startMonth,
      currency,
      recurring: { months: SIMULATION_HORIZON_MONTHS },
    },
  ]);
}

function summarizePerAccount(
  accounts: DebtAccountInfo[],
  result: ScenarioResult
): PayoffResult[] {
  const interestByAccount = new Map<string, number>();
  for (const m of result.timeline) {
    for (const a of m.accounts) {
      interestByAccount.set(
        a.accountId,
        (interestByAccount.get(a.accountId) ?? 0) + a.interestAccrued
      );
    }
  }
  const payoffMonthByAccount = new Map<string, number>();
  for (const entry of result.payoffOrder) {
    payoffMonthByAccount.set(entry.accountId, entry.month);
  }

  return accounts.map((a) => ({
    accountId: a.id,
    name: a.name,
    balance: a.balance,
    interestRate: a.interestRate,
    monthlyPayment: a.monthlyPayment,
    payoffMonth: payoffMonthByAccount.get(a.id) ?? SIMULATION_HORIZON_MONTHS,
    totalInterest: Math.round(interestByAccount.get(a.id) ?? 0),
  }));
}

function calculatePayoff(
  accounts: DebtAccountInfo[],
  extraCash: number,
  strategy: Strategy,
  currency: CurrencyCode
): PayoffSummary {
  const active = accounts.filter((a) => a.balance > 0);
  if (active.length === 0) {
    return {
      totalMonths: 0,
      totalInterestPaid: 0,
      baselineMonths: 0,
      baselineInterest: 0,
      results: [],
    };
  }

  const startMonth = new Date().toISOString().slice(0, 7);
  const sharedAccounts = active.map(toSharedDebtAccount);
  const baseInput: Omit<ScenarioInput, "cashEntries"> = {
    accounts: sharedAccounts,
    strategy,
    allocations: { manualOverrides: [], cascadeRedirects: [] },
    startMonth,
  };

  const withExtra = runScenario({
    ...baseInput,
    cashEntries: buildCashEntries(extraCash, currency, startMonth),
  });
  const baseline = runScenario({ ...baseInput, cashEntries: [] });

  return {
    totalMonths: withExtra.totalMonths,
    totalInterestPaid: Math.round(withExtra.totalInterestPaid),
    baselineMonths: baseline.totalMonths,
    baselineInterest: Math.round(baseline.totalInterestPaid),
    results: summarizePerAccount(active, withExtra),
  };
}

function formatMonths(months: number): string {
  if (months >= 360) return "+30 anos";
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (years === 0) return `${remaining} mes${remaining !== 1 ? "es" : ""}`;
  if (remaining === 0) return `${years} ano${years !== 1 ? "s" : ""}`;
  return `${years}a ${remaining}m`;
}

export function PayoffResultCard({
  accounts,
  strategy,
  extraCash,
  currency,
}: PayoffResultCardProps) {
  const summary = calculatePayoff(accounts, extraCash, strategy, currency);

  if (summary.results.length === 0) {
    return (
      <MCard>
        <Text className="text-sm font-inter text-muted-foreground text-center py-4">
          No hay deudas activas para simular
        </Text>
      </MCard>
    );
  }

  const monthsSaved = summary.baselineMonths - summary.totalMonths;
  const interestSaved = summary.baselineInterest - summary.totalInterestPaid;

  return (
    <View className="gap-2">
      {/* Summary stats */}
      <MCard className="gap-3">
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Resumen
        </Text>

        <View className="flex-row items-center gap-3">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-z-brass-8">
            <Calendar size={16} color={COLORS.brass} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-inter-semibold text-foreground">
              {formatMonths(summary.totalMonths)}
            </Text>
            <Text className="text-[11px] font-inter text-muted-foreground">
              Tiempo para estar libre de deudas
            </Text>
          </View>
        </View>

        {monthsSaved > 0 && (
          <View className="flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-z-income/10">
              <TrendingDown size={16} color={COLORS.income} />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-inter-semibold text-z-income">
                {monthsSaved} mes{monthsSaved !== 1 ? "es" : ""} menos
              </Text>
              <Text className="text-[11px] font-inter text-muted-foreground">
                vs. pagar solo minimos ({formatMonths(summary.baselineMonths)})
              </Text>
            </View>
          </View>
        )}

        {interestSaved > 0 && (
          <View className="flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-z-income/10">
              <DollarSign size={16} color={COLORS.income} />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-inter-semibold text-z-income">
                {formatCurrency(interestSaved, currency)}
              </Text>
              <Text className="text-[11px] font-inter text-muted-foreground">
                Ahorro en intereses
              </Text>
            </View>
          </View>
        )}
      </MCard>

      {/* Per-account breakdown */}
      <MCard className="gap-2">
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Detalle por cuenta
        </Text>

        {summary.results.map((result) => (
          <View
            key={result.accountId}
            className={`${PANEL_INSET_CLASS} p-3`}
          >
            <View className="flex-row items-center justify-between">
              <View className="min-w-0 flex-1">
                <Text
                  className="text-sm font-inter-medium text-foreground"
                  numberOfLines={1}
                >
                  {result.name}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {result.interestRate}% EA · Saldo:{" "}
                  {formatCurrency(result.balance, currency)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-inter-semibold text-foreground">
                  {formatMonths(result.payoffMonth)}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  Interes: {formatCurrency(result.totalInterest, currency)}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </MCard>

      {/* Baseline comparison */}
      <MCard className="gap-1">
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Solo con minimos
        </Text>
        <Text className="text-sm font-inter text-muted-foreground">
          Tardarias {formatMonths(summary.baselineMonths)} y pagarias{" "}
          {formatCurrency(summary.baselineInterest, currency)} en intereses
        </Text>
      </MCard>
    </View>
  );
}
