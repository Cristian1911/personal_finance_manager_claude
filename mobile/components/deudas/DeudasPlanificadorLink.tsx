import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Calculator, ChevronRight } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import { BRASS_GHOST_BUTTON_CLASS } from "../../lib/constants/styles";

interface DeudasPlanificadorLinkProps {
  accountCount: number;
}

export function DeudasPlanificadorLink({
  accountCount,
}: DeudasPlanificadorLinkProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/deudas/planificador" as any)}
      className={`${BRASS_GHOST_BUTTON_CLASS} rounded-2xl p-4 flex-row items-center justify-between`}
    >
      <View className="flex-row items-center gap-3 flex-1">
        <Calculator size={20} color={COLORS.brass} />
        <View className="flex-1">
          <Text className="text-[14px] font-inter-semibold text-z-brass">
            Planificador de deudas
          </Text>
          <Text className="text-[11px] font-inter text-z-sage-dark mt-0.5">
            Simula estrategias para {accountCount} cuenta{accountCount !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={COLORS.brass} />
    </Pressable>
  );
}
