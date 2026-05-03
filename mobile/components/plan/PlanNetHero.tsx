import { memo, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Path, Line, Circle } from "react-native-svg";
import { Check, ChevronDown, ChevronUp, Clock } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { GradientCard } from "../ui/GradientCard";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { ChipDetailHeading } from "../ui/ExpandableChip";
import { SECTION_EYEBROW_CLASS, PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";
import type { TimelineData } from "../../lib/utils/timeline";

export interface PlanExecution {
  plannedIncome: number;
  confirmedIncome: number;
  pendingIncome: number;
  plannedExpenses: number;
  paidExpenses: number;
  pendingExpenses: number;
  discretionarySpent: number;
  disponible: number;
  daysRemaining: number;
  perDay: number;
}

interface PlanNetHeroProps {
  plan: PlanExecution;
  timeline: TimelineData | null;
  currency: CurrencyCode;
  expanded: boolean;
  onToggle: () => void;
}

// Mini chart geometry (balance-only, non-interactive)
const CHART_VB_W = 320;
const CHART_VB_H = 54;
const CHART_PAD_L = 4;
const CHART_PAD_R = 4;
const CHART_PAD_T = 4;
const CHART_PAD_B = 4;

function PlanNetHeroBase({
  plan,
  timeline,
  currency,
  expanded,
  onToggle,
}: PlanNetHeroProps) {
  const {
    plannedIncome, confirmedIncome, pendingIncome,
    plannedExpenses, paidExpenses, pendingExpenses,
    discretionarySpent, disponible, daysRemaining, perDay,
  } = plan;

  const isPositive = disponible >= 0;
  const incomePct = plannedIncome > 0 ? Math.min(100, (confirmedIncome / plannedIncome) * 100) : 0;
  const expensePct = plannedExpenses > 0 ? Math.min(100, (paidExpenses / plannedExpenses) * 100) : 0;

  const chart = useMemo(() => {
    if (!timeline || timeline.cumulativeBalance.length === 0) return null;
    const { cumulativeBalance, daysInMonth, dayOfMonth } = timeline;

    const usableW = CHART_VB_W - CHART_PAD_L - CHART_PAD_R;
    const usableH = CHART_VB_H - CHART_PAD_T - CHART_PAD_B;

    let maxBal = 1;
    let minBal = 0;
    for (const pt of cumulativeBalance) {
      if (pt.balance > maxBal) maxBal = pt.balance;
      if (pt.balance < minBal) minBal = pt.balance;
    }
    const range = maxBal - minBal || 1;

    const toX = (d: number) => CHART_PAD_L + ((d - 1) / Math.max(daysInMonth - 1, 1)) * usableW;
    const toY = (b: number) => CHART_PAD_T + (1 - (b - minBal) / range) * usableH;

    const todayX = toX(dayOfMonth);
    const pastPath: string[] = [];
    const futurePath: string[] = [];
    let lastPastPt: { x: number; y: number } | null = null;

    for (const pt of cumulativeBalance) {
      const x = toX(pt.day);
      const y = toY(pt.balance);
      if (pt.day <= dayOfMonth) {
        pastPath.push(`${pastPath.length === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
        lastPastPt = { x, y };
      } else {
        if (futurePath.length === 0 && lastPastPt) {
          futurePath.push(`M${lastPastPt.x.toFixed(1)},${lastPastPt.y.toFixed(1)}`);
        }
        futurePath.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
      }
    }

    const todayPt = cumulativeBalance.find((p) => p.day === dayOfMonth) ?? cumulativeBalance[cumulativeBalance.length - 1];
    const todayY = toY(todayPt.balance);

    return {
      pastPath: pastPath.join(" "),
      futurePath: futurePath.join(" "),
      todayX,
      todayY,
      zeroY: minBal < 0 ? toY(0) : null,
    };
  }, [timeline]);

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={expanded ? "Ocultar desglose del plan" : "Ver desglose del plan"}
    >
      <GradientCard>
        <View className="flex-row items-center justify-between">
          <Text className={SECTION_EYEBROW_CLASS}>
            Disponible este mes
          </Text>
          {daysRemaining > 0 && (
            <Text className="text-xs font-inter text-muted-foreground">
              {daysRemaining}d
            </Text>
          )}
        </View>

        {/* Headline: disponible */}
        <Text className={`mt-2 text-[32px] font-inter-bold tabular-nums ${isPositive ? "text-z-income" : "text-z-expense"}`}>
          {formatCurrency(disponible, currency)}
        </Text>
        {daysRemaining > 0 && (
          <Text className="text-xs font-inter text-muted-foreground">
            · {formatCurrency(perDay, currency)}/día restante
          </Text>
        )}

        {/* Burn bar — fijos paid / libre gastado */}
        <View className="mt-3 h-2 flex-row overflow-hidden rounded-full bg-z-surface-2-6">
          <View className="bg-z-alert" style={{ width: `${plannedExpenses > 0 ? Math.min((paidExpenses / (confirmedIncome || 1)) * 100, 100) : 0}%` }} />
          <View className="bg-z-debt" style={{ width: `${Math.min((discretionarySpent / (confirmedIncome || 1)) * 100, 100 - (paidExpenses / (confirmedIncome || 1)) * 100)}%` }} />
        </View>
        <View className="mt-1.5 flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-z-alert" />
            <Text className="text-[9px] font-inter text-muted-foreground">Fijos pagados</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-z-debt" />
            <Text className="text-[9px] font-inter text-muted-foreground">Gasto libre</Text>
          </View>
        </View>

        {/* Inline mini chart — always visible */}
        {chart && (
          <View className="mt-3">
            <Svg viewBox={`0 0 ${CHART_VB_W} ${CHART_VB_H}`} style={{ width: "100%", height: CHART_VB_H }}>
              {chart.zeroY !== null && (
                <Line x1={CHART_PAD_L} y1={chart.zeroY} x2={CHART_VB_W - CHART_PAD_R} y2={chart.zeroY} stroke="rgba(234,229,218,0.12)" strokeWidth={0.8} strokeDasharray="2,2" />
              )}
              <Line x1={chart.todayX} y1={CHART_PAD_T} x2={chart.todayX} y2={CHART_VB_H - CHART_PAD_B} stroke="rgba(234,229,218,0.15)" strokeWidth={0.8} strokeDasharray="2,2" />
              {chart.pastPath !== "" && (
                <Path d={chart.pastPath} fill="none" stroke={COLORS.brass} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {chart.futurePath !== "" && (
                <Path d={chart.futurePath} fill="none" stroke={COLORS.brass} strokeWidth={1.8} strokeOpacity={0.55} strokeDasharray="3,2" strokeLinecap="round" strokeLinejoin="round" />
              )}
              <Circle cx={chart.todayX} cy={chart.todayY} r={2.5} fill={COLORS.brass} />
            </Svg>
          </View>
        )}

        {/* Expand CTA */}
        <View className="mt-2 flex-row items-center justify-center gap-1">
          <Text className="text-[10px] font-inter text-muted-fg-50">
            {expanded ? "Ocultar desglose" : "Ver desglose del plan"}
          </Text>
          {expanded ? <ChevronUp size={11} color={COLORS.sageDark} /> : <ChevronDown size={11} color={COLORS.sageDark} />}
        </View>

        {/* Expandable math breakdown */}
        <AnimatedAccordion expanded={expanded} estimatedHeight={600}>
          <View className="mt-3 gap-3">
            {/* Ingresos */}
            <View className={`${PANEL_INSET_CLASS} border-z-income-20 p-3 gap-1.5`}>
              <ChipDetailHeading tone="income">Ingresos planeados</ChipDetailHeading>
              <View className="flex-row justify-between">
                <Text className="text-sm font-inter-bold text-foreground">
                  {formatCurrency(plannedIncome, currency)}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {Math.round(incomePct)}% recibido
                </Text>
              </View>
              <View className="h-1.5 flex-row overflow-hidden rounded-full bg-z-surface-2-6">
                <View className="bg-z-income rounded-full" style={{ width: `${incomePct}%` }} />
              </View>
              {confirmedIncome > 0 && (
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Check size={10} color={COLORS.income} />
                  <Text className="text-[10px] font-inter text-z-income">
                    Recibido {formatCurrency(confirmedIncome, currency)}
                  </Text>
                </View>
              )}
              {pendingIncome > 0 && (
                <View className="flex-row items-center gap-1.5">
                  <Clock size={10} color={COLORS.sageDark} />
                  <Text className="text-[10px] font-inter text-muted-foreground">
                    Pendiente {formatCurrency(pendingIncome, currency)}
                  </Text>
                </View>
              )}
            </View>

            {/* Fijos */}
            <View className={`${PANEL_INSET_CLASS} border-z-alert-25 p-3 gap-1.5`}>
              <ChipDetailHeading tone="alert">Gastos fijos planeados</ChipDetailHeading>
              <View className="flex-row justify-between">
                <Text className="text-sm font-inter-bold text-foreground">
                  {formatCurrency(plannedExpenses, currency)}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {Math.round(expensePct)}% pagado
                </Text>
              </View>
              <View className="h-1.5 flex-row overflow-hidden rounded-full bg-z-surface-2-6">
                <View className="bg-z-alert rounded-full" style={{ width: `${expensePct}%` }} />
              </View>
              {paidExpenses > 0 && (
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Check size={10} color={COLORS.alert} />
                  <Text className="text-[10px] font-inter text-z-alert">
                    Pagado {formatCurrency(paidExpenses, currency)}
                  </Text>
                </View>
              )}
              {pendingExpenses > 0 && (
                <View className="flex-row items-center gap-1.5">
                  <Clock size={10} color={COLORS.sageDark} />
                  <Text className="text-[10px] font-inter text-muted-foreground">
                    Pendiente {formatCurrency(pendingExpenses, currency)}
                  </Text>
                </View>
              )}
            </View>

            {/* Gasto libre */}
            <View className={`${PANEL_INSET_CLASS} border-z-debt-20 p-3 gap-1`}>
              <ChipDetailHeading tone="debt">Gasto libre</ChipDetailHeading>
              <Text className="text-sm font-inter-bold text-z-expense">
                -{formatCurrency(discretionarySpent, currency)}
              </Text>
              <Text className="text-[9px] font-inter text-muted-foreground">
                Gastos no recurrentes del mes
              </Text>
            </View>

            {/* Bottom line */}
            <View className="border-t border-white-8 pt-2 gap-0.5">
              <View className="flex-row justify-between">
                <Text className="text-xs font-inter text-muted-foreground">Ingreso confirmado</Text>
                <Text className="text-xs font-inter-semibold text-z-income">+{formatCurrency(confirmedIncome, currency)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs font-inter text-muted-foreground">- Fijos pagados</Text>
                <Text className="text-xs font-inter-semibold text-z-alert">-{formatCurrency(paidExpenses, currency)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs font-inter text-muted-foreground">- Fijos pendientes</Text>
                <Text className="text-xs font-inter-semibold text-muted-foreground">-{formatCurrency(pendingExpenses, currency)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs font-inter text-muted-foreground">- Gasto libre</Text>
                <Text className="text-xs font-inter-semibold text-z-expense">-{formatCurrency(discretionarySpent, currency)}</Text>
              </View>
              <View className="border-t border-white-8 mt-1 pt-1.5 flex-row justify-between">
                <Text className="text-xs font-inter-bold text-foreground">= Disponible</Text>
                <Text className={`text-sm font-inter-bold ${isPositive ? "text-z-income" : "text-z-expense"}`}>
                  {formatCurrency(disponible, currency)}
                </Text>
              </View>
              {daysRemaining > 0 && (
                <Text className="text-[9px] font-inter text-muted-foreground">
                  ÷ {daysRemaining} días = {formatCurrency(perDay, currency)}/día
                </Text>
              )}
            </View>
          </View>
        </AnimatedAccordion>
      </GradientCard>
    </Pressable>
  );
}

export const PlanNetHero = memo(PlanNetHeroBase);
