import { View, Text, Pressable } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { WidgetFrame } from "./WidgetFrame";
import { SECTION_EYEBROW_CLASS } from "../../../lib/constants/styles";
import { COLORS } from "../../../lib/constants/colors";
import type { DashboardTx } from "../../../lib/dashboard/useDashboardData";

interface RecentWidgetProps {
  transactions: DashboardTx[];
  editing?: boolean;
  onRemove?: () => void;
}

export function RecentWidget({ transactions, editing, onRemove }: RecentWidgetProps) {
  const router = useRouter();
  const visible = transactions.slice(0, 3);

  return (
    <WidgetFrame
      editing={editing}
      onRemove={onRemove}
      onPress={() => router.push("/(tabs)/transactions")}
      accessibilityLabel="Movimientos recientes"
    >
      <Text className={SECTION_EYEBROW_CLASS}>Reciente</Text>
      {visible.length === 0 ? (
        <Text className="mt-2 text-[11px] font-inter text-muted-foreground">
          Sin movimientos aún
        </Text>
      ) : (
        <View className="mt-2">
          {visible.map((tx) => {
            const isInflow = tx.direction === "INFLOW";
            return (
              <Pressable
                key={tx.id}
                onPress={() => router.push(`/transaction/${tx.id}` as any)}
                className="flex-row items-center gap-2 py-1.5"
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded-md ${
                    isInflow ? "bg-z-income-10" : "bg-z-expense-12"
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
                      <View className="rounded-md border border-z-brass-20 bg-z-brass-10 px-1 py-0.5">
                        <Text className="text-[8px] font-inter-semibold uppercase tracking-[1px] text-z-brass">
                          Fijos
                        </Text>
                      </View>
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
                  className={`text-[12px] font-inter-medium ${
                    isInflow ? "text-z-income" : "text-foreground"
                  }`}
                >
                  {isInflow ? "+" : "-"}
                  {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push("/(tabs)/transactions")}
            accessibilityRole="button"
            accessibilityLabel="Ver todos los movimientos"
            className="mt-1"
          >
            <Text className="text-[11px] font-inter-semibold text-z-brass">
              Ver todos →
            </Text>
          </Pressable>
        </View>
      )}
    </WidgetFrame>
  );
}
