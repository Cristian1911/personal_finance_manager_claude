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
  currency: CurrencyCode;
}

export function renderWhereTodayWidget({
  transactions,
  today,
  spentToday,
  currency,
}: WhereTodayWidgetData) {
  const tone: ChipTone = "alert";

  const todayTx = transactions.filter(
    (tx) => tx.transaction_date === today && tx.direction === "OUTFLOW"
  );

  const byCategory = new Map<string, number>();
  for (const tx of todayTx) {
    const key = tx.category_name_es ?? "Sin categoría";
    byCategory.set(key, (byCategory.get(key) ?? 0) + tx.amount);
  }

  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const topPreview = sorted.slice(0, 2);
  const totalPreview = spentToday || 1;

  return {
    tone,
    accessibilityLabel: "Gasto hoy",
    chip: (
      <View>
        <ChipEyebrow tone={tone}>Gasto hoy</ChipEyebrow>
        {spentToday === 0 ? (
          <>
            <Text className="mt-2 text-[20px] font-inter-bold text-z-sage-dark">
              $0
            </Text>
            <Text className="mt-1 text-[10px] font-inter text-muted-foreground">
              Sin gastos hoy
            </Text>
          </>
        ) : (
          <>
            <Text className="mt-1.5 text-[18px] font-inter-bold tabular-nums text-foreground">
              {formatCurrency(spentToday, currency)}
            </Text>
            <View className="mt-2 h-1.5 w-full flex-row overflow-hidden rounded-full bg-black-20">
              {topPreview.map(([name, value], i) => (
                <View
                  key={name}
                  style={{
                    width: `${(value / totalPreview) * 100}%`,
                    backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                  }}
                />
              ))}
            </View>
            <View className="mt-1.5 flex-row items-center gap-2">
              {topPreview.map(([name], i) => (
                <View
                  key={name}
                  className="min-w-0 flex-row items-center gap-1"
                >
                  <View
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                  <Text
                    className="text-[10px] font-inter text-muted-foreground"
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    ),
    detail: () => (
      <View className={`${PANEL_INSET_CLASS} p-3`}>
        <ChipDetailHeading tone={tone}>Gasto de hoy</ChipDetailHeading>
        {sorted.length === 0 ? (
          <Text className="py-3 text-center text-[12px] font-inter text-muted-foreground">
            Sin gastos hoy
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
  };
}
