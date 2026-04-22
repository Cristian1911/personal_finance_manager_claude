import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import {
  ChipEyebrow,
  ChipDetailHeading,
  type ChipTone,
} from "../../ui/ExpandableChip";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import { COLORS } from "../../../lib/constants/colors";
import type { DashboardTx } from "../../../lib/dashboard/useDashboardData";

const BAR_COLORS = [COLORS.brass, COLORS.income, COLORS.expense, COLORS.alert];

export interface WhereTodayWidgetData {
  transactions: DashboardTx[];
  today: string;
  spentToday: number;
  spentYesterday?: number;
  currency: CurrencyCode;
}

export function renderWhereTodayWidget({
  transactions,
  today,
  spentToday,
  spentYesterday = 0,
  currency,
}: WhereTodayWidgetData) {
  const tone: ChipTone = "foreground";

  const todayTx = transactions.filter(
    (tx) => tx.transaction_date === today && tx.direction === "OUTFLOW"
  );

  const byCategory = new Map<string, number>();
  for (const tx of todayTx) {
    const key = tx.category_name_es ?? "Sin categoría";
    byCategory.set(key, (byCategory.get(key) ?? 0) + tx.amount);
  }

  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return {
    tone,
    accessibilityLabel: "Gasto de hoy",
    chip: (
      <View className="h-full flex-col items-center gap-1">
        <ChipEyebrow tone={tone}>Gasto de hoy</ChipEyebrow>
        <Text className="text-[20px] font-inter-bold leading-none tabular-nums text-foreground">
          {formatCurrency(spentToday, currency)}
        </Text>
        <Text
          numberOfLines={1}
          className="text-[10px] font-inter text-muted-foreground"
        >
          {spentToday === 0
            ? "Sin gastos hoy"
            : spentYesterday > 0
              ? `Ayer ${formatCurrency(spentYesterday, currency)}`
              : "Hoy"}
        </Text>
      </View>
    ),
    detail: () => (
      <View className={`${PANEL_INSET_CLASS} p-3`}>
        <ChipDetailHeading tone={tone}>Gasto de hoy</ChipDetailHeading>
        {sorted.length === 0 ? (
          <Text className="py-3 text-center text-[12px] font-inter text-muted-foreground">
            No hay gastos hoy
          </Text>
        ) : (
          <View className="gap-1.5">
            {sorted.map(([name, value], i) => (
              <View
                key={name}
                className="flex-row items-center justify-between border-b border-white-6 py-1.5"
              >
                <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
                  <View
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                  <Text
                    className="flex-1 text-[12px] font-inter text-foreground"
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
                <Text className="text-[12px] font-inter-semibold tabular-nums text-foreground">
                  {formatCurrency(value, currency)}
                </Text>
              </View>
            ))}
            <View className="mt-1 flex-row justify-between pt-1">
              <Text className="text-[11px] font-inter text-muted-foreground">
                Total
              </Text>
              <Text className="text-[12px] font-inter-bold tabular-nums text-foreground">
                {formatCurrency(spentToday, currency)}
              </Text>
            </View>
          </View>
        )}
      </View>
    ),
    estimatedHeight: sorted.length === 0 ? 100 : 80 + sorted.length * 36,
  };
}
