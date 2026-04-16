import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { ChevronRight, Clock, CheckCircle } from "lucide-react-native";
import { MCard } from "../ui/MCard";
import { COLORS } from "../../lib/constants/colors";

interface PlanRecurringSummaryProps {
  totalExpected: number;
  pendingCount: number;
  paidCount: number;
  currency: CurrencyCode;
}

export function PlanRecurringSummary({
  totalExpected,
  pendingCount,
  paidCount,
  currency,
}: PlanRecurringSummaryProps) {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.push("/recurrentes" as any)}>
      <MCard>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[10px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Obligaciones recurrentes
            </Text>
            <Text className="text-[18px] font-inter-bold text-foreground mt-1">
              {formatCurrency(totalExpected, currency)}
            </Text>
            <View className="flex-row items-center gap-3 mt-1.5">
              <View className="flex-row items-center gap-1">
                <Clock size={11} color={COLORS.alert} />
                <Text className="text-[11px] font-inter-medium text-z-alert">
                  {pendingCount} pendientes
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <CheckCircle size={11} color={COLORS.income} />
                <Text className="text-[11px] font-inter-medium text-z-income">
                  {paidCount} pagados
                </Text>
              </View>
            </View>
          </View>
          <ChevronRight size={16} color={COLORS.sageDark} />
        </View>
      </MCard>
    </Pressable>
  );
}
