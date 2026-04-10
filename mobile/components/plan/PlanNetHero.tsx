import { View, Text, Pressable } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { GradientCard } from "../ui/GradientCard";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";

interface PlanNetHeroProps {
  ingresos: number;
  gastos: number;
  currency: CurrencyCode;
  daysRemaining: number;
  expanded: boolean;
  onToggle: () => void;
}

export function PlanNetHero({
  ingresos,
  gastos,
  currency,
  daysRemaining,
  expanded,
  onToggle,
}: PlanNetHeroProps) {
  const net = ingresos - gastos;
  const isPositive = net >= 0;

  return (
    <Pressable onPress={onToggle}>
      <GradientCard>
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Balance del mes
        </Text>

        <View className="mt-2 flex-row items-baseline gap-1">
          <Text className={`text-[32px] font-inter-bold ${isPositive ? "text-z-income" : "text-z-expense"}`}>
            {isPositive ? "+" : ""}{formatCurrency(net, currency)}
          </Text>
        </View>

        <Text className="mt-1 text-xs font-inter text-muted-foreground">
          {daysRemaining} dias restantes
        </Text>

        {/* Expandable breakdown */}
        <AnimatedAccordion expanded={expanded} estimatedHeight={120}>
          <View className={`mt-3 ${PANEL_INSET_CLASS} border-white-8 bg-black-20 p-3 gap-2`}>
            <View className="flex-row justify-between">
              <Text className="text-[11px] font-inter text-muted-foreground">Ingresos</Text>
              <Text className="text-sm font-inter-semibold text-z-income">
                +{formatCurrency(ingresos, currency)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[11px] font-inter text-muted-foreground">Gastos</Text>
              <Text className="text-sm font-inter-semibold text-z-expense">
                -{formatCurrency(gastos, currency)}
              </Text>
            </View>
            <View className="border-t border-white-8 pt-1.5 flex-row justify-between">
              <Text className="text-[11px] font-inter-semibold text-foreground">Neto</Text>
              <Text className={`text-sm font-inter-semibold ${isPositive ? "text-z-income" : "text-z-expense"}`}>
                {isPositive ? "+" : ""}{formatCurrency(net, currency)}
              </Text>
            </View>
          </View>
        </AnimatedAccordion>
      </GradientCard>
    </Pressable>
  );
}
