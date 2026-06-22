import { View, Text } from "react-native";
import { ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import type { AccountRow } from "../../lib/repositories/accounts";

type Props = {
  account: AccountRow;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Cuenta corriente",
  SAVINGS: "Ahorros",
  CREDIT_CARD: "Tarjeta de crédito",
  LOAN: "Préstamo",
  CASH: "Efectivo",
  INVESTMENT: "Inversión",
  OTHER: "Otro",
};

export function AccountBalanceCard({ account }: Props) {
  const currency = (account.currency_code as CurrencyCode) ?? "COP";
  const isDebt =
    account.account_type === "CREDIT_CARD" ||
    account.account_type === "LOAN";
  const typeDef = ACCOUNT_TYPES.find((t) => t.value === account.account_type);
  const Icon = typeDef?.icon;
  const color = account.color ?? "#6B7280";

  // Credit utilization: balance / credit_limit (only for credit cards)
  const showUtilization =
    account.account_type === "CREDIT_CARD" &&
    account.credit_limit != null &&
    account.credit_limit > 0;
  const utilization = showUtilization
    ? Math.min(Math.abs(account.current_balance) / account.credit_limit!, 1)
    : 0;
  const utilizationPct = Math.round(utilization * 100);

  // Utilization severity color
  const getUtilizationColor = (pct: number) => {
    if (pct >= 80) return "#EF4444"; // red
    if (pct >= 50) return "#F59E0B"; // amber
    return "#10B981"; // green
  };

  return (
    <View className="bg-z-surface-2 rounded-2xl p-5 border border-white-6">
      {/* Top: Icon + type badge + currency */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: color + "20" }}
          >
            {Icon && <Icon size={20} color={color} />}
          </View>
          <View className="bg-z-surface-2 rounded-full px-2.5 py-1">
            <Text className="text-muted-foreground font-inter-medium text-xs">
              {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
            </Text>
          </View>
        </View>
        <View className="bg-z-surface-2 rounded-full px-2.5 py-1">
          <Text className="text-muted-foreground font-inter-semibold text-xs">
            {account.currency_code}
          </Text>
        </View>
      </View>

      {/* Balance */}
      <Text className="text-muted-foreground font-inter text-xs mb-1">
        Balance actual
      </Text>
      <Text
        className={`font-inter-bold text-3xl ${
          isDebt ? "text-z-expense" : "text-foreground"
        }`}
      >
        {formatCurrency(account.current_balance, currency)}
      </Text>

      {/* Credit utilization bar (credit cards only) */}
      {showUtilization && (
        <View className="mt-4">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-muted-foreground font-inter text-xs">
              Utilización de crédito
            </Text>
            <Text
              className="font-inter-semibold text-xs"
              style={{ color: getUtilizationColor(utilizationPct) }}
            >
              {utilizationPct}%
            </Text>
          </View>
          {/* Track */}
          <View className="h-2.5 bg-z-surface-2 rounded-full overflow-hidden">
            {/* Fill */}
            <View
              className="h-full rounded-full"
              style={{
                width: `${utilizationPct}%`,
                backgroundColor: getUtilizationColor(utilizationPct),
              }}
            />
          </View>
          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-muted-fg-70 font-inter text-[10px]">
              {formatCurrency(Math.abs(account.current_balance), currency)} usado
            </Text>
            <Text className="text-muted-fg-70 font-inter text-[10px]">
              {formatCurrency(account.credit_limit!, currency)} limite
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
