import { memo, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import type { OccurrenceWithTemplate } from "../../lib/repositories/recurring";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

interface PlanWeekTilesProps {
  incomes: OccurrenceWithTemplate[];
  payments: OccurrenceWithTemplate[];
  currency: CurrencyCode;
}

type ChipType = "income" | "payment";

function PlanWeekTilesBase({ incomes, payments, currency }: PlanWeekTilesProps) {
  const router = useRouter();
  const [active, setActive] = useState<ChipType | null>(null);

  const nextIncome = incomes[0] ?? null;
  const nextPayment = payments[0] ?? null;

  // Order: sooner date first. Tie-breaker: payment first (debt urgency).
  const paymentSooner = useMemo(() => {
    const incomeDate = nextIncome?.occurrence_date ?? null;
    const paymentDate = nextPayment?.occurrence_date ?? null;
    if (!incomeDate && !paymentDate) return false;
    if (!incomeDate) return true;
    if (!paymentDate) return false;
    return paymentDate <= incomeDate;
  }, [nextIncome, nextPayment]);

  const orderedTypes: ChipType[] = paymentSooner ? ["payment", "income"] : ["income", "payment"];
  const sooner = orderedTypes[0];

  const toggle = (type: ChipType) => {
    setActive((prev) => (prev === type ? null : type));
  };

  const expandedList = active === "income" ? incomes : active === "payment" ? payments : [];
  const expandedTotal = useMemo(
    () => expandedList.reduce((sum, item) => sum + item.expected_amount, 0),
    [expandedList]
  );

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {orderedTypes.map((type) => {
          const isPayment = type === "payment";
          const next = isPayment ? nextPayment : nextIncome;
          const isActive = active === type;
          const isDimmed = active !== null && !isActive;
          const isSooner = type === sooner && next !== null && active === null;

          const label = isPayment ? "Próximo pago" : "Próximo ingreso";
          const emptyAction = isPayment ? "Mapear pago" : "Mapear ingreso";
          const emptyHint = isPayment ? "Sin pagos recurrentes" : "Sin ingresos recurrentes";
          const accentText = isPayment ? "text-z-debt" : "text-z-income";
          const accentBorder = isPayment ? "border-z-debt-20" : "border-z-income-20";
          const iconColor = isPayment ? COLORS.debt : COLORS.income;
          const ringClass = isSooner ? "border-z-brass-30" : accentBorder;

          return (
            <Pressable
              key={type}
              onPress={() => toggle(type)}
              accessibilityRole="button"
              accessibilityLabel={isActive ? `Ocultar ${label.toLowerCase()}` : `Ver ${label.toLowerCase()}`}
              className={`${PANEL_INSET_CLASS} ${ringClass} flex-1 p-3 ${isDimmed ? "opacity-60" : ""}`}
            >
              <Text className={`text-[10px] font-inter-bold uppercase tracking-[0.18em] ${accentText}`}>
                {label}
              </Text>
              {next ? (
                <>
                  <Text className="mt-2 text-[16px] font-inter-bold tabular-nums text-foreground">
                    {formatCurrency(next.expected_amount, currency)}
                  </Text>
                  <Text className="mt-0.5 text-[10px] font-inter text-muted-foreground">
                    {formatDate(next.occurrence_date, "dd MMM")}
                    {next.merchant_name ? ` · ${next.merchant_name}` : ""}
                  </Text>
                </>
              ) : (
                <>
                  <View className="mt-2 flex-row items-center gap-1">
                    <Plus size={12} color={iconColor} />
                    <Text className={`text-xs font-inter-semibold ${accentText}`}>{emptyAction}</Text>
                  </View>
                  <Text className="mt-1 text-[10px] font-inter text-muted-foreground">
                    {emptyHint}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>

      <AnimatedAccordion expanded={active !== null} estimatedHeight={700}>
        {active !== null && (
          <View
            className={`${PANEL_INSET_CLASS} ${active === "income" ? "border-z-income-20" : "border-z-debt-20"} p-3`}
          >
            <Text
              className={`text-[10px] font-inter-bold uppercase tracking-[0.18em] mb-2 ${active === "income" ? "text-z-income" : "text-z-debt"}`}
            >
              {active === "income" ? "Ingresos esperados" : "Pagos programados"}
            </Text>
            {expandedList.length > 0 ? (
              <>
                {expandedList.map((item, i) => (
                  <View
                    key={`${item.id}-${i}`}
                    className={`flex-row items-center justify-between py-2 ${i < expandedList.length - 1 ? "border-b border-white-6" : ""}`}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-inter-medium text-foreground" numberOfLines={1}>
                        {item.merchant_name ?? item.description ?? (active === "income" ? "Ingreso" : "Pago")}
                      </Text>
                      <Text className="text-[10px] font-inter text-muted-foreground">
                        {formatDate(item.occurrence_date, "dd MMM yyyy")}
                      </Text>
                    </View>
                    <Text
                      className={`text-sm font-inter-semibold tabular-nums ${active === "income" ? "text-z-income" : "text-z-debt"}`}
                    >
                      {formatCurrency(item.expected_amount, currency)}
                    </Text>
                  </View>
                ))}
                <View className="mt-2 flex-row justify-between border-t border-white-6 pt-2">
                  <Text className="text-xs font-inter text-muted-foreground">Total</Text>
                  <Text
                    className={`text-xs font-inter-bold tabular-nums ${active === "income" ? "text-z-income" : "text-z-debt"}`}
                  >
                    {formatCurrency(expandedTotal, currency)}
                  </Text>
                </View>
              </>
            ) : (
              <View className="items-center py-3">
                <Text className="text-xs font-inter text-muted-foreground mb-2">
                  {active === "income"
                    ? "No tienes ingresos recurrentes configurados"
                    : "No tienes pagos recurrentes configurados"}
                </Text>
                <Pressable
                  onPress={() => router.push("/recurrentes" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Ir a recurrentes"
                  className={`flex-row items-center gap-1 rounded-lg px-3 py-1.5 ${active === "income" ? "bg-z-income-12" : "bg-z-debt-12"}`}
                >
                  <Plus size={14} color={active === "income" ? COLORS.income : COLORS.debt} />
                  <Text
                    className={`text-xs font-inter-semibold ${active === "income" ? "text-z-income" : "text-z-debt"}`}
                  >
                    Crear en Recurrentes
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </AnimatedAccordion>
    </View>
  );
}

export const PlanWeekTiles = memo(PlanWeekTilesBase);
