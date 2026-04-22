import { memo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ArrowDownLeft, ArrowUpRight, Pencil } from "lucide-react-native";
import { useRouter } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import type { TransactionListRow } from "../../lib/repositories/transactions";

interface MovimientosTransactionRowProps {
  transaction: TransactionListRow;
  onRequestCategoryPicker: (txId: string) => void;
}

function MovimientosTransactionRowBase({
  transaction: tx,
  onRequestCategoryPicker,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const description = tx.merchant_name ?? tx.description ?? "Sin descripción";
  const isInflow = tx.direction === "INFLOW";
  const isExcluded = Boolean(tx.is_excluded);
  const categoryName = tx.category_name_es ?? tx.category_name;

  return (
    <View className={expanded ? "border-l-2 border-l-z-brass pl-2" : ""}>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        className={`flex-row items-center gap-2 rounded-xl px-1.5 py-2 active:bg-white-5 ${isExcluded ? "opacity-40" : ""}`}
      >
        <View
          className={`h-[22px] w-[22px] items-center justify-center rounded-md ${isInflow ? "bg-z-income-10" : "bg-z-expense-12"}`}
        >
          {isInflow ? (
            <ArrowDownLeft size={12} color={COLORS.income} />
          ) : (
            <ArrowUpRight size={12} color={COLORS.expense} />
          )}
        </View>

        <View className="min-w-0 flex-1">
          <Text
            className="text-sm font-inter-medium text-foreground"
            numberOfLines={1}
          >
            {description}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            {tx.account_color && (
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tx.account_color }}
              />
            )}
            <Text
              className="text-[11px] font-inter text-muted-foreground"
              numberOfLines={1}
            >
              {tx.account_name ?? "Cuenta"}
            </Text>
            <Text className="text-[11px] text-white-15">·</Text>
            {categoryName ? (
              <Text
                className="text-[11px] font-inter text-muted-foreground"
                numberOfLines={1}
              >
                {categoryName}
              </Text>
            ) : (
              <Text className="text-[11px] font-inter text-z-brass">
                Sin categoría
              </Text>
            )}
          </View>
        </View>

        <Text
          className={`text-sm font-inter-medium ${
            isInflow ? "text-z-income" : "text-foreground"
          } ${isExcluded ? "line-through" : ""}`}
        >
          {isInflow ? "+" : "-"}
          {formatCurrency(Math.abs(tx.amount), tx.currency_code as CurrencyCode)}
        </Text>
      </Pressable>

      <AnimatedAccordion expanded={expanded} estimatedHeight={52}>
        <View className="flex-row flex-wrap items-center gap-1.5 px-2 pb-2 pt-0.5">
          <Pressable
            onPress={() => onRequestCategoryPicker(tx.id)}
            className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${
              categoryName
                ? "border-z-brass-20 bg-z-brass-8"
                : "border-white-8 bg-black-10"
            }`}
          >
            {tx.category_color && (
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: tx.category_color }}
              />
            )}
            <Text
              className={`text-[10px] font-inter-semibold ${categoryName ? "text-z-brass" : "text-muted-foreground"}`}
            >
              {categoryName ?? "Categoría"}
            </Text>
          </Pressable>

          <View className="flex-1" />

          <Pressable
            onPress={() => router.push(`/transaction/${tx.id}` as any)}
            className="flex-row items-center gap-1 rounded-full border border-white-8 bg-black-10 px-2.5 py-1 active:bg-white-5"
          >
            <Pencil size={10} color={COLORS.sageDark} />
            <Text className="text-[10px] font-inter-semibold text-muted-foreground">
              Editar
            </Text>
          </Pressable>
        </View>
      </AnimatedAccordion>
    </View>
  );
}

export const MovimientosTransactionRow = memo(MovimientosTransactionRowBase);
