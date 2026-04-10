import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";

interface TransactionItem {
  id: string;
  description: string | null;
  merchant_name: string | null;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currency_code: string;
  transaction_date: string;
  category_name_es: string | null;
  category_color: string | null;
  category_icon: string | null;
  account_type: string | null;
}

interface MovimientosTransactionRowProps {
  transaction: TransactionItem;
}

export function MovimientosTransactionRow({
  transaction: tx,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const description = tx.merchant_name ?? tx.description ?? "Sin descripcion";
  const isInflow = tx.direction === "INFLOW";

  return (
    <View className={expanded ? "border-l-2 border-l-z-brass pl-2" : ""}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center gap-2 py-2 px-1"
      >
        {/* Direction icon */}
        <View
          className={`h-[22px] w-[22px] items-center justify-center rounded-md ${isInflow ? "bg-green-500-10" : "bg-z-expense-12"}`}
        >
          {isInflow ? (
            <ArrowDownLeft size={12} color={COLORS.income} />
          ) : (
            <ArrowUpRight size={12} color={COLORS.expense} />
          )}
        </View>

        {/* Description + category */}
        <View className="min-w-0 flex-1">
          <Text className="text-xs font-inter-medium text-foreground" numberOfLines={1}>
            {description}
          </Text>
          <Text className={`text-[10px] font-inter ${tx.category_name_es ? "text-muted-foreground" : "text-z-brass"}`} numberOfLines={1}>
            {tx.category_name_es ?? "Sin categoria"}
          </Text>
        </View>

        {/* Amount */}
        <Text className={`text-xs font-inter-medium ${isInflow ? "text-z-income" : "text-foreground"}`}>
          {isInflow ? "+" : "-"}{formatCurrency(Math.abs(tx.amount), tx.currency_code as CurrencyCode)}
        </Text>
      </Pressable>

      {/* Expanded detail */}
      <AnimatedAccordion expanded={expanded} estimatedHeight={60}>
        <View className={`mb-1.5 ${PANEL_INSET_CLASS} border-z-brass-15 bg-black-20 p-2.5 flex-row items-center justify-between`}>
          <Text className="text-[11px] font-inter text-muted-foreground">
            {isInflow ? "Ingreso" : "Gasto"} · {formatCurrency(Math.abs(tx.amount), tx.currency_code as CurrencyCode)}
          </Text>
          <Pressable onPress={() => router.push(`/transaction/${tx.id}` as any)}>
            <Text className="text-[11px] font-inter-semibold text-z-brass">
              Ver detalle
            </Text>
          </Pressable>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
