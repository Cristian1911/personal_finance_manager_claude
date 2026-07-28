import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Brain } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";

export function PurchaseDecisionCard() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/purchase-decision" as never)}
      className="mx-4 mt-4 rounded-lg bg-z-surface-2-55 p-4 active:bg-black-10"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 rounded-full bg-z-brass/10 items-center justify-center">
          <Brain size={20} color={COLORS.sageLight} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-inter-semibold text-foreground">
            ¿Deberia comprar esto?
          </Text>
          <Text className="text-xs font-inter text-muted-foreground mt-0.5">
            Evalua el impacto en liquidez, deuda y presupuesto
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
