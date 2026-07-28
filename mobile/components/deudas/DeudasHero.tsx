import { View, Text, Pressable } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { GradientCard } from "../ui/GradientCard";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import type { DebtAccountInfo } from "../../lib/repositories/debt";

interface DeudasHeroProps {
  totalMonthlyPayment: number;
  monthlyInterest: number;
  currency: CurrencyCode;
  accounts: DebtAccountInfo[];
  expanded: boolean;
  onToggle: () => void;
}

export function DeudasHero({
  totalMonthlyPayment,
  monthlyInterest,
  currency,
  accounts,
  expanded,
  onToggle,
}: DeudasHeroProps) {
  return (
    <Pressable onPress={onToggle}>
      <GradientCard>
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Presión mensual
        </Text>

        <View className="mt-2 flex-row items-baseline gap-1">
          <Text className="text-[32px] font-inter-bold text-z-debt">
            {formatCurrency(totalMonthlyPayment, currency)}
          </Text>
          <Text className="text-sm font-inter-medium text-muted-foreground">/mes</Text>
        </View>

        <Text className="mt-1 text-xs font-inter text-muted-foreground">
          ~{formatCurrency(Math.round(monthlyInterest), currency)} en intereses
        </Text>

        {/* Expandable per-account breakdown */}
        <AnimatedAccordion expanded={expanded} estimatedHeight={accounts.length * 50 + 40}>
          <View className={`mt-3 ${PANEL_INSET_CLASS} border-white-8 bg-black-20 p-3 gap-2`}>
            <Text className="text-[10px] font-inter-bold uppercase tracking-[3px] text-z-brass">
              Por cuenta
            </Text>
            {accounts.map((a) => (
              <View key={a.id} className="flex-row items-center justify-between py-1">
                <View className="min-w-0 flex-1">
                  <Text className="text-xs font-inter text-foreground" numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text className="text-[10px] font-inter text-muted-foreground">
                    {a.type === "CREDIT_CARD" ? "Tarjeta" : "Préstamo"} · {a.interestRate}% EA
                  </Text>
                </View>
                <Text className="text-xs font-inter-semibold text-foreground">
                  {formatCurrency(a.monthlyPayment, currency)}
                </Text>
              </View>
            ))}
          </View>
        </AnimatedAccordion>
      </GradientCard>
    </Pressable>
  );
}
