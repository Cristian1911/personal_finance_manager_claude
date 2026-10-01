import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ChevronLeft } from "lucide-react-native";
import { flowDayView, headerDate, type FlowScreenTab, type FlowTabKey } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";
import { FlowChart } from "./widgets/FlowChart";

/** A swipe this long (sideways, on anything but the chart) changes the cycle. */
const SWIPE_PX = 60;

/**
 * The Tu flujo screen (Claude Design "Z Flujo", S5-2): one cycle at a time
 * (Pasado / Este ciclo / Próximo, tabs or a swipe), the chart with its legend,
 * the cycle's totals, the red run-out and amber next-cycle cards, and the day
 * you tap or drag to. All strings come from flowScreenView (@zeta/shared).
 */
export function FlowScreen({
  tabs,
  today,
  initialTab = "este",
  initialDay = null,
  onBack,
  onAdjust,
  onSetAside,
}: {
  tabs: FlowScreenTab[];
  today: string;
  initialTab?: FlowTabKey;
  /** Gallery only: open with this day selected. */
  initialDay?: number | null;
  onBack: () => void;
  /** "Ver qué ajustar" on the red card. */
  onAdjust: () => void;
  /** "Apartar" on the amber card. */
  onSetAside: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState<FlowTabKey>(initialTab);
  const [selected, setSelected] = useState<number | null>(initialDay);
  const index = Math.max(0, tabs.findIndex((x) => x.key === key));
  const tab = tabs[index];
  const show = (k: number) => {
    const next = tabs[Math.max(0, Math.min(tabs.length - 1, k))];
    if (next.key === key) return;
    setKey(next.key);
    setSelected(null);
  };

  // Sideways swipes change the cycle; on the chart, its own drag wins (it blocks this one).
  const showRef = useRef(show);
  showRef.current = show;
  const indexRef = useRef(index);
  indexRef.current = index;
  const swipe = useMemo(() => Gesture.Pan().runOnJS(true).activeOffsetX([-40, 40]).failOffsetY([-15, 15])
    .onEnd((e) => {
      if (Math.abs(e.translationX) < 2 * Math.abs(e.translationY)) return; // a diagonal scroll, not a swipe
      if (e.translationX <= -SWIPE_PX) showRef.current(indexRef.current + 1);
      else if (e.translationX >= SWIPE_PX) showRef.current(indexRef.current - 1);
    }), []);

  const n = tab?.chart.days.length ?? 0;
  const day = useMemo(
    () => (selected == null || !tab ? null : flowDayView(tab.chart.days[Math.min(selected, n - 1)], today)),
    [tab, selected, n, today],
  );
  if (!tab) return null;
  const dayDate = selected == null ? null : tab.chart.days[Math.min(selected, n - 1)].date;
  const muted = { color: t.colors.muted, fontFamily: t.fonts.uiMedium };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={6} style={[styles.back, { borderColor: t.colors.control }]}>
          <ChevronLeft size={18} color={t.colors.ink} strokeWidth={2.2} />
        </Pressable>
        <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} accessibilityRole="header">Tu flujo</Text>
        <View style={styles.back} />
      </View>

      <GestureDetector gesture={swipe}>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 16 }]}>
          {tabs.length > 1 && (
            <View style={[styles.tabs, { backgroundColor: t.colors.sunk, borderColor: t.colors.line }]} accessibilityRole="tablist">
              {tabs.map((x, k) => {
                const on = k === index;
                return (
                  <Pressable
                    key={x.key}
                    onPress={() => show(k)}
                    hitSlop={{ top: 5, bottom: 5 }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.tab, on && [{ backgroundColor: t.colors.card }, t.shadow]]}
                  >
                    <Text style={{ fontSize: 13, color: on ? t.colors.ink : t.colors.muted, fontFamily: on ? t.fonts.uiSemibold : t.fonts.uiMedium }}>{x.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={[styles.card, styles.chartCard, { backgroundColor: t.colors.card }, t.shadow]}>
            {tab.chart.bad && <View pointerEvents="none" style={[styles.outline, { borderColor: t.colors.bad.solid }]} />}
            <View style={styles.rangeRow}>
              <Text style={{ fontSize: 13, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{tab.range}</Text>
              <Text style={[{ fontSize: 13 }, muted]}>{tab.status}</Text>
            </View>
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Día en Tu flujo"
              accessibilityHint="Desliza arriba o abajo para cambiar de día"
              accessibilityValue={{ text: day ? `${day.label}, ${day.balance.replace(/≈\s/, "aproximadamente ").replace(/−/g, "menos ")}` : "Ningún día" }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={(e) => {
                const step = e.nativeEvent.actionName === "increment" ? 1 : -1;
                setSelected((k) => Math.max(0, Math.min(n - 1, (k ?? Math.max(0, Math.min(n - 1, tab.chart.todayIndex))) + step)));
              }}
            >
              <FlowChart
                days={tab.chart.days}
                todayIndex={tab.chart.todayIndex}
                markIndex={tab.chart.markIndex}
                bad={tab.chart.bad}
                height={220}
                selectedIndex={selected ?? undefined}
                onSelect={setSelected}
                blocks={swipe}
              />
            </View>
            <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Legend label="Hecho" swatch={<View style={[styles.sq, { backgroundColor: t.colors.muted }]} />} />
              <Legend label="Por pagar" swatch={<View style={[styles.sq, { borderWidth: 1.5, borderColor: t.colors.ink }]} />} />
              <Legend label="Gasto estimado" swatch={<View style={[styles.sq, { backgroundColor: t.colors.est }]} />} />
              <Legend label="Corte tarjeta" swatch={<View style={[styles.diamond, { backgroundColor: t.colors.muted }]} />} />
            </View>
          </View>

          <View style={[styles.card, styles.totals, { backgroundColor: t.colors.card }, t.shadow]}>
            {tab.totals.map((x) => (
              <View key={x.label} style={styles.total} accessible accessibilityLabel={`${x.label} ${x.amount.replace(/−/g, "menos ")}`}>
                <Text style={[{ fontSize: 12 }, muted]}>{x.label}</Text>
                <Text style={[styles.totalAmount, { color: x.bad ? t.colors.bad.text : t.colors.ink, fontFamily: t.fonts.numberSemibold }]} numberOfLines={1} adjustsFontSizeToFit>
                  {x.amount}
                </Text>
              </View>
            ))}
          </View>

          {tab.runOut && (
            <View style={[styles.alert, { backgroundColor: t.colors.bad.tint }]} accessibilityRole="alert">
              <Text style={[styles.alertTitle, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{tab.runOut.title}</Text>
              {tab.runOut.body && <Text style={{ fontSize: 14, color: t.colors.ink, fontFamily: t.fonts.uiMedium }}>{tab.runOut.body}</Text>}
              <ActionButton label="Ver qué ajustar" onPress={onAdjust} />
            </View>
          )}

          {tab.nextShort && (
            <View style={[styles.alert, { backgroundColor: t.colors.warn.tint }]}>
              <View style={[styles.chip, { backgroundColor: t.colors.card }]}>
                <View style={[styles.dot, { backgroundColor: t.colors.warn.solid }]} />
                <Text style={{ fontSize: 12, color: t.colors.warn.text, fontFamily: t.fonts.uiSemibold }}>Próximo ciclo</Text>
              </View>
              <Text style={[styles.alertTitle, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{tab.nextShort.title}</Text>
              <Text style={{ fontSize: 13, color: t.colors.ink, fontFamily: t.fonts.uiMedium }}>{tab.nextShort.body}</Text>
              <ActionButton label="Apartar" onPress={onSetAside} />
            </View>
          )}

          {day && dayDate ? (
            <View style={[styles.card, styles.dayCard, { backgroundColor: t.colors.card }, t.shadow]} accessibilityLiveRegion="polite">
              <View style={[styles.dayHead, { borderBottomColor: t.colors.line }]}>
                <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>
                  {headerDate(dayDate)}{dayDate === today ? " · hoy" : ""}
                </Text>
                <Text style={[{ fontSize: 13 }, muted]}>
                  {dayDate < today ? "Terminaste el día con " : "Terminas el día con "}
                  <Text style={{ color: t.colors.ink, fontFamily: t.fonts.numberSemibold }}>{day.balance}</Text>
                </Text>
              </View>
              {day.items.length === 0 && (
                <Text style={[styles.empty, muted]}>Nada este día.</Text>
              )}
              {day.items.map((r) => (
                <View key={r.id} style={[styles.dayRow, { borderBottomColor: t.colors.line }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, color: t.colors.ink, fontFamily: t.fonts.uiMedium }} numberOfLines={1}>{r.title}</Text>
                    <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.ui }}>{r.detail}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: t.colors.ink, fontFamily: t.fonts.numberSemibold, fontVariant: ["tabular-nums"] }}>{r.amount}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.hint, muted]}>
              Arrastra sobre el gráfico para ver cualquier día.{"\n"}Toca un día para ver qué pasa.
            </Text>
          )}
        </ScrollView>
      </GestureDetector>
    </View>
  );
}

function Legend({ label, swatch }: { label: string; swatch: React.ReactNode }) {
  const t = useV2Theme();
  return (
    <View style={styles.legendItem}>
      {swatch}
      <Text style={{ fontSize: 11, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useV2Theme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.button, { backgroundColor: t.colors.button }]}>
      <Text style={{ fontSize: 14, color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 17 },
  body: { paddingHorizontal: 16, gap: 12 },
  tabs: { flexDirection: "row", padding: 3, borderRadius: 12, borderWidth: 1 },
  tab: { flex: 1, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 18 },
  chartCard: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, gap: 10 },
  outline: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 1.5 },
  rangeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 12, rowGap: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  sq: { width: 9, height: 9, borderRadius: 2 },
  diamond: { width: 7, height: 7, transform: [{ rotate: "45deg" }] },
  totals: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 6 },
  total: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  totalAmount: { fontSize: 16, fontVariant: ["tabular-nums"] },
  alert: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  alertTitle: { fontSize: 15, lineHeight: 20 },
  chip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 24, paddingHorizontal: 10, borderRadius: 99 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  button: { height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dayCard: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6, paddingVertical: 8, borderBottomWidth: 1 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1 },
  empty: { fontSize: 13, paddingVertical: 12 },
  hint: { fontSize: 13, lineHeight: 20, textAlign: "center" },
});
