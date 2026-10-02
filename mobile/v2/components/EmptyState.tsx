import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useV2Theme } from "../theme/ThemeProvider";

/** A whole screen with nothing in it yet: a title on top, one centered sentence. */
export function EmptyState({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: t.colors.bg, paddingTop: insets.top + 8 }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{title}</Text>
      <View style={styles.center}>
        <Text style={[styles.message, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>{message}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 26, letterSpacing: -0.5, paddingHorizontal: 4, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  message: { fontSize: 15, lineHeight: 22, textAlign: "center" },
});
