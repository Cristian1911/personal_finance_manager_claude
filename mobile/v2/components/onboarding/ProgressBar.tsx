import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { setupLevel, setupLevelLabel } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";
import { useMotionMs } from "../Collapse";

/**
 * "Tu número empezará en Aproximado · 55%" (S10-3): moves with every data
 * point, and says what the last one added ("+20% · Pagos fijos").
 */
export function ProgressBar({ percent, lastGain }: { percent: number; lastGain: { text: string; n: number } | null }) {
  const t = useV2Theme();
  const ms = useMotionMs(500);
  const level = setupLevel(percent);
  const w = useSharedValue(percent);
  useEffect(() => {
    w.value = withTiming(percent, { duration: ms, easing: Easing.out(Easing.cubic) });
  }, [percent, ms, w]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(w.value, 2)}%` }));

  // The gain note shows for a moment after it changes.
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!lastGain) return;
    setNote(lastGain.text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 2600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [lastGain]);

  return (
    <View style={[styles.box, { backgroundColor: t.colors.card }]}>
      <View style={styles.head}>
        <Text style={{ flex: 1, fontSize: 14, color: t.colors.ink, fontFamily: t.fonts.ui }}>
          Tu número empezará en <Text style={{ fontFamily: t.fonts.uiSemibold }}>{setupLevelLabel(level)}</Text>
        </Text>
        <Text style={{ fontSize: 14, color: t.colors.ink, fontFamily: t.fonts.mono }}>{percent}%</Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Qué tan completo está tu número"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={[styles.track, { backgroundColor: t.colors.sunk }]}
      >
        <Animated.View style={[styles.fill, { backgroundColor: level === "real" ? t.colors.ok.solid : t.colors.ink }, fill]} />
      </View>
      {note && (
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: t.colors.ok.text, fontFamily: t.fonts.uiSemibold }}>{note}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  head: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  track: { height: 10, borderRadius: 5, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
});
