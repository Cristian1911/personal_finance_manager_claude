import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { DisponibleBlockView } from "@zeta/shared";
import { VERDICT_STATE } from "../tokens";
import { useV2Theme } from "../theme/ThemeProvider";
import { FittedAmount } from "./FittedAmount";

/**
 * The fixed block on top of Inicio (S5-4, Claude Design "Z Disponible"):
 * verdict pill, payday, the one big number, "$35.000 al día" and
 * "+$X cuando te paguen". Tapping it opens how the number comes out
 * (DisponibleDetail). Oliva tints the card with the state; Nítido fills it
 * solid. Only this number is heavy (S5-R). All copy comes from
 * disponibleBlockView (@zeta/shared).
 */
export const DisponibleBlock = memo(function DisponibleBlock({
  view,
  open = false,
  onToggle,
  dimmed = false,
}: {
  view: DisponibleBlockView;
  open?: boolean;
  onToggle?: () => void;
  dimmed?: boolean;
}) {
  const t = useV2Theme();
  const state = t.colors[VERDICT_STATE[view.state]];
  const solid = t.disponibleStyle === "solid";
  const fill = solid ? state.solid : state.tint;
  const accent = solid ? state.onSolid : state.text;
  const strong = solid ? state.onSolid : t.colors.ink;
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <Pressable
      onPress={onToggle}
      disabled={!onToggle}
      accessibilityRole={onToggle ? "button" : "summary"}
      accessibilityState={onToggle ? { expanded: open } : undefined}
      accessibilityLabel={spokenLabel(view)}
      accessibilityHint={onToggle ? (open ? "Oculta cómo sale tu número" : "Muestra cómo sale tu número") : undefined}
      style={[styles.block, { backgroundColor: fill, opacity: dimmed ? 0.55 : 1 }, !solid && t.shadow]}
    >
      <View style={styles.top}>
        <View style={[styles.pill, solid ? { borderWidth: 1.5, borderColor: accent } : { backgroundColor: t.colors.card }]}>
          <View style={[styles.dot, { backgroundColor: solid ? accent : state.solid }]} />
          <Text style={[styles.pillText, { color: accent, fontFamily: t.fonts.uiSemibold }]}>{view.pill}</Text>
        </View>
        <Text style={[styles.payday, { color: accent, fontFamily: t.fonts.uiMedium }]} numberOfLines={1}>
          {view.payday}
        </Text>
      </View>

      <Text style={[styles.label, { color: strong, fontFamily: t.fonts.uiSemibold }]}>Disponible</Text>
      <FittedAmount full={view.amount} short={view.amountShort} color={strong} fontFamily={t.fonts.number} size={64} style={styles.number} />

      <View style={styles.bottom}>
        <Text style={[styles.meta, { color: accent, fontFamily: t.fonts.uiMedium }]}>
          {view.perDayAmount && (
            <Text style={{ color: strong, fontFamily: t.fonts.numberSemibold, fontSize: 14 }}>{view.perDayAmount} </Text>
          )}
          {view.perDayRest}
        </Text>
        {view.sub && <Text style={[styles.meta, { color: accent, fontFamily: t.fonts.uiMedium }]}>{view.sub}</Text>}
      </View>
      {view.approxNote && (
        <Text style={[styles.meta, styles.approx, { color: accent, fontFamily: t.fonts.ui }]}>~ {view.approxNote}</Text>
      )}
      {onToggle && (
        <View style={styles.toggle}>
          <Text style={[styles.toggleText, { color: accent, fontFamily: t.fonts.uiSemibold }]}>{open ? "Ocultar" : "Cómo sale"}</Text>
          <Chevron size={14} color={accent} strokeWidth={2.4} />
        </View>
      )}
    </Pressable>
  );
});

/** "~" and "−" read aloud the same way on every screen reader. */
const spoken = (amount: string) => amount.replace("~", "aproximadamente ").replace(/−/g, "menos ");

function spokenLabel(v: DisponibleBlockView): string {
  const parts = [v.pill, `Disponible ${spoken(v.amount)}`, v.perDay, v.payday];
  if (v.sub) parts.push(spoken(v.sub));
  if (v.approxNote) parts.push(v.approxNote);
  return `${parts.join(". ")}.`;
}

const styles = StyleSheet.create({
  block: { borderRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 7, height: 28, paddingHorizontal: 12, borderRadius: 999 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13 },
  payday: { fontSize: 13, flexShrink: 1, textAlign: "right" },
  label: { fontSize: 14, marginTop: 14 },
  number: { letterSpacing: -2, marginTop: 2, fontVariant: ["tabular-nums"] },
  bottom: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 10, rowGap: 4, marginTop: 12 },
  meta: { fontSize: 13 },
  approx: { marginTop: 6 },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 10 },
  toggleText: { fontSize: 12 },
});
