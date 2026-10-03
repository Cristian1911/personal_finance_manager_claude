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
  precision,
  onPrecision,
}: {
  view: DisponibleBlockView;
  open?: boolean;
  onToggle?: () => void;
  dimmed?: boolean;
  /** How real the number is (S10-4); absent once it's Real and nothing is left. */
  precision?: { label: string; percent: number; real: boolean } | null;
  onPrecision?: () => void;
}) {
  const t = useV2Theme();
  const state = t.colors[VERDICT_STATE[view.state]];
  const solid = t.disponibleStyle === "solid";
  const fill = solid ? state.solid : state.tint;
  const accent = solid ? state.onSolid : state.text;
  const strong = solid ? state.onSolid : t.colors.ink;
  const Chevron = open ? ChevronUp : ChevronDown;
  // Until it's Real the number says it's approximate (unless it already does).
  const approx = precision && !precision.real && !view.amount.startsWith("~");
  const amount = approx ? `≈ ${view.amount}` : view.amount;
  const amountShort = approx && view.amountShort ? `≈ ${view.amountShort}` : view.amountShort;

  // The precision chip is a sibling of the block's Pressable, not inside it:
  // nested, a screen reader reads the block as one element and never reaches it.
  return (
    <View style={[styles.block, { backgroundColor: fill, opacity: dimmed ? 0.55 : 1 }, !solid && t.shadow]}>
      <Pressable
        onPress={onToggle}
        disabled={!onToggle}
        accessibilityRole={onToggle ? "button" : "summary"}
        accessibilityState={onToggle ? { expanded: open } : undefined}
        accessibilityLabel={spokenLabel({ ...view, amount }, precision)}
        accessibilityHint={onToggle ? (open ? "Oculta cómo sale tu número" : "Muestra cómo sale tu número") : undefined}
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
        <FittedAmount full={amount} short={amountShort} color={strong} fontFamily={t.fonts.number} size={64} style={styles.number} />

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
      {precision && (
        <Pressable
          onPress={onPrecision}
          disabled={!onPrecision}
          accessibilityRole="button"
          accessibilityLabel={`Precisión de tu número: ${precision.label}, ${precision.percent} por ciento`}
          accessibilityHint="Muestra qué le falta a tu número"
          hitSlop={8}
          style={[styles.precision, { backgroundColor: solid ? "transparent" : t.colors.card, borderColor: accent, borderWidth: solid ? 1.5 : 0 }]}
        >
          <View style={styles.dots}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.pdot, { backgroundColor: i < Math.round(precision.percent / 20) ? strong : solid ? accent : t.colors.est, opacity: i < Math.round(precision.percent / 20) ? 1 : 0.5 }]} />
            ))}
          </View>
          <Text style={{ fontSize: 12, color: strong, fontFamily: t.fonts.uiSemibold }}>{precision.label} · {precision.percent}%</Text>
        </Pressable>
      )}
    </View>
  );
});

/** "~" and "−" read aloud the same way on every screen reader. */
const spoken = (amount: string) => amount.replace("~", "aproximadamente ").replace("≈", "aproximadamente").replace(/−/g, "menos ");

function spokenLabel(v: DisponibleBlockView, precision?: { label: string; percent: number } | null): string {
  const parts = [v.pill, `Disponible ${spoken(v.amount)}`, v.perDay, v.payday];
  if (precision) parts.push(`Precisión: ${precision.label}, ${precision.percent} por ciento`);
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
  precision: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28, paddingHorizontal: 10, borderRadius: 999, marginTop: 10 },
  dots: { flexDirection: "row", gap: 3 },
  pdot: { width: 6, height: 6, borderRadius: 3 },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 10 },
  toggleText: { fontSize: 12 },
});
