import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { DetailPart, DetailPartKey, DisponibleDetailView } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";
import type { V2Theme } from "../tokens";

/** One color per part, shared by the bar and its row. */
function partColor(t: V2Theme, key: DetailPartKey): { fill: string; outline?: string } {
  switch (key) {
    case "porPagar": return { fill: t.colors.ink };
    case "ahorro": return { fill: t.colors.muted };
    case "gastado": return { fill: t.colors.est, outline: t.colors.control };
    case "cicloPasado": return { fill: t.colors.bad.solid };
    case "queda": return { fill: t.colors.ok.solid };
  }
}

/**
 * How the Disponible comes out (owner's pick, mockup
 * claude-ai-design/v2-hero-detalle/mezcla.html): "De tus $X de este ciclo",
 * one bar the commitments eat in order, rows that open to show what's
 * inside. The open row glows and its part of the bar stays lit while the
 * rest dims. One row open at a time.
 */
export const DisponibleDetail = memo(function DisponibleDetail({
  detail,
  onSeeAll,
  initialOpen = null,
}: {
  detail: DisponibleDetailView;
  onSeeAll?: (key: DetailPartKey) => void;
  /** Gallery: a row open from the start. */
  initialOpen?: DetailPartKey | null;
}) {
  const t = useV2Theme();
  const [open, setOpen] = useState<DetailPartKey | null>(initialOpen);
  const toggle = useCallback((key: DetailPartKey) => setOpen((o) => (o === key ? null : key)), []);

  const rows = detail.parts.filter((p) => p.key !== "queda");
  const result = detail.result;
  const resultTone = result.over ? t.colors.bad : t.colors.ok;
  const resultOpen = open === "queda";

  return (
    <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
      <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} accessibilityRole="header">
        {detail.title}
      </Text>

      <View style={styles.bar} accessible accessibilityLabel={barLabel(detail)}>
        {detail.parts.filter((p) => p.weight > 0).map((p) => {
          const c = partColor(t, p.key);
          const lit = open === null || open === p.key;
          return (
            <View
              key={p.key}
              style={[
                styles.segment,
                { flex: p.weight, backgroundColor: c.fill, opacity: lit ? 1 : 0.22 },
                c.outline && { borderWidth: 1.5, borderColor: c.outline },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.scale}>
        <Text style={[styles.scaleText, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>$0</Text>
        <Text style={[styles.scaleText, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>{detail.scaleEnd}</Text>
      </View>

      {rows.map((p) => (
        <PartRow key={p.key} part={p} open={open === p.key} onToggle={toggle} onSeeAll={onSeeAll} />
      ))}

      <Animated.View layout={LinearTransition.duration(240)}>
      <Pressable
        onPress={() => toggle("queda")}
        accessibilityRole="button"
        accessibilityState={{ expanded: resultOpen }}
        accessibilityLabel={`${result.label}: ${result.amount.replace(/−/g, "menos ")}. ${result.sub}`}
        style={[
          styles.result,
          { backgroundColor: resultTone.tint },
          resultOpen && [styles.glow, { borderColor: resultTone.solid, shadowColor: resultTone.solid }],
        ]}
      >
        <View style={styles.resultTop}>
          <View style={[styles.swatch, { backgroundColor: resultTone.solid }]} />
          <Text style={[styles.resultLabel, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{result.label}</Text>
          <Text style={[styles.resultAmount, { color: t.colors.ink, fontFamily: t.fonts.numberSemibold }]}>{result.amount}</Text>
        </View>
        {resultOpen && (
          <Animated.Text entering={FadeIn.duration(200)} style={[styles.resultSub, { color: resultTone.text, fontFamily: t.fonts.uiMedium }]}>
            {result.sub}
          </Animated.Text>
        )}
      </Pressable>
      </Animated.View>
    </View>
  );
});

function PartRow({
  part: p,
  open,
  onToggle,
  onSeeAll,
}: {
  part: DetailPart;
  open: boolean;
  onToggle: (key: DetailPartKey) => void;
  onSeeAll?: (key: DetailPartKey) => void;
}) {
  const t = useV2Theme();
  const c = partColor(t, p.key);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <Animated.View layout={LinearTransition.duration(240)} style={[styles.rowWrap, { borderTopColor: t.colors.line }]}>
      {/* The glow is on this wrapper; the items sit outside the row's button so screen readers reach them. */}
      <View style={[styles.row, open && [styles.glow, { backgroundColor: t.colors.sunk, borderColor: c.outline ?? c.fill, shadowColor: c.outline ?? c.fill }]]}>
        <Pressable
          onPress={() => onToggle(p.key)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${p.label}: ${p.amount}. ${p.sub}`}
          style={styles.rowTop}
        >
          <View style={[styles.swatch, { backgroundColor: c.fill }, c.outline && { borderWidth: 1.5, borderColor: c.outline }]} />
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: t.colors.ink, fontFamily: t.fonts.uiMedium }]}>{p.label}</Text>
            <Text style={[styles.rowSub, { color: t.colors.muted, fontFamily: t.fonts.ui }]}>{p.sub}</Text>
          </View>
          <Text style={[styles.rowAmount, { color: t.colors.ink, fontFamily: t.fonts.numberSemibold }]}>{p.amount}</Text>
          <View style={[styles.chev, { borderColor: t.colors.control }]}>
            <Chevron size={14} color={t.colors.ink} strokeWidth={2.2} />
          </View>
        </Pressable>

        {open && (
          <Animated.View
            entering={FadeInDown.duration(220)}
            exiting={FadeOut.duration(120)}
            style={[styles.items, { backgroundColor: t.colors.card }]}
          >
            {p.items.length === 0 && (
              <Text style={[styles.itemText, { color: t.colors.muted, fontFamily: t.fonts.ui }]}>Nada por aquí todavía.</Text>
            )}
            {p.items.map((it) => (
              <View key={it.id} style={styles.item} accessibilityLabel={`${it.title}${it.detail ? `, ${it.detail}` : ""}: ${it.amount}${it.done ? ", pagado" : ""}`} accessible>
                <Text
                  style={[styles.itemText, styles.itemTitle, { color: t.colors.muted, fontFamily: t.fonts.ui }, it.done && styles.done]}
                  numberOfLines={1}
                >
                  {it.detail ? `${it.title} · ${it.detail}` : it.title}
                </Text>
                <Text style={[styles.itemText, { color: t.colors.ink, fontFamily: t.fonts.ui }, it.done && styles.done]}>{it.amount}</Text>
              </View>
            ))}
            {p.more && onSeeAll && (
              <Pressable onPress={() => onSeeAll(p.key)} accessibilityRole="link" hitSlop={8} style={styles.more}>
                <Text style={[styles.itemText, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{p.more}</Text>
              </Pressable>
            )}
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

function barLabel(d: DisponibleDetailView): string {
  return `${d.title}: ${d.parts.map((p) => `${p.label} ${p.amount}`).join(", ")}.`;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  title: { fontSize: 15 },
  bar: { flexDirection: "row", gap: 2, height: 20, borderRadius: 7, overflow: "hidden", marginTop: 12 },
  segment: { height: "100%" },
  scale: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  scaleText: { fontSize: 11.5 },
  rowWrap: { borderTopWidth: 1, paddingVertical: 4 },
  row: { borderRadius: 14, borderWidth: 1.5, borderColor: "transparent", paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: -8 },
  glow: { borderWidth: 1.5, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 1 },
  rowAmount: { fontSize: 14, fontVariant: ["tabular-nums"] },
  chev: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  items: { marginTop: 9, marginLeft: 22, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, gap: 7 },
  item: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  itemText: { fontSize: 13, fontVariant: ["tabular-nums"] },
  itemTitle: { flexShrink: 1 },
  done: { textDecorationLine: "line-through" },
  more: { alignItems: "center", paddingTop: 2 },
  result: { borderRadius: 14, borderWidth: 1.5, borderColor: "transparent", padding: 12, marginTop: 6 },
  resultTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  resultLabel: { flex: 1, fontSize: 15 },
  resultAmount: { fontSize: 17, fontVariant: ["tabular-nums"] },
  resultSub: { fontSize: 13, marginTop: 6, marginLeft: 22 },
});
