import { memo, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronDown } from "lucide-react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { MobileZone } from "../ui/MobileZone";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

interface MovimientosLecturaProps {
  count: number;
  totalInflow: number;
  totalOutflow: number;
  /** Per-day aggregates from getMonthlyAggregates — already debt-filtered server-side. */
  daysByDate: { date: string; income: number; expense: number }[];
  currency: CurrencyCode;
  expanded: boolean;
  onToggle: () => void;
}

interface DayData {
  label: string;
  day: number;
  income: number;
  expense: number;
}

function expandDayBuckets(
  buckets: { date: string; income: number; expense: number }[]
): DayData[] {
  if (buckets.length === 0) return [];

  const dayMap = new Map<string, { income: number; expense: number }>();
  for (const b of buckets) {
    dayMap.set(b.date, { income: b.income, expense: b.expense });
  }

  const dates = Array.from(dayMap.keys()).sort();
  if (dates.length === 0) return [];

  const firstDate = new Date(`${dates[0]}T12:00:00`);
  const lastDate = new Date(`${dates[dates.length - 1]}T12:00:00`);
  const today = new Date();
  // Local-timezone YYYY-MM-DD — Colombia is UTC-5, so toISOString() would
  // return the UTC day and cause an off-by-one early-morning. See gotcha in
  // CLAUDE.md ("Never use new Date('YYYY-MM-DD')... midnight UTC").
  const todayStr = toLocalDateString(today);
  const endDate = lastDate > today ? lastDate : today;

  const result: DayData[] = [];
  const cursor = new Date(firstDate);
  while (cursor <= endDate) {
    const dateStr = toLocalDateString(cursor);
    const vals = dayMap.get(dateStr) ?? { income: 0, expense: 0 };
    const dayNum = cursor.getDate();
    const monthNum = cursor.getMonth() + 1;
    const isToday = dateStr === todayStr;
    result.push({
      label: isToday ? "Hoy" : `${dayNum}/${monthNum}`,
      day: dayNum,
      income: vals.income,
      expense: vals.expense,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function compactAmount(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
  return `$${amount}`;
}

const VB_W = 280;
const VB_H = 80;
const PAD_L = 42;
const PAD_R = 10;
const PAD_Y = 12;

function buildPoints(values: number[], maxVal: number): string {
  if (values.length === 0) return "";
  const usableW = VB_W - PAD_L - PAD_R;
  const step = values.length > 1 ? usableW / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = PAD_L + i * step;
      const y = PAD_Y + (1 - v / Math.max(maxVal, 1)) * (VB_H - PAD_Y * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function FlowChart({ days }: { days: DayData[] }) {
  if (days.length === 0) {
    return (
      <View className="mt-3 h-16 items-center justify-center rounded-xl border border-white-6 bg-black-10">
        <Text className="text-[11px] font-inter text-muted-foreground">Sin datos</Text>
      </View>
    );
  }

  const incomeVals = days.map((d) => d.income);
  const expenseVals = days.map((d) => d.expense);
  const maxVal = Math.max(...incomeVals, ...expenseVals, 1);

  const lastIdx = days.length - 1;
  const usableW = VB_W - PAD_L - PAD_R;
  const step = days.length > 1 ? usableW / (days.length - 1) : 0;
  const todayX = PAD_L + lastIdx * step;
  const todayY =
    PAD_Y + (1 - incomeVals[lastIdx] / Math.max(maxVal, 1)) * (VB_H - PAD_Y * 2);

  return (
    <View className="mt-3" style={{ gap: 8 }}>
      <Svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height={80}
        preserveAspectRatio="none"
      >
        {/* Income line */}
        <Polyline
          points={buildPoints(incomeVals, maxVal)}
          fill="none"
          stroke={COLORS.income}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Expense line (dashed) */}
        <Polyline
          points={buildPoints(expenseVals, maxVal)}
          fill="none"
          stroke={COLORS.brass}
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Today marker */}
        <Circle cx={todayX} cy={todayY} r={4} fill={COLORS.income} />
        <Circle cx={todayX} cy={todayY} r={7} fill={COLORS.income} opacity={0.12} />
        <Line
          x1={todayX}
          y1={4}
          x2={todayX}
          y2={VB_H - 4}
          stroke={COLORS.foreground}
          strokeOpacity={0.08}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {/* Y-axis labels */}
        <SvgText x={PAD_L - 4} y={14} textAnchor="end" fontSize={7} fill={COLORS.sageDark}>
          {compactAmount(maxVal)}
        </SvgText>
        <SvgText x={PAD_L - 4} y={VB_H / 2 + 2} textAnchor="end" fontSize={7} fill={COLORS.sageDark}>
          {compactAmount(maxVal / 2)}
        </SvgText>
        <SvgText x={PAD_L - 4} y={VB_H - 6} textAnchor="end" fontSize={7} fill={COLORS.sageDark}>
          $0
        </SvgText>
      </Svg>

      {/* Day labels — sparse */}
      <View className="flex-row justify-between px-1">
        {days.map((d, i) => {
          const showLabel =
            i === 0 ||
            i === lastIdx ||
            (days.length > 5 && i % Math.ceil(days.length / 4) === 0);
          if (!showLabel) {
            return <View key={`${d.label}-${i}`} style={{ width: 1 }} />;
          }
          const isToday = d.label === "Hoy";
          return (
            <Text
              key={`${d.label}-${i}`}
              className={`text-[8px] ${isToday ? "font-inter-semibold text-z-brass" : "font-inter-medium text-muted-foreground"}`}
            >
              {d.label}
            </Text>
          );
        })}
      </View>

      {/* Legend */}
      <View className="flex-row items-center justify-center gap-4">
        <View className="flex-row items-center gap-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-z-income" />
          <Text className="text-[9px] font-inter text-muted-foreground">Ingresos</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View
            className="h-[2px] w-3 rounded-full"
            style={{ backgroundColor: COLORS.brass, opacity: 0.9 }}
          />
          <Text className="text-[9px] font-inter text-muted-foreground">Gastos</Text>
        </View>
      </View>
    </View>
  );
}

function MovimientosLecturaBase({
  count,
  totalInflow,
  totalOutflow,
  daysByDate,
  currency,
  expanded,
  onToggle,
}: MovimientosLecturaProps) {
  // Expand SQL day buckets into contiguous per-day rows for the chart.
  // Data is already debt-filtered server-side in getMonthlyAggregates.
  // Per feedback_expand_animation_keep_content_mounted: always compute so the
  // close animation fades a populated chart rather than "Sin datos".
  const days = useMemo(() => expandDayBuckets(daysByDate), [daysByDate]);

  return (
    <MobileZone eyebrow="LECTURA">
      <Pressable
        onPress={onToggle}
        className={`${PANEL_INSET_CLASS} p-3 ${expanded ? "border-z-brass-30 bg-z-brass-6" : ""}`}
      >
        <Text className="mb-2 text-[13px] font-inter-semibold text-foreground">
          Resumen del mes
        </Text>

        <View className="flex-row gap-1">
          <View className="flex-1 items-center">
            <Text className="text-[9px] font-inter-semibold uppercase tracking-[1px] text-muted-foreground">
              Movimientos
            </Text>
            <Text className="mt-1 text-[18px] font-inter-bold leading-tight text-foreground">
              {count}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-[9px] font-inter-semibold uppercase tracking-[1px] text-muted-foreground">
              Ingresos
            </Text>
            <Text className="mt-1 text-[15px] font-inter-bold leading-tight text-z-income">
              {formatCurrency(totalInflow, currency)}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-[9px] font-inter-semibold uppercase tracking-[1px] text-muted-foreground">
              Gastos
            </Text>
            <Text className="mt-1 text-[15px] font-inter-bold leading-tight text-foreground">
              {formatCurrency(totalOutflow, currency)}
            </Text>
          </View>
        </View>

        <View className="mt-2 flex-row items-center justify-center gap-1">
          <Text className="text-[10px] font-inter-semibold uppercase tracking-[2px] text-z-sage-dark">
            {expanded ? "Ocultar" : "Ver flujo por día"}
          </Text>
          <ChevronDown
            size={12}
            color={COLORS.sageDark}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        </View>
      </Pressable>

      <AnimatedAccordion expanded={expanded} estimatedHeight={180}>
        <View className={`mt-1.5 ${PANEL_INSET_CLASS} border-z-brass-20 bg-black-20 p-3`}>
          <FlowChart days={days} />
        </View>
      </AnimatedAccordion>
    </MobileZone>
  );
}

export const MovimientosLectura = memo(MovimientosLecturaBase);
