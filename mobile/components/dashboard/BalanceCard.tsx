import { View, Text } from "react-native";
import { Wallet } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";

type BalanceCardProps = {
  totalBalance: number;
  accountCount: number;
  currencyCode?: CurrencyCode;
};

export function BalanceCard({
  totalBalance,
  accountCount,
  currencyCode = "COP",
}: BalanceCardProps) {
  return (
    <View className="bg-z-surface-2-55 rounded-lg p-5 mx-4 mt-4">
      <View className="flex-row items-center mb-2">
        <Wallet size={18} color={COLORS.sageDark} />
        <Text className="text-muted-foreground font-inter-medium text-sm ml-2">
          Balance total
        </Text>
      </View>
      <Text className="text-foreground font-inter-bold text-3xl mb-1">
        {formatCurrency(totalBalance, currencyCode)}
      </Text>
      <Text className="text-muted-fg-50 font-inter text-sm">
        {accountCount} {accountCount === 1 ? "cuenta activa" : "cuentas activas"}
      </Text>
    </View>
  );
}
