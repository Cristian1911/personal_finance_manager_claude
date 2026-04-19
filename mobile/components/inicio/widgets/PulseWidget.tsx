import { View, Text, Pressable } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import {
  PANEL_SURFACE_SUBTLE_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../../../lib/constants/styles";
import { COLORS } from "../../../lib/constants/colors";
import type { PulseRange } from "../../../lib/dashboard/widgets";

interface PulseWidgetProps {
  availablePerDay: number;
  daysRemaining: number;
  currency: CurrencyCode;
  onTrack: boolean;
  range: PulseRange;
  onRangeChange: (next: PulseRange) => void;
  trend: number[];
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <View style={{ height: 32, width: 96 }} />;
  }
  const max = Math.max(1, ...values);
  const width = 96;
  const height = 32;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((v, i) => `${i * step},${height - (v / max) * height}`)
    .join(" ");
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={COLORS.brass}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PulseWidget({
  availablePerDay,
  daysRemaining,
  currency,
  onTrack,
  range,
  onRangeChange,
  trend,
}: PulseWidgetProps) {
  const subtitleLabel = range === "weekly" ? "esta semana" : "este mes";

  return (
    <View
      className={`${PANEL_SURFACE_SUBTLE_CLASS} p-4`}
      style={{
        shadowColor: COLORS.oliveDeep,
        shadowOffset: { width: -20, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 40,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className={SECTION_EYEBROW_CLASS}>Ritmo</Text>
        <View className="flex-row items-center gap-1.5">
          <View className={`h-1.5 w-1.5 rounded-full ${onTrack ? "bg-z-income" : "bg-z-alert"}`} />
          <Text className={`text-[11px] font-inter ${onTrack ? "text-z-income" : "text-z-alert"}`}>
            {onTrack ? "en camino" : "fuera de ritmo"}
          </Text>
        </View>
      </View>

      <View className="mt-2 flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-shrink">
          <View className="flex-row items-baseline gap-0.5">
            <Text className="text-[32px] font-inter-bold tabular-nums text-foreground">
              {formatCurrency(availablePerDay, currency)}
            </Text>
            <Text className="text-sm font-inter-medium text-muted-foreground">
              /día
            </Text>
          </View>
          <Text className="mt-1 text-[11px] font-inter text-muted-foreground">
            {daysRemaining} días · {subtitleLabel}
          </Text>
        </View>
        <Sparkline values={trend} />
      </View>

      <View className="mt-3 flex-row gap-1.5">
        <RangeChip active={range === "weekly"} onPress={() => onRangeChange("weekly")}>
          Semana
        </RangeChip>
        <RangeChip active={range === "monthly"} onPress={() => onRangeChange("monthly")}>
          Mes
        </RangeChip>
      </View>
    </View>
  );
}

function RangeChip({
  children,
  active,
  onPress,
}: {
  children: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-full border px-2.5 py-1 ${
        active
          ? "border-z-brass-30 bg-z-brass-10"
          : "border-white-6 bg-black-10"
      }`}
    >
      <Text
        className={`text-[10px] font-inter-semibold uppercase tracking-[4px] ${
          active ? "text-z-brass" : "text-z-sage-dark"
        }`}
      >
        {children}
      </Text>
    </Pressable>
  );
}
