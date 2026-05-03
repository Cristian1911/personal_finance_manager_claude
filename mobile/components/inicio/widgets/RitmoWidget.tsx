import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { RingChart } from "../../ui/RingChart";
import { ChipEyebrow } from "../../ui/ExpandableChip";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import type { WidgetRender } from "../WidgetGrid";

interface RitmoWidgetProps {
  dayOfMonth: number;
  daysInMonth: number;
  dailyAverage: number | null;
  currency: CurrencyCode;
}

export function renderRitmoWidget(props: RitmoWidgetProps): WidgetRender {
  const { dayOfMonth, daysInMonth, dailyAverage, currency } = props;
  const percentage = Math.round((dayOfMonth / daysInMonth) * 100);

  return {
    tone: "brass",
    accessibilityLabel: `Ritmo: día ${dayOfMonth} de ${daysInMonth}`,
    chip: (
      <View className="flex-1 items-center justify-center gap-1">
        <ChipEyebrow tone="foreground">Ritmo</ChipEyebrow>
        <RingChart percentage={percentage} size={52} />
        <Text
          numberOfLines={1}
          className="text-[10px] font-inter text-muted-foreground"
        >
          día {dayOfMonth} de {daysInMonth}
        </Text>
      </View>
    ),
    detail: () => <RitmoDetail dailyAverage={dailyAverage} currency={currency} />,
    estimatedHeight: 120,
  };
}

function RitmoDetail({
  dailyAverage,
  currency,
}: {
  dailyAverage: number | null;
  currency: CurrencyCode;
}) {
  const router = useRouter();
  return (
    <View className={`${PANEL_INSET_CLASS} p-3 gap-2`}>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[11px] font-inter text-muted-foreground">
          Promedio diario
        </Text>
        <Text className="text-[11px] font-inter-semibold text-foreground">
          {dailyAverage !== null
            ? `${formatCurrency(dailyAverage, currency)}/día`
            : "—"}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/plan")}
        className="rounded-xl border border-z-brass-20 bg-z-brass-8 px-3 py-2"
      >
        <Text className="text-center text-[11px] font-inter-semibold text-z-brass">
          Ver plan completo
        </Text>
      </Pressable>
    </View>
  );
}
