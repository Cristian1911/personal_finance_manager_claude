import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DisponibleBlockView } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";

/** "Así sale tu número": the formula's lines under the Disponible block. */
export const NumberBreakdown = memo(function NumberBreakdown({
  lines,
  onPressDetail,
}: {
  lines: DisponibleBlockView["breakdown"];
  onPressDetail?: () => void;
}) {
  const t = useV2Theme();
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>ASÍ SALE TU NÚMERO</Text>
        {onPressDetail && (
          <Pressable onPress={onPressDetail} accessibilityRole="button" hitSlop={10}>
            <Text style={[styles.link, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Ver detalle</Text>
          </Pressable>
        )}
      </View>
      {lines.map((l, i) => (
        <View key={l.label} style={styles.line}>
          <Text style={[styles.label, { color: i === 0 ? t.colors.ink : t.colors.muted, fontFamily: t.fonts.ui }]}>
            {l.label}
          </Text>
          <Text style={[styles.amount, { color: t.colors.ink, fontFamily: t.fonts.ui }]}>{l.amount}</Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  eyebrow: { fontSize: 12, letterSpacing: 1.2 },
  link: { fontSize: 14, textDecorationLine: "underline" },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 12 },
  label: { fontSize: 15, flexShrink: 1 },
  amount: { fontSize: 15, fontVariant: ["tabular-nums"] },
});
