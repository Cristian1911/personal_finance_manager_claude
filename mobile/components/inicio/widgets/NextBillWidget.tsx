import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { WidgetFrame } from "./WidgetFrame";
import type { NextBill } from "../../../lib/dashboard/useDashboardData";

interface NextBillWidgetProps {
  bill: NextBill;
  currency: CurrencyCode;
  editing?: boolean;
  onRemove?: () => void;
}

export function NextBillWidget({
  bill,
  currency,
  editing,
  onRemove,
}: NextBillWidgetProps) {
  const router = useRouter();

  return (
    <WidgetFrame
      editing={editing}
      onRemove={onRemove}
      onPress={() => router.push("/(tabs)/plan")}
      accessibilityLabel="Próximo pago"
    >
      <Text className="text-[9px] font-inter-bold uppercase tracking-[4px] text-z-sage-dark">
        Próximo pago
      </Text>
      {bill ? (
        <>
          <Text
            className="mt-2 text-[22px] font-inter-bold text-z-alert"
            numberOfLines={1}
          >
            {formatCurrency(bill.amount, currency)}
          </Text>
          <Text className="mt-1 text-[11px] font-inter text-foreground" numberOfLines={1}>
            {bill.name}
          </Text>
          <Text className="text-[10px] font-inter text-muted-foreground">
            {bill.daysUntil === 0 ? "Vence hoy" : `en ${bill.daysUntil} días`}
          </Text>
        </>
      ) : (
        <View className="mt-2">
          <Text className="text-[22px] font-inter-bold text-z-sage-light">—</Text>
          <Text className="mt-1 text-[11px] font-inter text-muted-foreground">
            Sin pagos próximos
          </Text>
        </View>
      )}
    </WidgetFrame>
  );
}
