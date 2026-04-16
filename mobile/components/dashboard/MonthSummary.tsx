import { View, Text } from "react-native";
import { TrendingUp, TrendingDown } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";

type MonthSummaryProps = {
  income: number;
  expenses: number;
  currencyCode?: CurrencyCode;
};

export function MonthSummary({
  income,
  expenses,
  currencyCode = "COP",
}: MonthSummaryProps) {
  return (
    <View className="flex-row mx-4 mt-4 gap-3">
      {/* Income card */}
      <View className="flex-1 bg-z-surface-2-55 rounded-lg p-4">
        <View className="flex-row items-center mb-2">
          <View className="bg-z-income/10 rounded-full p-1.5">
            <TrendingUp size={14} color="#22C55E" />
          </View>
          <Text className="text-muted-foreground font-inter text-xs ml-2">
            Ingresos
          </Text>
        </View>
        <Text className="text-z-income font-inter-bold text-lg">
          {formatCurrency(income, currencyCode)}
        </Text>
      </View>

      {/* Expenses card */}
      <View className="flex-1 bg-z-surface-2-55 rounded-lg p-4">
        <View className="flex-row items-center mb-2">
          <View className="bg-z-expense/10 rounded-full p-1.5">
            <TrendingDown size={14} color="#EF4444" />
          </View>
          <Text className="text-muted-foreground font-inter text-xs ml-2">
            Gastos
          </Text>
        </View>
        <Text className="text-z-expense font-inter-bold text-lg">
          {formatCurrency(expenses, currencyCode)}
        </Text>
      </View>
    </View>
  );
}
