import { View, Text } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import {
  ChipEyebrow,
  ChipDetailHeading,
  type ChipTone,
} from "../../ui/ExpandableChip";
import { StateChip } from "../../ui/StateChip";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import { COLORS } from "../../../lib/constants/colors";
import type { DashboardTx } from "../../../lib/dashboard/useDashboardData";

export interface RecentWidgetData {
  transactions: DashboardTx[];
}

export function renderRecentWidget({ transactions }: RecentWidgetData) {
  const tone: ChipTone = "brass";
  const preview = transactions.slice(0, 2);
  const visible = transactions.slice(0, 5);

  return {
    tone,
    accessibilityLabel: "Movimientos recientes",
    chip: (
      <View>
        <ChipEyebrow tone={tone}>Recientes</ChipEyebrow>
        {preview.length === 0 ? (
          <Text className="mt-2 text-[11px] font-inter text-muted-foreground">
            Sin movimientos aún
          </Text>
        ) : (
          <View className="mt-2 gap-1.5">
            {preview.map((tx) => {
              const isInflow = tx.direction === "INFLOW";
              return (
                <View key={tx.id} className="flex-row items-center gap-2">
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-md ${
                      isInflow ? "bg-z-income-10" : "bg-z-expense-10"
                    }`}
                  >
                    {isInflow ? (
                      <ArrowDownLeft size={10} color={COLORS.income} />
                    ) : (
                      <ArrowUpRight size={10} color={COLORS.expense} />
                    )}
                  </View>
                  <Text
                    className="min-w-0 flex-1 text-[11px] font-inter text-foreground"
                    numberOfLines={1}
                  >
                    {tx.description}
                  </Text>
                  <Text
                    className={`text-[11px] font-inter-semibold tabular-nums ${
                      isInflow ? "text-z-income" : "text-foreground"
                    }`}
                  >
                    {isInflow ? "+" : "-"}
                    {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    ),
    detail: () => (
      <View className={`${PANEL_INSET_CLASS} p-3`}>
        <ChipDetailHeading tone={tone}>Últimos movimientos</ChipDetailHeading>
        {visible.length === 0 ? (
          <Text className="py-3 text-center text-[12px] font-inter text-muted-foreground">
            Sin movimientos aún
          </Text>
        ) : (
          visible.map((tx) => {
            const isInflow = tx.direction === "INFLOW";
            return (
              <View
                key={tx.id}
                className="flex-row items-center gap-2 border-b border-white-6 py-2"
              >
                <View
                  className={`h-7 w-7 items-center justify-center rounded-md ${
                    isInflow ? "bg-z-income-10" : "bg-z-expense-10"
                  }`}
                >
                  {isInflow ? (
                    <ArrowDownLeft size={12} color={COLORS.income} />
                  ) : (
                    <ArrowUpRight size={12} color={COLORS.expense} />
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text
                      className="min-w-0 flex-shrink text-[12px] font-inter-medium text-foreground"
                      numberOfLines={1}
                    >
                      {tx.description}
                    </Text>
                    {tx.is_recurring && (
                      <StateChip label="Fijos" variant="brass" />
                    )}
                  </View>
                  <Text
                    className="text-[10px] font-inter text-muted-foreground"
                    numberOfLines={1}
                  >
                    {tx.account_name}
                    {tx.category_name_es ? ` · ${tx.category_name_es}` : ""}
                  </Text>
                </View>
                <Text
                  className={`text-[12px] font-inter-semibold tabular-nums ${
                    isInflow ? "text-z-income" : "text-foreground"
                  }`}
                >
                  {isInflow ? "+" : "-"}
                  {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                </Text>
              </View>
            );
          })
        )}
      </View>
    ),
    estimatedHeight: visible.length === 0 ? 100 : 60 + visible.length * 56,
  };
}
