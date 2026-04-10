import { View, Text, Pressable } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { MobileZone } from "../ui/MobileZone";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";

interface MovimientosLecturaProps {
  count: number;
  totalInflow: number;
  totalOutflow: number;
  currency: CurrencyCode;
  expanded: boolean;
  onToggle: () => void;
}

export function MovimientosLectura({
  count,
  totalInflow,
  totalOutflow,
  currency,
  expanded,
  onToggle,
}: MovimientosLecturaProps) {
  const net = totalInflow - totalOutflow;

  return (
    <MobileZone eyebrow="LECTURA">
      <Pressable
        onPress={onToggle}
        className={`${PANEL_INSET_CLASS} p-3 ${expanded ? "border-z-brass-30" : ""}`}
      >
        {/* Summary row */}
        <View className="flex-row items-baseline justify-between">
          <Text className="text-xs font-inter text-muted-foreground">
            {count} movimientos
          </Text>
          <Text className={`text-sm font-inter-semibold ${net >= 0 ? "text-z-income" : "text-z-expense"}`}>
            {net >= 0 ? "+" : ""}{formatCurrency(net, currency)}
          </Text>
        </View>

        {/* Inflow / Outflow mini row */}
        <View className="mt-2 flex-row gap-4">
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-z-income" />
            <Text className="text-[11px] font-inter text-muted-foreground">
              +{formatCurrency(totalInflow, currency)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-z-expense" />
            <Text className="text-[11px] font-inter text-muted-foreground">
              -{formatCurrency(totalOutflow, currency)}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Expanded detail */}
      <AnimatedAccordion expanded={expanded} estimatedHeight={150}>
        <View className={`mt-1.5 ${PANEL_INSET_CLASS} border-z-brass-20 bg-black-20 p-3 gap-2`}>
          <View className="flex-row justify-between">
            <Text className="text-[11px] font-inter text-muted-foreground">Ingresos</Text>
            <Text className="text-sm font-inter-semibold text-z-income">
              {formatCurrency(totalInflow, currency)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[11px] font-inter text-muted-foreground">Gastos</Text>
            <Text className="text-sm font-inter-semibold text-z-expense">
              {formatCurrency(totalOutflow, currency)}
            </Text>
          </View>
          <View className="border-t border-white-8 pt-1.5 flex-row justify-between">
            <Text className="text-[11px] font-inter-semibold text-foreground">Balance</Text>
            <Text className={`text-sm font-inter-semibold ${net >= 0 ? "text-z-income" : "text-z-expense"}`}>
              {net >= 0 ? "+" : ""}{formatCurrency(net, currency)}
            </Text>
          </View>
        </View>
      </AnimatedAccordion>
    </MobileZone>
  );
}
