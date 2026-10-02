import { Pressable, StyleSheet, Text, View } from "react-native";
import { useV2Theme } from "../theme/ThemeProvider";

/** Selector chip (filters, kinds): outlined, filled ink when on. 32 visible, 44 touch. */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useV2Theme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={[styles.chip, on ? { backgroundColor: t.colors.button } : { borderWidth: 1.5, borderColor: t.colors.control }]}
    >
      <Text style={{ fontSize: 13, color: on ? t.colors.onButton : t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{label}</Text>
    </Pressable>
  );
}

/** One-of-N switch on a sunk track (Gasto · Ingreso · Entre cuentas). Equal columns. */
export function Segmented<K extends string>({ options, value, onChange }: {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const t = useV2Theme();
  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: t.colors.sunk, borderColor: t.colors.line }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.seg, on && [{ backgroundColor: t.colors.card }, t.shadow]]}
          >
            <Text
              numberOfLines={1}
              style={{ fontSize: 13, color: on ? t.colors.ink : t.colors.muted, fontFamily: on ? t.fonts.uiSemibold : t.fonts.uiMedium }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 9, justifyContent: "center" },
  track: { flexDirection: "row", padding: 3, borderRadius: 11, borderWidth: 1 },
  seg: { flex: 1, minHeight: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
});
