import { View, Text, Pressable } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { RingChart } from "../ui/RingChart";

interface InicioMetricsGridProps {
  daysInMonth: number;
  dayOfMonth: number;
  spentToday: number;
  spentYesterday: number;
  avgLast7: number;
  currency: CurrencyCode;
  expanded: string | null;
  onToggle: (id: string) => void;
}

function compact(amount: number, currency: CurrencyCode): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
  return formatCurrency(amount, currency);
}

export function InicioMetricsGrid({
  daysInMonth,
  dayOfMonth,
  spentToday,
  spentYesterday,
  avgLast7,
  currency,
  expanded,
  onToggle,
}: InicioMetricsGridProps) {
  const percentage = Math.round((dayOfMonth / daysInMonth) * 100);
  const isGastoActive = expanded === "gasto-hoy";

  return (
    <View>
      {/* Two-column chip row */}
      <View className="flex-row gap-1.5">
        {/* Ritmo chip */}
        <View className={`${PANEL_INSET_CLASS} flex-1 items-center justify-center px-3 py-3`}>
          <Text className="mb-1.5 text-[9px] font-inter-bold uppercase tracking-[4px] text-z-sage-dark">
            Ritmo
          </Text>
          <RingChart percentage={percentage} size={48} />
          <Text className="mt-1.5 text-[11px] font-inter text-muted-foreground">
            dia {dayOfMonth} de {daysInMonth}
          </Text>
        </View>

        {/* Gasto hoy chip */}
        <Pressable
          onPress={() => onToggle("gasto-hoy")}
          className={`${PANEL_INSET_CLASS} flex-1 items-center justify-center px-3 py-3 ${isGastoActive ? "border-z-brass-30" : ""}`}
        >
          <Text className="mb-1.5 text-[9px] font-inter-bold uppercase tracking-[4px] text-z-sage-dark">
            Gasto hoy
          </Text>
          <Text className={`text-[18px] font-inter-bold ${spentToday === 0 ? "text-z-sage-light" : "text-foreground"}`}>
            {compact(spentToday, currency)}
          </Text>
          <Text className="mt-1 text-[11px] font-inter text-muted-foreground">
            {spentToday === 0 ? "Sin gastos" : "gastado hoy"}
          </Text>
        </Pressable>
      </View>

      {/* Expanded panel for gasto hoy */}
      <AnimatedAccordion expanded={isGastoActive} estimatedHeight={200}>
        <View className={`mt-1.5 ${PANEL_INSET_CLASS} border-z-brass-20 bg-black-20 p-3 gap-2`}>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-[11px] font-inter text-muted-foreground">Hoy</Text>
            <Text className="text-sm font-inter-semibold text-foreground">
              {formatCurrency(spentToday, currency)}
            </Text>
          </View>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-[11px] font-inter text-muted-foreground">Ayer</Text>
            <Text className="text-sm font-inter-semibold text-muted-foreground">
              {formatCurrency(spentYesterday, currency)}
            </Text>
          </View>
          {avgLast7 > 0 && (
            <View className="flex-row items-baseline justify-between">
              <Text className="text-[11px] font-inter text-muted-foreground">Promedio 7 dias</Text>
              <Text className="text-sm font-inter-semibold text-muted-foreground">
                {formatCurrency(Math.round(avgLast7), currency)}
              </Text>
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}
