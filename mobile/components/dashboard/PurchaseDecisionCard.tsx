import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Brain } from "lucide-react-native";

export function PurchaseDecisionCard() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/purchase-decision" as never)}
      className="mx-4 mt-4 rounded-lg bg-white p-4 shadow-sm active:bg-gray-50"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 rounded-full bg-emerald-50 items-center justify-center">
          <Brain size={20} color="#047857" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-inter-semibold text-gray-900">
            ¿Deberia comprar esto?
          </Text>
          <Text className="text-xs font-inter text-gray-500 mt-0.5">
            Evalua el impacto en liquidez, deuda y presupuesto
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
