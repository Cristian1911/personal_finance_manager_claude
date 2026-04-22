import { memo, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import type { OccurrenceWithTemplate } from "../../lib/repositories/recurring";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import {
  ChipDetailHeading,
  ChipEyebrow,
  ExpandableChip,
} from "../ui/ExpandableChip";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

interface PlanWeekTilesProps {
  incomes: OccurrenceWithTemplate[];
  payments: OccurrenceWithTemplate[];
  currency: CurrencyCode;
}

type ChipType = "income" | "payment";

/** Per-type styling + copy lookup — collapses all the `isPayment ? ...` ternaries. */
const CHIP_CONFIG = {
  income: {
    tone: "income" as const,
    label: "Próximo ingreso",
    emptyAction: "Mapear ingreso",
    emptyHint: "Sin ingresos recurrentes",
    expandedLabel: "Ingresos esperados",
    emptyMessage: "No tienes ingresos recurrentes configurados",
    accentText: "text-z-income",
    ctaBg: "bg-z-income-12",
    iconColor: COLORS.income,
    emptyItemLabel: "Ingreso",
  },
  payment: {
    tone: "debt" as const,
    label: "Próximo pago",
    emptyAction: "Mapear pago",
    emptyHint: "Sin pagos recurrentes",
    expandedLabel: "Pagos programados",
    emptyMessage: "No tienes pagos recurrentes configurados",
    accentText: "text-z-debt",
    ctaBg: "bg-z-debt-12",
    iconColor: COLORS.debt,
    emptyItemLabel: "Pago",
  },
} satisfies Record<ChipType, unknown>;

function PlanWeekTilesBase({ incomes, payments, currency }: PlanWeekTilesProps) {
  const router = useRouter();
  const [active, setActive] = useState<ChipType | null>(null);

  const items = { income: incomes, payment: payments } as const;
  const nextIncome = incomes[0] ?? null;
  const nextPayment = payments[0] ?? null;

  // Order: sooner date first. Tie-breaker: payment first (debt urgency).
  const orderedTypes = useMemo<readonly ChipType[]>(() => {
    const incomeDate = nextIncome?.occurrence_date ?? null;
    const paymentDate = nextPayment?.occurrence_date ?? null;
    const paymentSooner =
      (!incomeDate && !!paymentDate) ||
      (!!incomeDate && !!paymentDate && paymentDate <= incomeDate);
    return paymentSooner ? ["payment", "income"] : ["income", "payment"];
  }, [nextIncome, nextPayment]);

  const toggle = (type: ChipType) =>
    setActive((prev) => (prev === type ? null : type));

  const activeList = active !== null ? items[active] : null;
  const activeTotal = useMemo(
    () => activeList?.reduce((sum, item) => sum + item.expected_amount, 0) ?? 0,
    [activeList]
  );
  const activeConfig = active !== null ? CHIP_CONFIG[active] : null;

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {orderedTypes.map((type) => {
          const cfg = CHIP_CONFIG[type];
          const next = items[type][0] ?? null;
          const isActive = active === type;
          const isDimmed = active !== null && !isActive;

          return (
            <ExpandableChip
              key={type}
              tone={cfg.tone}
              active={isActive}
              dimmed={isDimmed}
              onPress={() => toggle(type)}
              accessibilityLabel={isActive ? `Ocultar ${cfg.label.toLowerCase()}` : `Ver ${cfg.label.toLowerCase()}`}
            >
              <ChipEyebrow tone={cfg.tone}>{cfg.label}</ChipEyebrow>
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
                    <Plus size={12} color={cfg.iconColor} />
                    <Text className={`text-xs font-inter-semibold ${cfg.accentText}`}>
                      {cfg.emptyAction}
                    </Text>
                  </View>
                  <Text className="mt-1 text-[10px] font-inter text-muted-foreground">
                    {cfg.emptyHint}
                  </Text>
                </>
              )}
            </ExpandableChip>
          );
        })}
      </View>

      <AnimatedAccordion expanded={active !== null} estimatedHeight={700}>
        {activeConfig && activeList && (
          <View className={`${PANEL_INSET_CLASS} p-3`}>
            <ChipDetailHeading tone={activeConfig.tone}>
              {activeConfig.expandedLabel}
            </ChipDetailHeading>
            {activeList.length > 0 ? (
              <>
                {activeList.map((item, i) => (
                  <View
                    key={`${item.id}-${i}`}
                    className={`flex-row items-center justify-between py-2 ${i < activeList.length - 1 ? "border-b border-white-6" : ""}`}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-inter-medium text-foreground" numberOfLines={1}>
                        {item.merchant_name ?? item.description ?? activeConfig.emptyItemLabel}
                      </Text>
                      <Text className="text-[10px] font-inter text-muted-foreground">
                        {formatDate(item.occurrence_date, "dd MMM yyyy")}
                      </Text>
                    </View>
                    <Text className={`text-sm font-inter-semibold tabular-nums ${activeConfig.accentText}`}>
                      {formatCurrency(item.expected_amount, currency)}
                    </Text>
                  </View>
                ))}
                <View className="mt-2 flex-row justify-between border-t border-white-6 pt-2">
                  <Text className="text-xs font-inter text-muted-foreground">Total</Text>
                  <Text className={`text-xs font-inter-bold tabular-nums ${activeConfig.accentText}`}>
                    {formatCurrency(activeTotal, currency)}
                  </Text>
                </View>
              </>
            ) : (
              <View className="items-center py-3">
                <Text className="text-xs font-inter text-muted-foreground mb-2">
                  {activeConfig.emptyMessage}
                </Text>
                <Pressable
                  onPress={() => router.push("/recurrentes" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Ir a recurrentes"
                  className={`flex-row items-center gap-1 rounded-lg px-3 py-1.5 ${activeConfig.ctaBg}`}
                >
                  <Plus size={14} color={activeConfig.iconColor} />
                  <Text className={`text-xs font-inter-semibold ${activeConfig.accentText}`}>
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
