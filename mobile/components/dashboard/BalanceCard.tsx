import { View, Text } from "react-native";
import { Wallet } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@venti5/shared";

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
    <View className="bg-white rounded-lg shadow-sm p-5 mx-4 mt-4">
      <View className="flex-row items-center mb-2">
        <Wallet size={18} color="#6B7280" />
        <Text className="text-gray-500 font-inter-medium text-sm ml-2">
          Balance total
        </Text>
      </View>
      <Text className="text-gray-900 font-inter-bold text-3xl mb-1">
        {formatCurrency(totalBalance, currencyCode)}
      </Text>
      <Text className="text-gray-400 font-inter text-sm">
        {accountCount} {accountCount === 1 ? "cuenta activa" : "cuentas activas"}
      </Text>
    </View>
  );
}
