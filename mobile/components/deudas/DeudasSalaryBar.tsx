import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { MCard } from "../ui/MCard";
import { COLORS } from "../../lib/constants/colors";

interface DeudasSalaryBarProps {
  monthlyIncome: number;
  totalDebtPayment: number;
  currency: CurrencyCode;
}

export function DeudasSalaryBar({
  monthlyIncome,
  totalDebtPayment,
  currency,
}: DeudasSalaryBarProps) {
  if (monthlyIncome <= 0) return null;

  const debtPct = Math.min(
    Math.round((totalDebtPayment / monthlyIncome) * 100),
    100
  );
  const freePct = 100 - debtPct;
  const isHigh = debtPct >= 40;

  return (
    <MCard>
      <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark mb-2">
        Asignación de ingreso
      </Text>

      {/* Stacked bar */}
      <View className="h-3 rounded-full bg-z-surface-2-6 overflow-hidden flex-row">
        <View
          className="h-full rounded-l-full"
          style={{
            width: `${debtPct}%`,
            backgroundColor: isHigh ? COLORS.debt : COLORS.alert,
          }}
        />
        <View
          className="h-full rounded-r-full"
          style={{
            width: `${freePct}%`,
            backgroundColor: COLORS.income,
          }}
        />
      </View>

      {/* Labels */}
      <View className="flex-row justify-between mt-2">
        <View className="flex-row items-center gap-1.5">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: isHigh ? COLORS.debt : COLORS.alert }}
          />
          <Text className="text-[11px] font-inter text-muted-foreground">
            Deuda {debtPct}%
          </Text>
          <Text className="text-[11px] font-inter-semibold text-foreground">
            {formatCurrency(totalDebtPayment, currency)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: COLORS.income }}
          />
          <Text className="text-[11px] font-inter text-muted-foreground">
            Libre {freePct}%
          </Text>
        </View>
      </View>
    </MCard>
  );
}
