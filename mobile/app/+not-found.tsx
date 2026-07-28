import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Compass } from "lucide-react-native";
import { MobileHeader } from "../components/ui/MobileHeader";
import { BRASS_BUTTON_CLASS } from "../lib/constants/styles";
import { COLORS } from "../lib/constants/colors";

export default function NotFoundScreen() {
  const router = useRouter();

  // ponytail: variant="main" (no back arrow) on purpose — a 404 is usually
  // reached by deep link, where the history stack is empty and back is a
  // dead end. The CTA is the escape hatch.
  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="main" title="Página no encontrada" />
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-z-brass-10">
          <Compass size={24} color={COLORS.brass} />
        </View>
        <Text className="text-center text-base font-inter-semibold text-foreground">
          Esta pantalla no existe
        </Text>
        <Text className="text-center text-sm font-inter text-muted-foreground">
          El enlace que abriste apunta a un lugar que ya no está disponible.
        </Text>
        <Pressable
          onPress={() => router.replace("/")}
          className={`${BRASS_BUTTON_CLASS} mt-2 rounded-xl px-5 py-3`}
          accessibilityRole="button"
        >
          <Text className="text-sm font-inter-semibold text-z-ink">
            Ir al inicio
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
