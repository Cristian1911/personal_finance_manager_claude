import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useV2Theme } from "../theme/ThemeProvider";
import { useMotionMs } from "./Collapse";

/** How long a Deshacer stays (D15). */
export const TOAST_MS = 5000;

/** A short message at the bottom with an optional action ("Deshacer"); hides itself after 5 s. */
export function Toast({ message, action, onHide }: {
  message: string | null;
  action?: { label: string; onPress: () => void };
  onHide: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const duration = useMotionMs(180);
  const hide = useRef(onHide);
  hide.current = onHide;
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => hide.current(), TOAST_MS);
    return () => clearTimeout(id);
  }, [message]);
  const fade = useAnimatedStyle(() => ({ opacity: withTiming(message ? 1 : 0, { duration }) }), [message, duration]);
  if (!message) return null;
  return (
    <Animated.View
      style={[styles.toast, { backgroundColor: t.colors.button, bottom: insets.bottom + 20 }, fade]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: t.colors.onButton, fontFamily: t.fonts.uiMedium }]} numberOfLines={2}>{message}</Text>
      {action && (
        <Pressable onPress={() => { action.onPress(); onHide(); }} accessibilityRole="button" hitSlop={10}>
          <Text style={[styles.action, { color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }]}>{action.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: "absolute", left: 16, right: 16, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, fontSize: 14 },
  action: { fontSize: 14, textDecorationLine: "underline" },
});
