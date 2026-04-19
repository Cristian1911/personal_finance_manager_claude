import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { WidgetFrame } from "./WidgetFrame";
import { SECTION_EYEBROW_CLASS } from "../../../lib/constants/styles";
import { COLORS } from "../../../lib/constants/colors";
import type { DashboardTx } from "../../../lib/dashboard/useDashboardData";

interface WhereTodayWidgetProps {
  transactions: DashboardTx[];
  today: string; // YYYY-MM-DD
  spentToday: number;
  currency: CurrencyCode;
  editing?: boolean;
  onRemove?: () => void;
}

const BAR_COLORS = [COLORS.brass, COLORS.income, COLORS.expense, COLORS.alert];

export function WhereTodayWidget({
  transactions,
  today,
  spentToday,
  currency,
  editing,
  onRemove,
}: WhereTodayWidgetProps) {
  const router = useRouter();

  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.transaction_date !== today || tx.direction !== "OUTFLOW") continue;
    const key = tx.category_name_es ?? "Sin categoría";
    byCategory.set(key, (byCategory.get(key) ?? 0) + tx.amount);
  }

  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalTop = top.reduce((s, [, v]) => s + v, 0) || 1;

  return (
    <WidgetFrame
      editing={editing}
      onRemove={onRemove}
      onPress={() => router.push("/(tabs)/transactions")}
      accessibilityLabel="Gasto de hoy"
    >
      <Text className={SECTION_EYEBROW_CLASS}>Gasto hoy</Text>
      {spentToday === 0 ? (
        <View className="mt-2">
          <Text className="text-[22px] font-inter-bold text-z-sage-light">$0</Text>
          <Text className="mt-1 text-[11px] font-inter text-muted-foreground">
            Sin gastos
          </Text>
        </View>
      ) : (
        <>
          <Text className="mt-2 text-[18px] font-inter-bold tabular-nums text-foreground">
            {formatCurrency(spentToday, currency)}
          </Text>
          <View className="mt-2 h-1.5 w-full flex-row overflow-hidden rounded-full bg-black-20">
            {top.map(([name, value], i) => (
              <View
                key={name}
                style={{
                  width: `${(value / totalTop) * 100}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            ))}
          </View>
          <View className="mt-1.5 gap-0.5">
            {top.map(([name], i) => (
              <View key={name} className="flex-row items-center gap-1">
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
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
    </WidgetFrame>
  );
}
