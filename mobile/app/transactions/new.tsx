import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MobileHeader } from "../../components/ui/MobileHeader";
import { useHideTabBar } from "../../components/nav/TabBarVisibilityProvider";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";

/**
 * Manual full transaction form. Mirrors webapp `MobileTransactionForm`.
 * Scaffold only — fields, validation, and submission land in Phase 3.
 */
export default function NewTransactionScreen() {
  useHideTabBar();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <MobileHeader variant="sub" title="Nuevo movimiento" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom }}>
        <View className={`${PANEL_INSET_CLASS} p-4 gap-2`}>
          <Text className="text-sm font-inter-semibold text-foreground">
            Formulario en construcción
          </Text>
          <Text className="text-[12px] font-inter text-muted-foreground leading-5">
            Esta pantalla reemplazará la captura rápida con un formulario completo: monto,
            cuenta, categoría, destinatario, etiquetas, notas, y opción de crear plantilla
            recurrente. Llega en la siguiente entrega de paridad con la webapp.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
