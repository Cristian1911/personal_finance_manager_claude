import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, Tabs, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { V2_DEBUG_ENABLED } from "../../lib/v2/flags";
import { useV2UserId } from "../../lib/v2/user";
import { useV2Sync } from "../../lib/v2/sync/use-sync";
import { onOpenAnotar, type AnotarPrefill } from "../../lib/v2/anotar/open";
import { AnotarSheet, type AnotarSaved } from "../../v2/components/AnotarSheet";
import { FAB_OVERHANG, TAB_BAR_HEIGHT, TabBar } from "../../v2/components/TabBar";
import { Toast } from "../../v2/components/Toast";
import { useV2Fonts } from "../../v2/theme/fonts";
import { useV2Theme } from "../../v2/theme/ThemeProvider";
import { V2ThemeFromPrefs } from "../../v2/theme/prefs";

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
      <V2ThemeFromPrefs>
        {fontsReady ? <V2Tabs /> : <Backdrop />}
      </V2ThemeFromPrefs>
    </GestureHandlerRootView>
  );
}

function V2Tabs() {
  const t = useV2Theme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useV2UserId();
  useV2Sync(userId);
  const [anotar, setAnotar] = useState<AnotarPrefill | null>(null);
  useEffect(() => onOpenAnotar(setAnotar), []);
  const [toast, setToast] = useState<AnotarSaved | null>(null);
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.colors.bg } }}
      tabBar={(props) => <TabBar {...props} onAdd={() => setAnotar({})} />}
    >
      <Tabs.Screen name="inicio" />
      <Tabs.Screen name="movimientos" />
      <Tabs.Screen name="pagos" />
      <Tabs.Screen name="revisar" />
      <Tabs.Screen name="flujo" options={{ href: null }} />
      <Tabs.Screen name="cuentas" options={{ href: null }} />
      <Tabs.Screen name="cuenta" options={{ href: null }} />
      <Tabs.Screen name="ajustes" options={{ href: null }} />
    </Tabs>
    <AnotarSheet
      open={!!anotar}
      prefill={anotar}
      userId={userId}
      onClose={() => setAnotar(null)}
      onSaved={setToast}
      onAddAccount={() => router.navigate({ pathname: "/cuentas", params: { add: "cuenta" } } as never)}
    />
    <Toast
      message={toast?.message ?? null}
      action={toast ? {
        label: "Deshacer",
        onPress: () => {
          toast.undo().catch((e) => {
            console.warn("[v2 anotar] undo failed", e);
            Alert.alert("No se pudo deshacer", "Bórralo desde Movimientos.");
          });
        },
      } : undefined}
      onHide={() => setToast(null)}
      bottom={TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + FAB_OVERHANG + 12}
    />
    </View>
  );
}

/** The theme's background while the fonts load, instead of a white flash. */
function Backdrop() {
  const t = useV2Theme();
  return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;
}
