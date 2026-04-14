import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { Calendar, TrendingDown, DollarSign } from "lucide-react-native";
import { MCard } from "../ui/MCard";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";
import type { DebtAccountInfo } from "../../lib/repositories/debt";

type Strategy = "avalanche" | "snowball";

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

/**
 * Simulate monthly debt payoff using the chosen strategy.
 * Extra cash is applied to the top-priority account on top of minimum payments.
 */
function calculatePayoff(
  accounts: DebtAccountInfo[],
  extraCash: number,
  strategy: Strategy
): PayoffSummary {
  // Filter to accounts with a balance
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

  // Sort by strategy
  const sorted = [...active].sort((a, b) =>
    strategy === "avalanche"
      ? (b.interestRate ?? 0) - (a.interestRate ?? 0)
      : a.balance - b.balance
  );

  // ── With extra cash ─────────────────────────────────────────────
  const withExtra = simulate(sorted, extraCash);

  // ── Baseline (minimum payments only) ────────────────────────────
  const baseline = simulate(sorted, 0);

  return {
    totalMonths: withExtra.totalMonths,
    totalInterestPaid: Math.round(withExtra.totalInterest),
    baselineMonths: baseline.totalMonths,
    baselineInterest: Math.round(baseline.totalInterest),
    results: withExtra.perAccount.map((r) => ({
      accountId: r.id,
      name: r.name,
      balance: r.originalBalance,
      interestRate: r.interestRate,
      monthlyPayment: r.monthlyPayment,
      payoffMonth: r.payoffMonth,
      totalInterest: Math.round(r.interestPaid),
    })),
  };
}

function simulate(
  accounts: DebtAccountInfo[],
  extraCash: number
): {
  totalMonths: number;
  totalInterest: number;
  perAccount: {
    id: string;
    name: string;
    originalBalance: number;
    interestRate: number;
    monthlyPayment: number;
    payoffMonth: number;
    interestPaid: number;
  }[];
} {
  const MAX_MONTHS = 360; // 30-year cap

  // Working balances
  const balances = accounts.map((a) => a.balance);
  const paidOff = accounts.map(() => false);
  const payoffMonths = accounts.map(() => 0);
  const interestPaid = accounts.map(() => 0);
  let month = 0;

  while (balances.some((b, i) => !paidOff[i] && b > 0) && month < MAX_MONTHS) {
    month++;

    // 1. Apply monthly interest
    for (let i = 0; i < accounts.length; i++) {
      if (paidOff[i]) continue;
      const monthlyRate = (accounts[i].interestRate ?? 0) / 100 / 12;
      const interest = balances[i] * monthlyRate;
      interestPaid[i] += interest;
      balances[i] += interest;
    }

    // 2. Apply minimum payments
    for (let i = 0; i < accounts.length; i++) {
      if (paidOff[i]) continue;
      const minPay = Math.min(accounts[i].monthlyPayment, balances[i]);
      balances[i] -= minPay;
      if (balances[i] <= 0.01) {
        balances[i] = 0;
        paidOff[i] = true;
        payoffMonths[i] = month;
      }
    }

    // 3. Apply extra cash to first non-paid-off account (priority order)
    let remaining = extraCash;
    for (let i = 0; i < accounts.length; i++) {
      if (paidOff[i] || remaining <= 0) continue;
      const payment = Math.min(remaining, balances[i]);
      balances[i] -= payment;
      remaining -= payment;
      if (balances[i] <= 0.01) {
        balances[i] = 0;
        paidOff[i] = true;
        payoffMonths[i] = month;
      }
    }

    // 4. If an account just got paid off, its minimum payment becomes extra for the next month
    // (debt snowball/avalanche cascade happens naturally next iteration)
  }

  // Handle accounts that couldn't be paid off within the cap
  for (let i = 0; i < accounts.length; i++) {
    if (!paidOff[i]) {
      payoffMonths[i] = MAX_MONTHS;
    }
  }

  return {
    totalMonths: Math.max(...payoffMonths),
    totalInterest: interestPaid.reduce((a, b) => a + b, 0),
    perAccount: accounts.map((a, i) => ({
      id: a.id,
      name: a.name,
      originalBalance: a.balance,
      interestRate: a.interestRate,
      monthlyPayment: a.monthlyPayment,
      payoffMonth: payoffMonths[i],
      interestPaid: interestPaid[i],
    })),
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
  const summary = calculatePayoff(accounts, extraCash, strategy);

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
