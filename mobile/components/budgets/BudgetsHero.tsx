import { memo } from "react";
import { Text, View } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { PANEL_SURFACE_SUBTLE_CLASS, SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";

interface BudgetsHeroProps {
  spent: number;
  target: number;
  progress: number;
  currency: CurrencyCode;
}

function progressBarClass(progress: number): string {
  if (progress >= 100) return "bg-z-debt";
  if (progress >= 80) return "bg-z-alert";
  return "bg-z-income";
}

function BudgetsHeroBase({ spent, target, progress, currency }: BudgetsHeroProps) {
  const hasBudgets = target > 0;
  const remaining = Math.max(target - spent, 0);
  const clamped = Math.min(progress, 100);

  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} p-5`}>
      <Text className={SECTION_EYEBROW_CLASS}>Control mensual</Text>
      <Text className="mt-2 text-2xl font-inter-bold text-foreground">
        {formatCurrency(spent, currency)}
      </Text>
      <Text className="mt-1 text-xs font-inter text-muted-foreground">
        {hasBudgets
          ? `de ${formatCurrency(target, currency)} presupuestado`
          : "Aún no has fijado un presupuesto"}
      </Text>

      {hasBudgets && (
        <>
          <View className="mt-4 h-2 rounded-full bg-black-10">
            <View
              className={`${progressBarClass(progress)} h-2 rounded-full`}
              style={{ width: `${clamped}%` }}
            />
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[11px] font-inter text-muted-foreground">
              {Math.round(progress)}% usado
            </Text>
            <Text className="text-[11px] font-inter text-muted-foreground">
              Quedan {formatCurrency(remaining, currency)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

export const BudgetsHero = memo(BudgetsHeroBase);
