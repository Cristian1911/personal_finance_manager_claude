import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import type { OccurrenceWithTemplate } from "../../lib/repositories/recurring";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

interface PlanWeekTilesProps {
  nextIncome: OccurrenceWithTemplate | null;
  nextPayment: OccurrenceWithTemplate | null;
  currency: CurrencyCode;
}

function PlanWeekTilesBase({ nextIncome, nextPayment, currency }: PlanWeekTilesProps) {
  const router = useRouter();
  const goRecurrentes = () => router.push("/recurrentes" as any);

  return (
    <View className="flex-row gap-2">
      <Pressable
        onPress={goRecurrentes}
        accessibilityRole="button"
        accessibilityLabel="Ver próximos pagos recurrentes"
        className={`${PANEL_INSET_CLASS} border-z-debt-20 flex-1 p-3`}
      >
        <Text className="text-[10px] font-inter-bold uppercase tracking-[0.18em] text-z-debt">
          Próximo pago
        </Text>
        {nextPayment ? (
          <>
            <Text className="mt-2 text-[16px] font-inter-bold tabular-nums text-foreground">
              {formatCurrency(nextPayment.expected_amount, currency)}
            </Text>
            <Text className="mt-0.5 text-[10px] font-inter text-muted-foreground">
              {formatDate(nextPayment.occurrence_date, "dd MMM")}
              {nextPayment.merchant_name ? ` · ${nextPayment.merchant_name}` : ""}
            </Text>
          </>
        ) : (
          <>
            <View className="mt-2 flex-row items-center gap-1">
              <Plus size={12} color={COLORS.debt} />
              <Text className="text-xs font-inter-semibold text-z-debt">Mapear pago</Text>
            </View>
            <Text className="mt-1 text-[10px] font-inter text-muted-foreground">
              Sin pagos recurrentes
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={goRecurrentes}
        accessibilityRole="button"
        accessibilityLabel="Ver próximos ingresos recurrentes"
        className={`${PANEL_INSET_CLASS} border-z-income-20 flex-1 p-3`}
      >
        <Text className="text-[10px] font-inter-bold uppercase tracking-[0.18em] text-z-income">
          Próximo ingreso
        </Text>
        {nextIncome ? (
          <>
            <Text className="mt-2 text-[16px] font-inter-bold tabular-nums text-foreground">
              {formatCurrency(nextIncome.expected_amount, currency)}
            </Text>
            <Text className="mt-0.5 text-[10px] font-inter text-muted-foreground">
              {formatDate(nextIncome.occurrence_date, "dd MMM")}
              {nextIncome.merchant_name ? ` · ${nextIncome.merchant_name}` : ""}
            </Text>
          </>
        ) : (
          <>
            <View className="mt-2 flex-row items-center gap-1">
              <Plus size={12} color={COLORS.income} />
              <Text className="text-xs font-inter-semibold text-z-income">Mapear ingreso</Text>
            </View>
            <Text className="mt-1 text-[10px] font-inter text-muted-foreground">
              Sin ingresos recurrentes
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export const PlanWeekTiles = memo(PlanWeekTilesBase);
