import { View, Text, Pressable } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { GradientCard } from "../ui/GradientCard";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";

interface InicioHeroProps {
  availablePerDay: number;
  availableTotal: number;
  daysRemaining: number;
  currency: CurrencyCode;
  breakdown?: {
    totalLiquid: number;
    fixedExpenses: number;
    alreadySpent: number;
  };
  expanded: boolean;
  onToggle: () => void;
}

export function InicioHero({
  availablePerDay,
  availableTotal,
  daysRemaining,
  currency,
  breakdown,
  expanded,
  onToggle,
}: InicioHeroProps) {
  return (
    <Pressable onPress={onToggle} accessibilityLabel="Expandir desglose del disponible diario">
      <GradientCard>
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Disponible para gastar
        </Text>

        <View className="mt-2 flex-row items-baseline gap-0.5">
          <Text className="text-[36px] font-inter-bold text-foreground">
            {formatCurrency(availablePerDay, currency)}
          </Text>
          <Text className="text-sm font-inter-medium text-muted-foreground">
            /dia
          </Text>
        </View>

        <Text className="mt-2 text-xs font-inter text-muted-foreground">
          = {formatCurrency(availableTotal, currency)} este mes · {daysRemaining} dias restantes
        </Text>

        {/* Expandable math breakdown */}
        <AnimatedAccordion expanded={expanded} estimatedHeight={200}>
          <View className="mt-3">
            {breakdown && (
              <View className={`${PANEL_INSET_CLASS} border-white-8 bg-black-20 p-3 gap-1.5`}>
                <Text className="text-[10px] font-inter-bold uppercase tracking-[3px] text-z-brass">
                  Como se calcula
                </Text>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-inter text-z-sage-light">
                    Ingresos del mes
                  </Text>
                  <Text className="text-xs font-inter text-z-sage-light">
                    {formatCurrency(breakdown.totalLiquid, currency)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-inter text-z-sage-light">
                    - Gastos fijos pendientes
                  </Text>
                  <Text className="text-xs font-inter text-z-expense">
                    -{formatCurrency(breakdown.fixedExpenses, currency)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-inter text-z-sage-light">
                    - Ya gastado
                  </Text>
                  <Text className="text-xs font-inter text-z-expense">
                    -{formatCurrency(breakdown.alreadySpent, currency)}
                  </Text>
                </View>
                <View className="border-t border-white-8 pt-1.5 flex-row justify-between">
                  <Text className="text-xs font-inter-semibold text-foreground">
                    = Disponible
                  </Text>
                  <Text className="text-xs font-inter-semibold text-foreground">
                    {formatCurrency(availableTotal, currency)}
                  </Text>
                </View>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  / {daysRemaining} dias = {formatCurrency(availablePerDay, currency)}/dia
                </Text>
              </View>
            )}
          </View>
        </AnimatedAccordion>
      </GradientCard>
    </Pressable>
  );
}
