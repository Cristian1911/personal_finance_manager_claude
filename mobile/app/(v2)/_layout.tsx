import { View } from "react-native";
import { Redirect, Tabs, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { V2_DEBUG_ENABLED } from "../../lib/v2/flags";
import { TabBar } from "../../v2/components/TabBar";
import { useV2Fonts } from "../../v2/theme/fonts";
import { V2ThemeProvider, useV2Theme } from "../../v2/theme/ThemeProvider";

/**
 * v2 screens (behind EXPO_PUBLIC_ZETA_V2 until launch): the guard, the v2
 * fonts, the theme, the gesture root (Tu flujo's chart) and the tab bar
 * (S8-1) once for the whole group. Flat tabs: secondary screens are hidden
 * tabs (href: null) so the bar stays visible and back follows history.
 */
export default function V2Layout() {
  const fontsReady = useV2Fonts();
  if (!V2_DEBUG_ENABLED) return <Redirect href="/" />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <V2ThemeProvider>
        {fontsReady ? <V2Tabs /> : <Backdrop />}
      </V2ThemeProvider>
    </GestureHandlerRootView>
  );
}

function V2Tabs() {
  const t = useV2Theme();
  const router = useRouter();
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.colors.bg } }}
      // ponytail: "+" opens the engine debug capture until Anotar lands (needs named accounts, PR 4).
      tabBar={(props) => <TabBar {...props} onAdd={() => router.push("/v2-debug" as never)} />}
    >
      <Tabs.Screen name="inicio" />
      <Tabs.Screen name="movimientos" />
      <Tabs.Screen name="pagos" />
      <Tabs.Screen name="revisar" />
      <Tabs.Screen name="flujo" options={{ href: null }} />
      <Tabs.Screen name="cuentas" options={{ href: null }} />
      <Tabs.Screen name="cuenta" options={{ href: null }} />
    </Tabs>
  );
}

/** The theme's background while the fonts load, instead of a white flash. */
function Backdrop() {
  const t = useV2Theme();
  return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;
}
