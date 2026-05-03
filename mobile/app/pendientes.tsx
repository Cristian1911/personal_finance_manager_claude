import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { MobileHeader } from "../components/ui/MobileHeader";
import { MOBILE_TAB_BAR_CLEARANCE, PANEL_INSET_CLASS } from "../lib/constants/styles";

/**
 * Pending recurring occurrences for the active month — webapp parity entry
 * point. Currently RN exposes pending occurrences only inside `/recurrentes`;
 * this dedicated screen will list pending → paid actions in chronological
 * order. Scaffold only — list + actions land in Phase 5 alongside the
 * recurring template editor.
 */
export default function PendientesScreen() {
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <MobileHeader variant="sub" title="Pendientes" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}>
        <View className={`${PANEL_INSET_CLASS} p-4 gap-2`}>
          <Text className="text-sm font-inter-semibold text-foreground">
            Próximamente
          </Text>
          <Text className="text-[12px] font-inter text-muted-foreground leading-5">
            Aquí verás las ocurrencias recurrentes pendientes del mes para marcarlas como
            pagadas o saltarlas sin entrar al detalle de cada plantilla.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
