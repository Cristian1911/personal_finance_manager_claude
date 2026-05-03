import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { MobileHeader } from "../components/ui/MobileHeader";
import { MOBILE_TAB_BAR_CLEARANCE, PANEL_INSET_CLASS } from "../lib/constants/styles";

/**
 * Tags (`/etiquetas`) — webapp has full CRUD UI for tags + tag groups, mobile
 * has the SQLite tables and sync but zero UI. Scaffold only — list, create,
 * edit, delete, and assign-to-transaction land in Phase 5.
 */
export default function EtiquetasScreen() {
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <MobileHeader variant="sub" title="Etiquetas" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}>
        <View className={`${PANEL_INSET_CLASS} p-4 gap-2`}>
          <Text className="text-sm font-inter-semibold text-foreground">
            Próximamente
          </Text>
          <Text className="text-[12px] font-inter text-muted-foreground leading-5">
            Las etiquetas se podrán crear, editar y asignar a movimientos desde aquí.
            Por ahora la sincronización ya está activa, pero la interfaz llega en la
            siguiente entrega.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
