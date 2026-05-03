import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { MobileHeader } from "../../components/ui/MobileHeader";
import { useHideTabBar } from "../../components/nav/TabBarVisibilityProvider";
import { MOBILE_TAB_BAR_CLEARANCE, PANEL_INSET_CLASS } from "../../lib/constants/styles";

/**
 * Manual full transaction form. Mirrors webapp `MobileTransactionForm`.
 * Scaffold only — fields, validation, and submission land in Phase 3.
 */
export default function NewTransactionScreen() {
  useHideTabBar();
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <MobileHeader variant="sub" title="Nuevo movimiento" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}>
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
