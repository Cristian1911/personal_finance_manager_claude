import { View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { V2_DEBUG_ENABLED } from "../../lib/v2/flags";
import { useV2Fonts } from "../../v2/theme/fonts";
import { V2ThemeProvider, useV2Theme } from "../../v2/theme/ThemeProvider";

/**
 * v2 screens (behind EXPO_PUBLIC_ZETA_V2 until the flag flips in M7): the
 * guard, the v2 fonts, the theme and the gesture root (Tu flujo's chart)
 * once for the whole group.
 */
export default function V2Layout() {
  const fontsReady = useV2Fonts();
  if (!V2_DEBUG_ENABLED) return <Redirect href="/" />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <V2ThemeProvider>
        {fontsReady ? <Stack screenOptions={{ headerShown: false }} /> : <Backdrop />}
      </V2ThemeProvider>
    </GestureHandlerRootView>
  );
}

/** The theme's background while the fonts load, instead of a white flash. */
function Backdrop() {
  const t = useV2Theme();
  return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;
}
