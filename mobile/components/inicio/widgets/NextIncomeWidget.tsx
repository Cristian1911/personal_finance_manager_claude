import { View, Text } from "react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import {
  ChipEyebrow,
  ChipDetailHeading,
  type ChipTone,
} from "../../ui/ExpandableChip";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import type {
  NextIncome,
  UpcomingItem,
} from "../../../lib/dashboard/useDashboardData";

export interface NextIncomeWidgetData {
  income: NextIncome;
  upcoming: UpcomingItem[];
  currency: CurrencyCode;
}

export function renderNextIncomeWidget({
  income,
  upcoming,
  currency,
}: NextIncomeWidgetData) {
  const tone: ChipTone = "income";

  const subtitle = income
    ? income.daysUntil === 0
      ? "llega hoy"
      : income.daysUntil === 1
        ? "mañana"
        : `en ${income.daysUntil} días`
    : null;

  const total = upcoming.reduce((s, u) => s + u.amount, 0);

  return {
    tone,
    accessibilityLabel: "Próximo ingreso",
    chip: (
      <View>
        <ChipEyebrow tone={tone}>Próximo ingreso</ChipEyebrow>
        {income ? (
          <>
            <Text
              className="mt-2 text-[24px] font-inter-bold tabular-nums text-z-income"
              numberOfLines={1}
            >
              {formatCurrency(income.amount, currency)}
            </Text>
            <Text
              className="mt-1 text-[11px] font-inter text-foreground"
              numberOfLines={1}
            >
              {income.name}
            </Text>
            <Text className="text-[10px] font-inter text-muted-foreground">
              {subtitle}
            </Text>
          </>
        ) : (
          <>
            <Text className="mt-2 text-[24px] font-inter-bold text-z-sage-dark">
              —
            </Text>
            <Text className="mt-1 text-[11px] font-inter text-muted-foreground">
              Sin ingresos próximos
            </Text>
          </>
        )}
      </View>
    ),
    detail: (
      <View className={`${PANEL_INSET_CLASS} p-3`}>
        <ChipDetailHeading tone={tone}>Ingresos esperados</ChipDetailHeading>
        {upcoming.length === 0 ? (
          <Text className="py-3 text-center text-[12px] font-inter text-muted-foreground">
            No tienes ingresos recurrentes configurados
          </Text>
        ) : (
          <>
            {upcoming.map((u) => (
              <View
                key={u.id}
                className="flex-row items-center justify-between border-b border-white-6 py-2"
              >
                <View className="min-w-0 flex-1 pr-2">
                  <Text
                    className="text-[12px] font-inter-medium text-foreground"
                    numberOfLines={1}
                  >
                    {u.name}
                  </Text>
                  <Text
                    className="text-[10px] font-inter text-muted-foreground"
                    numberOfLines={1}
                  >
                    {formatDate(u.date, "dd MMM yyyy")}
                    {u.accountName ? ` · ${u.accountName}` : ""}
                  </Text>
                </View>
                <Text className="text-[13px] font-inter-semibold tabular-nums text-z-income">
                  {formatCurrency(u.amount, currency)}
                </Text>
              </View>
            ))}
            <View className="mt-2 flex-row justify-between pt-2">
              <Text className="text-[11px] font-inter text-muted-foreground">
                Total
              </Text>
              <Text className="text-[12px] font-inter-bold tabular-nums text-z-income">
                {formatCurrency(total, currency)}
              </Text>
            </View>
          </>
        )}
      </View>
    ),
  };
}
