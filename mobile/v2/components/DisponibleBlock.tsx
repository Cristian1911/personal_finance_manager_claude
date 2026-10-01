import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DisponibleBlockView } from "@zeta/shared";
import { VERDICT_STATE } from "../tokens";
import { useV2Theme } from "../theme/ThemeProvider";
import { FittedAmount } from "./FittedAmount";

/**
 * The fixed block on top of Inicio (S5-4): verdict pill, payday, the one big
 * number, one per-day line, "+$X cuando te paguen". Oliva tints the card with
 * the state; Nítido fills it solid. Only this number is heavy (S5-R).
 * All copy comes from disponibleBlockView (@zeta/shared).
 */
export const DisponibleBlock = memo(function DisponibleBlock({
  view,
  onPressSub,
}: {
  view: DisponibleBlockView;
  onPressSub?: () => void;
}) {
  const t = useV2Theme();
  const state = t.colors[VERDICT_STATE[view.state]];
  const solid = t.disponibleStyle === "solid";
  const fill = solid ? state.solid : state.tint;
  const accent = solid ? state.onSolid : state.text;
  const number = solid ? state.onSolid : t.colors.ink;

  return (
    <View style={[styles.block, { backgroundColor: fill }, !solid && t.shadow]}>
      {/* One read-only group for screen readers; the sub line below stays its own button. */}
      <View accessible accessibilityLabel={spokenLabel(view)}>
        <View style={styles.top}>
          <View
            style={[
              styles.pill,
              solid ? { borderWidth: 1.5, borderColor: accent } : { backgroundColor: t.colors.card },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={[styles.pillText, { color: accent, fontFamily: t.fonts.uiSemibold }]}>{view.pill}</Text>
          </View>
          <Text style={[styles.payday, { color: accent, fontFamily: t.fonts.ui }]} numberOfLines={2}>
            {view.payday}
          </Text>
        </View>

        <Text style={[styles.eyebrow, { color: accent, fontFamily: t.fonts.mono }]}>DISPONIBLE</Text>
        <FittedAmount full={view.amount} short={view.amountShort} color={number} fontFamily={t.fonts.number} size={56} style={styles.number} />
        <Text style={[styles.perDay, { color: accent, fontFamily: t.fonts.uiMedium }]}>{view.perDay}</Text>
        {view.approxNote && (
          <Text style={[styles.sub, { color: accent, fontFamily: t.fonts.ui }]}>~ {view.approxNote}</Text>
        )}
      </View>
      {view.sub && (
        <Pressable onPress={onPressSub} disabled={!onPressSub} accessibilityRole={onPressSub ? "button" : "text"} hitSlop={8}>
          <Text style={[styles.sub, { color: accent, fontFamily: t.fonts.ui }]}>{view.sub}</Text>
        </Pressable>
      )}
    </View>
  );
});

/** "~" and "−" read aloud the same way on every screen reader. */
const spoken = (amount: string) => amount.replace("~", "aproximadamente ").replace("−", "menos ");

function spokenLabel(v: DisponibleBlockView): string {
  const parts = [v.pill, `Disponible ${spoken(v.amount)}`, v.perDay, v.payday];
  if (v.approxNote) parts.push(v.approxNote);
  return `${parts.join(". ")}.`;
}

const styles = StyleSheet.create({
  block: { borderRadius: 22, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 14 },
  payday: { fontSize: 14, flexShrink: 1, textAlign: "right" },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, marginTop: 14 },
  number: { fontSize: 56, lineHeight: 64, letterSpacing: -1, marginTop: 4, fontVariant: ["tabular-nums"] },
  perDay: { fontSize: 16, marginTop: 4 },
  sub: { fontSize: 14, marginTop: 6 },
});
