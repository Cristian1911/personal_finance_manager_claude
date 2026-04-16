import React, { useMemo, useState, useCallback } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import Svg, { Rect, Line, Path, Text as SvgText, Circle } from "react-native-svg";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import type { TimelineData } from "../../lib/utils/timeline";
import { MobileZone } from "../ui/MobileZone";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

interface PlanFlowChartProps {
  timelineData: TimelineData;
  currency: CurrencyCode;
}

// Chart dimensions (viewBox coordinates)
const VB_W = 360;
const VB_H = 180;
const BASELINE_Y = 90;
const PAD_L = 32;
const PAD_R = 10;
const PAD_T = 15;
const USABLE_W = VB_W - PAD_L - PAD_R;

function dayX(day: number, daysInMonth: number): number {
  return PAD_L + ((day - 1) / Math.max(daysInMonth - 1, 1)) * USABLE_W;
}

export function PlanFlowChart({ timelineData, currency }: PlanFlowChartProps) {
  const { days, cumulativeBalance, totalIncome, totalExpense, daysInMonth, dayOfMonth } = timelineData;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(360);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  const chart = useMemo(() => {
    if (days.length === 0) return null;

    let maxVal = 1;
    for (const d of days) {
      maxVal = Math.max(maxVal, d.income, d.expense);
    }

    let maxAbsBalance = 1;
    for (const pt of cumulativeBalance) {
      maxAbsBalance = Math.max(maxAbsBalance, Math.abs(pt.balance));
    }

    const barW = Math.min(12, USABLE_W / (days.length * 2.5));
    const scaleUp = (BASELINE_Y - PAD_T) / maxVal;
    const scaleDown = (VB_H - BASELINE_Y - 30) / maxVal;
    const balanceRange = Math.min(BASELINE_Y - PAD_T, VB_H - BASELINE_Y - 30);
    const balanceScale = balanceRange / maxAbsBalance;

    // Balance polyline
    const pastPoints: string[] = [];
    const futurePoints: string[] = [];
    const balanceDots: Array<{ x: number; y: number; day: number; isPast: boolean }> = [];

    for (const pt of cumulativeBalance) {
      const x = dayX(pt.day, daysInMonth);
      const y = BASELINE_Y - pt.balance * balanceScale;
      const isPast = pt.day <= dayOfMonth;
      if (isPast) pastPoints.push(`${pastPoints.length === 0 ? "M" : "L"}${x},${y}`);
      else futurePoints.push(`${futurePoints.length === 0 ? "M" : "L"}${x},${y}`);
      balanceDots.push({ x, y, day: pt.day, isPast });
    }

    // Bridge past → future
    if (pastPoints.length > 0 && futurePoints.length > 0) {
      const lastPast = cumulativeBalance.filter((p) => p.day <= dayOfMonth).slice(-1)[0];
      if (lastPast) {
        const x = dayX(lastPast.day, daysInMonth);
        const y = BASELINE_Y - lastPast.balance * balanceScale;
        futurePoints.unshift(`M${x},${y}`);
      }
    }

    // Day labels
    const todayX = dayX(dayOfMonth, daysInMonth);
    const dayLabels: Array<{ day: number; x: number }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (d === 1 || d === daysInMonth || d % 5 === 0) {
        const dx = dayX(d, daysInMonth);
        if (Math.abs(dx - todayX) > 12 && d !== dayOfMonth) {
          dayLabels.push({ day: d, x: dx });
        }
      }
    }

    return { barW, scaleUp, scaleDown, pastPath: pastPoints.join(" "), futurePath: futurePoints.join(" "), todayX, dayLabels, maxVal, balanceDots };
  }, [days, cumulativeBalance, daysInMonth, dayOfMonth]);

  // O(1) algebraic inversion of dayX
  const findClosestDay = useCallback((touchX: number) => {
    const svgX = (touchX * VB_W) / chartWidth;
    const rawDay = Math.round(((svgX - PAD_L) / USABLE_W) * (daysInMonth - 1)) + 1;
    return Math.max(1, Math.min(daysInMonth, rawDay));
  }, [chartWidth, daysInMonth]);

  // Touch gesture to select a day
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      setSelectedDay(findClosestDay(e.x));
    })
    .onEnd(() => setSelectedDay(null))
    .minDistance(0);

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const day = findClosestDay(e.x);
      setSelectedDay((prev) => (prev === day ? null : day));
    });

  const gesture = Gesture.Exclusive(panGesture, tapGesture);

  // Selected day tooltip data
  const selectedData = useMemo(() => {
    if (selectedDay === null) return null;
    const dayEntry = days.find((d) => d.day === selectedDay);
    const balancePt = cumulativeBalance.find((p) => p.day === selectedDay);
    return {
      day: selectedDay,
      income: dayEntry?.income ?? 0,
      expense: dayEntry?.expense ?? 0,
      balance: balancePt?.balance ?? 0,
    };
  }, [selectedDay, days, cumulativeBalance]);

  const net = totalIncome - totalExpense;

  if (!chart || days.length === 0) {
    return (
      <MobileZone eyebrow="FLUJO DEL MES">
        <View className={`${PANEL_INSET_CLASS} py-8 items-center`}>
          <Text className="text-xs font-inter text-muted-foreground">
            Sin pagos o ingresos en este mes
          </Text>
        </View>
      </MobileZone>
    );
  }

  return (
    <MobileZone eyebrow="FLUJO DEL MES">
      <View className={`${PANEL_INSET_CLASS} p-3`}>
        {/* Touch tooltip */}
        {selectedData && (
          <View className="flex-row justify-between mb-2 px-1">
            <Text className="text-[10px] font-inter-semibold text-z-brass">
              Dia {selectedData.day}
            </Text>
            <View className="flex-row gap-3">
              {selectedData.income > 0 && (
                <Text className="text-[10px] font-inter-semibold text-z-income">
                  +{formatCurrency(selectedData.income, currency)}
                </Text>
              )}
              {selectedData.expense > 0 && (
                <Text className="text-[10px] font-inter-semibold text-z-debt">
                  -{formatCurrency(selectedData.expense, currency)}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* SVG Chart */}
        <GestureHandlerRootView>
        <GestureDetector gesture={gesture}>
          <View onLayout={onLayout}>
            <Svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: "100%", height: 180 }}>
              {/* Zero line */}
              <Line x1={PAD_L} y1={BASELINE_Y} x2={VB_W - PAD_R} y2={BASELINE_Y} stroke={COLORS.brass} strokeWidth={1.5} strokeOpacity={0.4} />
              <SvgText x={PAD_L - 4} y={BASELINE_Y + 3} fill={COLORS.brass} fontSize={7} textAnchor="end" fontWeight="500">$0</SvgText>

              {/* Y-axis max */}
              <SvgText x={PAD_L - 4} y={PAD_T + 4} fill={COLORS.sageDark} fontSize={7} textAnchor="end">
                {formatCurrency(chart.maxVal, currency)}
              </SvgText>

              {/* Today marker */}
              <Line x1={chart.todayX} y1={PAD_T - 2} x2={chart.todayX} y2={VB_H - 18} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4,3" />
              <SvgText x={chart.todayX} y={VB_H - 8} fill={COLORS.sageLight} fontSize={7} fontWeight="600" textAnchor="middle">Hoy</SvgText>

              {/* Selected day marker */}
              {selectedDay !== null && (
                <Line
                  x1={dayX(selectedDay, daysInMonth)}
                  y1={PAD_T - 2}
                  x2={dayX(selectedDay, daysInMonth)}
                  y2={VB_H - 18}
                  stroke={COLORS.brass}
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
              )}

              {/* Bars */}
              {days.map((d) => {
                const x = dayX(d.day, daysInMonth);
                const isPast = d.isReal || d.day <= dayOfMonth;
                const isSelected = d.day === selectedDay;
                return (
                  <React.Fragment key={d.day}>
                    {d.income > 0 && (
                      <Rect
                        x={x - chart.barW / 2}
                        y={BASELINE_Y - d.income * chart.scaleUp}
                        width={chart.barW}
                        height={d.income * chart.scaleUp}
                        rx={3}
                        fill={COLORS.income}
                        opacity={isSelected ? 1 : isPast ? 0.95 : 0.6}
                      />
                    )}
                    {d.expense > 0 && (
                      <Rect
                        x={x - chart.barW / 2}
                        y={BASELINE_Y}
                        width={chart.barW}
                        height={d.expense * chart.scaleDown}
                        rx={3}
                        fill={COLORS.debt}
                        opacity={isSelected ? 1 : isPast ? 0.9 : 0.6}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Balance polyline — past (solid) */}
              {chart.pastPath && (
                <Path d={chart.pastPath} fill="none" stroke={COLORS.brass} strokeWidth={2} opacity={0.9} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {/* Balance polyline — future (dashed) */}
              {chart.futurePath && (
                <Path d={chart.futurePath} fill="none" stroke={COLORS.brass} strokeWidth={2} opacity={0.7} strokeDasharray="4,3" strokeLinecap="round" strokeLinejoin="round" />
              )}

              {/* Balance dots */}
              {chart.balanceDots.map((dot) => (
                <Circle key={dot.day} cx={dot.x} cy={dot.y} r={dot.day === selectedDay ? 4.5 : 3} fill={dot.isPast ? COLORS.income : COLORS.brass} opacity={dot.day === selectedDay ? 1 : 0.8} />
              ))}

              {/* Day labels */}
              {chart.dayLabels.map((lbl) => (
                <SvgText key={lbl.day} x={lbl.x} y={VB_H - 8} fill={COLORS.sageDark} fontSize={7} textAnchor="middle">{lbl.day}</SvgText>
              ))}
            </Svg>
          </View>
        </GestureDetector>
        </GestureHandlerRootView>

        {/* Summary row */}
        <View className="mt-2 flex-row items-center">
          <View className="flex-1 items-center">
            <Text className="text-[9px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">Ingresos</Text>
            <Text className="mt-0.5 text-[13px] font-inter-semibold text-z-income">{formatCurrency(totalIncome, currency)}</Text>
          </View>
          <View className="h-5 w-px bg-white-6" />
          <View className="flex-1 items-center">
            <Text className="text-[9px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">Gastos</Text>
            <Text className="mt-0.5 text-[13px] font-inter-semibold text-z-debt">{formatCurrency(totalExpense, currency)}</Text>
          </View>
          <View className="h-5 w-px bg-white-6" />
          <View className="flex-1 items-center">
            <Text className="text-[9px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">Neto</Text>
            <Text className={`mt-0.5 text-[13px] font-inter-semibold ${net >= 0 ? "text-z-brass" : "text-z-debt"}`}>{formatCurrency(net, currency)}</Text>
          </View>
        </View>
      </View>
    </MobileZone>
  );
}
