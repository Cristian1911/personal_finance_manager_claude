import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";
import { RingChart } from "../ui/RingChart";

interface DeudasGridProps {
  overallUtilization: number;
  totalCreditUsed: number;
  totalCreditLimit: number;
  totalMonthlyPayment: number;
  currency: CurrencyCode;
}

export function DeudasGrid({
  overallUtilization,
  totalCreditUsed,
  totalCreditLimit,
  totalMonthlyPayment,
  currency,
}: DeudasGridProps) {
  const utilizationColor =
    overallUtilization >= 80 ? COLORS.debt :
    overallUtilization >= 50 ? COLORS.alert :
    COLORS.income;

  return (
    <View className={`${PANEL_INSET_CLASS} p-3`}>
      <View className="flex-row justify-around">
        <RingChart
          percentage={overallUtilization}
          color={utilizationColor}
          size={56}
          label="Utilización"
        />

        <View className="items-center justify-center">
          <Text className="text-[18px] font-inter-bold text-foreground">
            {formatCurrency(totalCreditUsed, currency)}
          </Text>
          <Text className="text-[9px] font-inter text-muted-foreground">
            de {formatCurrency(totalCreditLimit, currency)}
          </Text>
          <Text className="mt-0.5 text-[9px] font-inter-semibold text-muted-foreground">
            Usado
          </Text>
        </View>

        <View className="items-center justify-center">
          <Text className="text-[18px] font-inter-bold text-z-debt">
            {formatCurrency(totalMonthlyPayment, currency)}
          </Text>
          <Text className="mt-0.5 text-[9px] font-inter-semibold text-muted-foreground">
            Pago mes
          </Text>
        </View>
      </View>
    </View>
  );
}
