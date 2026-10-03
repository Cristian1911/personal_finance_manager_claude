import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardState } from "react-native-keyboard-controller";
import { Plus } from "lucide-react-native";
import { useV2Theme } from "../theme/ThemeProvider";
import { useMotionMs } from "./Collapse";
import { TabIcon, type TabIconName } from "./TabIcons";
import { Tap } from "./Tap";

/**
 * The bar (S8-1): Inicio · Movimientos · (+) · Pagos · Revisar. The tab you're
 * in has a filled icon, its name in ink and a dot under it; the rest are
 * outlines in gray (owner choice, option D in
 * claude-ai-design/v2-tabbar-indicator-options.html).
 */
export const V2_TABS: readonly { name: string; title: string; icon: TabIconName }[] = [
  { name: "inicio", title: "Inicio", icon: "home" },
  { name: "movimientos", title: "Movimientos", icon: "list" },
  { name: "pagos", title: "Pagos", icon: "calendar" },
  { name: "revisar", title: "Revisar", icon: "inbox" },
];

/** How far the "+" sticks up over the bar (screens keep content clear of it). */
export const FAB_OVERHANG = 22;

/** The bar's height above the safe area's inset (padding 8 + tab 48). */
export const TAB_BAR_HEIGHT = 56;

/** Secondary screens open inside the tab they belong to; that tab stays lit. */
const PARENT_TAB: Record<string, string> = { flujo: "inicio", cuentas: "inicio", cuenta: "inicio" };
// Ajustes (and Correos) open from the avatar on every tab: no tab is "the one you're in" there.

export function TabBar({ state, navigation, onAdd }: {
  state: { routes: { name: string }[]; index: number };
  navigation: { navigate: (name: string) => void };
  /** The "+" (Anotar). */
  onAdd: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardState((s) => s.isVisible);
  if (keyboard) return null;

  const current = state.routes[state.index]?.name ?? "";
  const active = PARENT_TAB[current] ?? current;
  const tab = (i: number) => {
    const { name, title, icon } = V2_TABS[i];
    const on = name === active;
    return (
      <Pressable
        key={name}
        onPress={() => navigation.navigate(name)}
        accessibilityRole="tab"
        accessibilityLabel={title}
        accessibilityState={{ selected: on }}
        style={styles.tab}
      >
        <GrowIcon on={on}>
          <TabIcon name={icon} filled={on} color={on ? t.colors.ink : t.colors.muted} cut={t.colors.card} />
        </GrowIcon>
        <Text numberOfLines={1} style={{ fontSize: 10.5, color: on ? t.colors.ink : t.colors.muted, fontFamily: on ? t.fonts.uiSemibold : t.fonts.uiMedium }}>
          {title}
        </Text>
        <View style={[styles.dot, { backgroundColor: on ? t.colors.ink : "transparent" }]} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { backgroundColor: t.colors.card, borderTopColor: t.colors.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tab(0)}
      {tab(1)}
      <View style={styles.fabSlot}>
        <Tap
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Anotar"
          style={(pressed) => [
            styles.fab,
            { backgroundColor: t.colors.button },
            // Lifted off the bar in light themes; dark themes have no shadows.
            t.shadow && { shadowColor: t.shadow.shadowColor, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
            pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <Plus size={26} color={t.colors.onButton} strokeWidth={2.4} />
        </Tap>
      </View>
      {tab(2)}
      {tab(3)}
    </View>
  );
}

/** The active icon grows a little (12%) in place: the bar doesn't move. */
function GrowIcon({ on, children }: { on: boolean; children: ReactNode }) {
  const ms = useMotionMs(180);
  const scale = useSharedValue(on ? ACTIVE_SCALE : 1);
  useEffect(() => {
    scale.value = withTiming(on ? ACTIVE_SCALE : 1, { duration: ms });
  }, [on, ms, scale]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.icon, grow]}>{children}</Animated.View>;
}
const ACTIVE_SCALE = 1.12;

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "flex-start", borderTopWidth: 1, paddingTop: 8, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: "center", gap: 2, minHeight: 48 },
  icon: { height: 26, alignItems: "center", justifyContent: "center" },
  dot: { width: 4, height: 4, borderRadius: 2 },
  fabSlot: { width: 72, alignItems: "center" },
  fab: { width: 58, height: 58, borderRadius: 29, marginTop: -FAB_OVERHANG, alignItems: "center", justifyContent: "center" },
});
