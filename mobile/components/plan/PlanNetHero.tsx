import { View, Text, Pressable } from "react-native";
import { Check, Clock } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { GradientCard } from "../ui/GradientCard";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { SECTION_EYEBROW_CLASS, PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

export interface PlanExecution {
  // Income tracking
  plannedIncome: number;
  confirmedIncome: number;
  pendingIncome: number;
  // Obligation tracking
  plannedExpenses: number;
  paidExpenses: number;
  pendingExpenses: number;
  // Discretionary spending (non-recurring outflows)
  discretionarySpent: number;
  // Bottom line
  disponible: number;
  daysRemaining: number;
  perDay: number;
}

interface PlanNetHeroProps {
  plan: PlanExecution;
  currency: CurrencyCode;
  expanded: boolean;
  onToggle: () => void;
}

export function PlanNetHero({
  plan,
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

  // Progress: how much of planned income has been confirmed
  const incomePct = plannedIncome > 0 ? Math.min(100, (confirmedIncome / plannedIncome) * 100) : 0;
  // How much of planned expenses have been paid
  const expensePct = plannedExpenses > 0 ? Math.min(100, (paidExpenses / plannedExpenses) * 100) : 0;


  return (
    <Pressable onPress={onToggle}>
      <GradientCard>
        <View className="flex-row items-center justify-between">
          <Text className={SECTION_EYEBROW_CLASS}>
            Plan del mes
          </Text>
          <Text className="text-xs font-inter text-muted-foreground">
            {daysRemaining} dias restantes
          </Text>
        </View>

        {/* Main number: disponible */}
        <Text className={`mt-2 text-[32px] font-inter-bold ${isPositive ? "text-z-income" : "text-z-expense"}`}>
          {formatCurrency(disponible, currency)}
        </Text>
        <Text className="text-xs font-inter text-muted-foreground">
          disponible · {formatCurrency(perDay, currency)}/dia
        </Text>

        {/* Burn bar — how much of confirmed income has been used */}
        <View className="mt-3 h-2 flex-row overflow-hidden rounded-full bg-white-6">
          {/* Paid obligations */}
          <View className="bg-z-alert" style={{ width: `${plannedExpenses > 0 ? Math.min((paidExpenses / (confirmedIncome || 1)) * 100, 100) : 0}%` }} />
          {/* Discretionary */}
          <View className="bg-z-debt" style={{ width: `${Math.min((discretionarySpent / (confirmedIncome || 1)) * 100, 100 - (paidExpenses / (confirmedIncome || 1)) * 100)}%` }} />
          {/* Remaining = green space (implicit) */}
        </View>
        <View className="mt-1.5 flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-z-alert" />
            <Text className="text-[9px] font-inter text-muted-foreground">Fijos</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-z-debt" />
            <Text className="text-[9px] font-inter text-muted-foreground">Gasto libre</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-white-6" />
            <Text className="text-[9px] font-inter text-muted-foreground">Disponible</Text>
          </View>
        </View>

        {/* Expand CTA */}
        <Text className="mt-2 text-center text-[10px] font-inter text-muted-fg-50">
          {expanded ? "Ocultar desglose ↑" : "Ver desglose del plan ↓"}
        </Text>

        {/* Expandable breakdown */}
        <AnimatedAccordion expanded={expanded} estimatedHeight={320}>
          <View className="mt-3 gap-3">
            {/* ── INGRESOS section ── */}
            <View className={`${PANEL_INSET_CLASS} p-3 gap-1.5`} style={{ borderColor: "rgba(92,184,138,0.2)" }}>
              <Text className="text-[9px] font-inter-bold uppercase tracking-[3px] text-z-income">
                Ingresos planeados
              </Text>
              <View className="flex-row justify-between">
                <Text className="text-sm font-inter-bold text-foreground">
                  {formatCurrency(plannedIncome, currency)}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {Math.round(incomePct)}% recibido
                </Text>
              </View>
              {/* Progress bar */}
              <View className="h-1.5 flex-row overflow-hidden rounded-full bg-white-6">
                <View className="bg-z-income rounded-full" style={{ width: `${incomePct}%` }} />
              </View>
              {/* Confirmed line */}
              {confirmedIncome > 0 && (
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Check size={10} color={COLORS.income} />
                  <Text className="text-[10px] font-inter text-z-income">
                    Recibido {formatCurrency(confirmedIncome, currency)}
                  </Text>
                </View>
              )}
              {/* Pending line */}
              {pendingIncome > 0 && (
                <View className="flex-row items-center gap-1.5">
                  <Clock size={10} color={COLORS.sageDark} />
                  <Text className="text-[10px] font-inter text-muted-foreground">
                    Pendiente {formatCurrency(pendingIncome, currency)}
                  </Text>
                </View>
              )}
            </View>

            {/* ── GASTOS FIJOS section ── */}
            <View className={`${PANEL_INSET_CLASS} p-3 gap-1.5`} style={{ borderColor: "rgba(212,168,67,0.2)" }}>
              <Text className="text-[9px] font-inter-bold uppercase tracking-[3px] text-z-alert">
                Gastos fijos planeados
              </Text>
              <View className="flex-row justify-between">
                <Text className="text-sm font-inter-bold text-foreground">
                  {formatCurrency(plannedExpenses, currency)}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {Math.round(expensePct)}% pagado
                </Text>
              </View>
              <View className="h-1.5 flex-row overflow-hidden rounded-full bg-white-6">
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

            {/* ── GASTO LIBRE ── */}
            <View className={`${PANEL_INSET_CLASS} p-3 gap-1`} style={{ borderColor: "rgba(224,85,69,0.2)" }}>
              <Text className="text-[9px] font-inter-bold uppercase tracking-[3px] text-z-debt">
                Gasto libre
              </Text>
              <Text className="text-sm font-inter-bold text-z-expense">
                -{formatCurrency(discretionarySpent, currency)}
              </Text>
              <Text className="text-[9px] font-inter text-muted-foreground">
                Gastos no recurrentes del mes
              </Text>
            </View>

            {/* ── BOTTOM LINE ── */}
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
              <Text className="text-[9px] font-inter text-muted-foreground">
                ÷ {daysRemaining} dias = {formatCurrency(perDay, currency)}/dia
              </Text>
            </View>
          </View>
        </AnimatedAccordion>
      </GradientCard>
    </Pressable>
  );
}
