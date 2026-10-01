import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChartSpline, Clock, CreditCard, Receipt, Sun, Users, type LucideIcon } from "lucide-react-native";
import type { InicioWidget, InicioWidgetKey, InicioWidgetLevel, InicioWidgetRow } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";
import { FittedAmount } from "../FittedAmount";
import { levelColors, WidgetVisualView } from "./visuals";

const ICONS: Record<InicioWidgetKey, LucideIcon> = {
  flujo: ChartSpline, hoy: Sun, pago: Clock, teDeben: Users, tarjeta: CreditCard, ultimos: Receipt,
};

/**
 * One Inicio widget, collapsed (13-widget-design-rules.md): icon + title, one
 * value or visual, a ≤3-word hint, the attention chip at the bottom; red adds
 * a thin full outline (never a side stripe). Full widgets expand in place;
 * half widgets expand into InicioWidgetGrid's panel under their row.
 */
export const WidgetCard = memo(function WidgetCard({
  widget: w,
  open,
  dim,
  onToggle,
}: {
  widget: InicioWidget;
  open: boolean;
  dim: boolean;
  onToggle: (id: string) => void;
}) {
  const t = useV2Theme();
  const Icon = ICONS[w.key];
  const red = w.attention?.level === "red";
  const full = w.size === "full";
  const outline = red
    ? { borderColor: t.colors.bad.solid }
    : open && !full ? { borderColor: t.colors.control } : { borderColor: "transparent" };

  return (
    <Pressable
      onPress={() => onToggle(w.id)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={spokenLabel(w)}
      style={[styles.card, { backgroundColor: t.colors.card, opacity: dim ? 0.38 : 1 }, outline, t.shadow]}
    >
      <View style={styles.head}>
        <Icon size={16} color={t.colors.muted} strokeWidth={2} />
        <Text style={[styles.title, { color: t.colors.muted, fontFamily: t.fonts.uiSemibold }]} numberOfLines={1}>
          {w.title}
        </Text>
      </View>

      <View style={styles.middle}>
        {w.value && (
          <FittedAmount
            full={w.value}
            short={w.value}
            color={t.colors.ink}
            fontFamily={t.fonts.uiSemibold}
            size={16}
            align="center"
            style={styles.value}
          />
        )}
        {w.visual && <WidgetVisualView visual={w.visual} />}
        {w.caption && (
          <Text style={[styles.caption, { color: t.colors.ink, fontFamily: t.fonts.ui }]}>{w.caption}</Text>
        )}
        {w.hint && (
          <Text
            style={[w.empty ? styles.emptyHint : styles.hint, { color: t.colors.muted, fontFamily: t.fonts.ui }]}
            numberOfLines={2}
          >
            {w.hint}
          </Text>
        )}
        {w.previewRows.length > 0 && !open && <Rows rows={w.previewRows} />}
      </View>

      {w.attention && <Chip level={w.attention.level} text={w.attention.reason} />}
      {full && open && <WidgetBody widget={w} />}
    </Pressable>
  );
});

/** The expanded view: lead, rows, totals, note (13 §Content). */
export const WidgetBody = memo(function WidgetBody({ widget: w }: { widget: InicioWidget }) {
  const t = useV2Theme();
  return (
    <View style={styles.body}>
      {w.lead && <Text style={[styles.lead, { color: t.colors.ink, fontFamily: t.fonts.ui }]}>{w.lead}</Text>}
      {w.rows.length > 0 && <Rows rows={w.rows} />}
      {w.totals.length > 0 && (
        <View style={[styles.totals, { borderTopColor: t.colors.line }]}>
          {w.totals.map((x, i) => {
            const last = i === w.totals.length - 1;
            return (
              <View key={x.label} style={styles.rowLine}>
                <Text style={[styles.rowTitle, styles.rowText, { color: last ? t.colors.ink : t.colors.muted, fontFamily: last ? t.fonts.uiSemibold : t.fonts.ui }]}>{x.label}</Text>
                <Text style={[styles.amount, { color: t.colors.ink, fontFamily: last ? t.fonts.uiSemibold : t.fonts.ui }]}>{x.amount}</Text>
              </View>
            );
          })}
        </View>
      )}
      {w.note && <Text style={[styles.note, { color: t.colors.muted, fontFamily: t.fonts.ui }]}>{w.note}</Text>}
    </View>
  );
});

function Rows({ rows }: { rows: InicioWidgetRow[] }) {
  const t = useV2Theme();
  return (
    <View style={styles.rows}>
      {rows.map((r) => (
        <View key={r.id} style={styles.rowLine}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: t.colors.ink, fontFamily: t.fonts.uiMedium }]} numberOfLines={1}>{r.title}</Text>
            {!!r.detail && (
              <Text style={[styles.rowDetail, { color: t.colors.muted, fontFamily: t.fonts.ui }]} numberOfLines={1}>{r.detail}</Text>
            )}
          </View>
          {r.level && <Dot level={r.level} />}
          <Text style={[styles.amount, { color: t.colors.ink, fontFamily: t.fonts.ui }]}>{r.amount}</Text>
        </View>
      ))}
    </View>
  );
}

function Dot({ level }: { level: InicioWidgetLevel }) {
  const t = useV2Theme();
  return <View style={[styles.dot, { backgroundColor: levelColors(t, level)!.solid }]} accessibilityLabel={level === "red" ? "crítico" : "atención"} />;
}

function Chip({ level, text }: { level: InicioWidgetLevel; text: string }) {
  const t = useV2Theme();
  const c = levelColors(t, level)!;
  return (
    <View style={[styles.chip, { backgroundColor: c.tint }]}>
      <Text style={[styles.chipText, { color: c.text, fontFamily: t.fonts.uiSemibold }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const spoken = (s: string) => s.replace("−", "menos ").replace(/≈\s/, "aproximadamente ");

function spokenLabel(w: InicioWidget): string {
  const parts = [w.title];
  if (w.value) parts.push(spoken(w.value));
  if (w.caption) parts.push(w.caption);
  if (w.hint) parts.push(w.hint);
  if (w.attention) parts.push(w.attention.reason);
  return `${parts.map((p) => p.replace(/\.$/, "")).join(". ")}.`;
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, alignItems: "center" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "stretch" },
  title: { fontSize: 13, flexShrink: 1 },
  middle: { flexGrow: 1, alignSelf: "stretch", alignItems: "center", gap: 6, marginTop: 10 },
  value: { fontSize: 16, fontVariant: ["tabular-nums"] },
  caption: { fontSize: 13, lineHeight: 18, textAlign: "center" },
  hint: { fontSize: 10, textAlign: "center" },
  emptyHint: { fontSize: 13, textAlign: "center" },
  chip: { height: 24, paddingHorizontal: 10, borderRadius: 99, justifyContent: "center", marginTop: 10, maxWidth: "100%" },
  chipText: { fontSize: 12 },
  body: { alignSelf: "stretch", marginTop: 12, gap: 10 },
  lead: { fontSize: 14, lineHeight: 20 },
  rows: { alignSelf: "stretch", gap: 2 },
  rowLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14 },
  rowDetail: { fontSize: 12, marginTop: 1 },
  amount: { fontSize: 14, fontVariant: ["tabular-nums"] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  totals: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  note: { fontSize: 13, lineHeight: 18 },
});
