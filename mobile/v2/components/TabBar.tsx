import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardState } from "react-native-keyboard-controller";
import { Calendar, Home, Inbox, List, Plus, type LucideIcon } from "lucide-react-native";
import { useV2Theme } from "../theme/ThemeProvider";
import { Tap } from "./Tap";

/** The bar (S8-1): Inicio · Movimientos · (+) · Pagos · Revisar. */
export const V2_TABS: readonly { name: string; title: string; icon: LucideIcon }[] = [
  { name: "inicio", title: "Inicio", icon: Home },
  { name: "movimientos", title: "Movimientos", icon: List },
  { name: "pagos", title: "Pagos", icon: Calendar },
  { name: "revisar", title: "Revisar", icon: Inbox },
];

/** How far the "+" sticks up over the bar (screens keep content clear of it). */
export const FAB_OVERHANG = 22;

/** The bar's height above the safe area's inset (padding 8 + tab 48). */
export const TAB_BAR_HEIGHT = 56;

/** Secondary screens open inside the tab they belong to; that tab stays lit. */
const PARENT_TAB: Record<string, string> = { flujo: "inicio", cuentas: "inicio", cuenta: "inicio", ajustes: "inicio" };

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
    const { name, title, icon: Icon } = V2_TABS[i];
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
        <View style={[styles.pill, on && { backgroundColor: t.colors.sunk, borderWidth: 1.5, borderColor: t.colors.ink }]}>
          <Icon size={19} color={on ? t.colors.ink : t.colors.muted} strokeWidth={on ? 2.2 : 2} />
        </View>
        <Text numberOfLines={1} style={{ fontSize: 10.5, color: on ? t.colors.ink : t.colors.muted, fontFamily: on ? t.fonts.uiSemibold : t.fonts.uiMedium }}>
          {title}
        </Text>
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

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "flex-start", borderTopWidth: 1, paddingTop: 8, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: "center", gap: 3, minHeight: 48 },
  pill: { width: 54, height: 30, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  fabSlot: { width: 72, alignItems: "center" },
  fab: { width: 58, height: 58, borderRadius: 29, marginTop: -FAB_OVERHANG, alignItems: "center", justifyContent: "center" },
});
