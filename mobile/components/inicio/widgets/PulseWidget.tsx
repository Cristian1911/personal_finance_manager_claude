import { View, Text, Pressable } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { ChevronDown } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import {
  PANEL_INSET_CLASS,
  PANEL_SURFACE_SUBTLE_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../../../lib/constants/styles";
import { COLORS } from "../../../lib/constants/colors";
import type { PulseRange } from "../../../lib/dashboard/widgets";
import { AnimatedAccordion } from "../../ui/AnimatedAccordion";

interface PulseWidgetProps {
  availablePerDay: number;
  daysRemaining: number;
  currency: CurrencyCode;
  onTrack: boolean;
  range: PulseRange;
  onRangeChange: (next: PulseRange) => void;
  trend: number[];
  /** Optional breakdown data — if provided, the card becomes expandable. */
  breakdown?: {
    liquidBalance: number;
    pendingObligations: number;
    alreadySpent: number;
    availableTotal: number;
    windowEndLabel: string;
  };
  primaryAccount?: {
    name: string;
    currentBalance: number;
    currencyCode: CurrencyCode;
  } | null;
  nextIncome?: {
    name: string;
    amount: number;
    date: string;
  } | null;
  expanded?: boolean;
  onToggle?: () => void;
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
  breakdown,
  primaryAccount,
  nextIncome,
  expanded = false,
  onToggle,
}: PulseWidgetProps) {
  const subtitleLabel = range === "weekly" ? "esta semana" : "este mes";
  const canExpand = typeof onToggle === "function" && breakdown != null;

  const card = (
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
          <View
            className={`h-1.5 w-1.5 rounded-full ${onTrack ? "bg-z-income" : "bg-z-alert"}`}
          />
          <Text
            className={`text-[11px] font-inter ${onTrack ? "text-z-income" : "text-z-alert"}`}
          >
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

      <View className="mt-3 flex-row items-center justify-between gap-2">
        <View className="flex-row gap-1.5">
          <RangeChip
            active={range === "weekly"}
            onPress={() => onRangeChange("weekly")}
          >
            Semana
          </RangeChip>
          <RangeChip
            active={range === "monthly"}
            onPress={() => onRangeChange("monthly")}
          >
            Mes
          </RangeChip>
        </View>
        {canExpand && (
          <View className="flex-row items-center gap-1">
            <Text className={SECTION_EYEBROW_CLASS}>
              {expanded ? "Ocultar" : "Ver cálculo"}
            </Text>
            <ChevronDown
              size={12}
              color={COLORS.sageDark}
              style={{
                transform: [{ rotate: expanded ? "180deg" : "0deg" }],
              }}
            />
          </View>
        )}
      </View>

      {canExpand && breakdown && (
        <AnimatedAccordion expanded={expanded} estimatedHeight={320}>
          <View className="mt-3 gap-2">
            <View className={`${PANEL_INSET_CLASS} p-3 gap-2`}>
              <Text className={SECTION_EYEBROW_CLASS}>Cómo se calcula</Text>
              <Row label="Saldo líquido" value={formatCurrency(breakdown.liquidBalance, currency)} />
              <Row
                label="– Obligaciones pendientes"
                value={`−${formatCurrency(breakdown.pendingObligations, currency)}`}
                tone="debt"
              />
              <View className="mt-1 h-px bg-white-6" />
              <Row
                label="= Disponible"
                value={formatCurrency(breakdown.availableTotal, currency)}
                bold
              />
              <Text className="text-[10px] font-inter text-muted-foreground">
                ÷ {daysRemaining} días ({breakdown.windowEndLabel}) ={" "}
                {formatCurrency(availablePerDay, currency)}/día
              </Text>
              <View className="mt-1 h-px bg-white-6" />
              <Row
                label="Ya gastado este mes"
                value={formatCurrency(breakdown.alreadySpent, currency)}
              />
              <Text className="text-[10px] font-inter text-muted-foreground">
                Ya descontado del saldo líquido — informativo
              </Text>

              {nextIncome && (
                <>
                  <View className="mt-1 h-px bg-white-6" />
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 text-[11px] font-inter-semibold text-z-income">
                      Próximo ingreso: {nextIncome.name}
                    </Text>
                    <Text className="text-[11px] font-inter-semibold text-z-income tabular-nums">
                      +{formatCurrency(nextIncome.amount, currency)}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {primaryAccount && (
              <View className={`${PANEL_INSET_CLASS} p-3 flex-row items-center justify-between`}>
                <View className="min-w-0 flex-1">
                  <Text className={SECTION_EYEBROW_CLASS}>Cuenta principal</Text>
                  <Text
                    numberOfLines={1}
                    className="mt-0.5 text-[12px] font-inter text-foreground"
                  >
                    {primaryAccount.name}
                  </Text>
                </View>
                <Text className="text-[18px] font-inter-bold tabular-nums text-foreground">
                  {formatCurrency(
                    primaryAccount.currentBalance,
                    primaryAccount.currencyCode
                  )}
                </Text>
              </View>
            )}
          </View>
        </AnimatedAccordion>
      )}
    </View>
  );

  if (!canExpand) return card;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={expanded ? "Ocultar cálculo" : "Ver cálculo"}
    >
      {card}
    </Pressable>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "debt";
  bold?: boolean;
}) {
  const valueColor =
    tone === "debt" ? "text-z-debt" : "text-foreground";
  const weight = bold ? "font-inter-bold" : "font-inter";
  return (
    <View className="flex-row items-baseline justify-between gap-2">
      <Text
        className={`text-[11px] font-inter ${bold ? "text-foreground font-inter-semibold" : "text-muted-foreground"}`}
      >
        {label}
      </Text>
      <Text className={`text-[12px] ${weight} ${valueColor} tabular-nums`}>
        {value}
      </Text>
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
