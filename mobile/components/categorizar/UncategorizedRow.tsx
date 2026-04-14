import { View, Text, Pressable } from "react-native";
import { ArrowDownLeft, ArrowUpRight, Tag } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import type { TransactionListRow } from "../../lib/repositories/transactions";

interface UncategorizedRowProps {
  transaction: TransactionListRow;
  onAssign: (transactionId: string) => void;
}

export function UncategorizedRow({
  transaction: tx,
  onAssign,
}: UncategorizedRowProps) {
  const description = tx.merchant_name ?? tx.description ?? "Sin descripcion";
  const isInflow = tx.direction === "INFLOW";

  return (
    <View className="flex-row items-center gap-2.5 py-2.5 px-1">
      {/* Direction icon */}
      <View
        className={`h-[22px] w-[22px] items-center justify-center rounded-md ${
          isInflow ? "bg-green-500-10" : "bg-z-expense-12"
        }`}
      >
        {isInflow ? (
          <ArrowDownLeft size={12} color={COLORS.income} />
        ) : (
          <ArrowUpRight size={12} color={COLORS.expense} />
        )}
      </View>

      {/* Description + date */}
      <View className="min-w-0 flex-1">
        <Text
          className="text-xs font-inter-medium text-foreground"
          numberOfLines={1}
        >
          {description}
        </Text>
        <Text
          className="text-[10px] font-inter text-muted-foreground"
          numberOfLines={1}
        >
          {formatDate(tx.transaction_date, "dd MMM")}
        </Text>
      </View>

      {/* Amount */}
      <Text
        className={`text-xs font-inter-medium mr-2 ${
          isInflow ? "text-z-income" : "text-foreground"
        }`}
      >
        {isInflow ? "+" : "-"}
        {formatCurrency(Math.abs(tx.amount), tx.currency_code as CurrencyCode)}
      </Text>

      {/* Category assign button */}
      <Pressable
        onPress={() => onAssign(tx.id)}
        className="flex-row items-center gap-1 rounded-lg border border-z-brass-20 bg-z-brass-8 px-2 py-1 active:bg-z-brass-15"
        accessibilityLabel={`Asignar categoria a ${description}`}
      >
        <Tag size={10} color={COLORS.brass} />
        <Text className="text-[10px] font-inter-semibold text-z-brass">
          Categorizar
        </Text>
      </Pressable>
    </View>
  );
}
