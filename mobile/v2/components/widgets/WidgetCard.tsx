import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ChartSpline, ChevronRight, Clock, CreditCard, Receipt, Sun, Users, X, type LucideIcon,
} from "lucide-react-native";
import type { InicioWidget, InicioWidgetKey, InicioWidgetLevel, InicioWidgetRow, WidgetActionId } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";
import { FittedAmount } from "../FittedAmount";
import { levelColors, WidgetVisualView } from "./visuals";

export const WIDGET_ICONS: Record<InicioWidgetKey, LucideIcon> = {
  flujo: ChartSpline, hoy: Sun, pago: Clock, teDeben: Users, tarjeta: CreditCard, ultimos: Receipt,
};

/**
 * One Inicio widget (Claude Design "Z Widget", 13-widget-design-rules.md):
 * title row, one value or visual (+ hint), the attention chip at the bottom,
 * in a fixed 3-row layout so a row of widgets lines up. Red adds a thin full
 * outline; the open half widget a 2px ink outline (never a side stripe).
 * Empty widgets offer their first action. Full widgets open in place; half
 * widgets open into WidgetPanel under their row.
 */
export const WidgetCard = memo(function WidgetCard({
  widget: w,
  open,
  dim,
  onToggle,
  onAction,
  editInset = false,
}: {
  widget: InicioWidget;
  open: boolean;
  dim: boolean;
  onToggle: (id: string) => void;
  onAction?: (id: WidgetActionId) => void;
  /** Organizar: room on top for the drag handle and the size/remove buttons. */
  editInset?: boolean;
}) {
  const t = useV2Theme();
  const Icon = WIDGET_ICONS[w.key];
  const full = w.size === "full";
  const outline = w.attention?.level === "red"
    ? { borderColor: t.colors.bad.solid, borderWidth: 1.5 }
    : open && !full ? { borderColor: t.colors.ink, borderWidth: 2 } : null;
  const firstAction = w.empty ? w.actions[0] : undefined;

  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, opacity: dim ? 0.38 : 1 }, t.shadow]}>
      {/* The summary is one labelled button; the expanded body stays outside it so screen readers reach its rows. */}
      <Pressable
        onPress={() => onToggle(w.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={spokenLabel(w)}
        // The action chip sits inside this button; screen readers get it as an action.
        accessibilityActions={firstAction && onAction ? [{ name: "action", label: firstAction.label }] : undefined}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "action" && firstAction && onAction) onAction(firstAction.id);
        }}
        style={[styles.press, editInset && styles.pressEdit]}
      >
        <View style={styles.head}>
          <Icon size={16} color={t.colors.ink} strokeWidth={2} />
          <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} numberOfLines={1}>{w.title}</Text>
        </View>

        <View style={styles.middle}>
          {w.visual?.kind === "flow" ? (
            <WidgetVisualView visual={w.visual} />
          ) : (
            <>
              {w.value && (
                <FittedAmount
                  full={w.value}
                  short={w.valueShort ?? w.value}
                  color={t.colors.ink}
                  fontFamily={t.fonts.numberSemibold}
                  size={24}
                  align="center"
                  style={styles.value}
                />
              )}
              {w.hint && (
                <Text style={[styles.hint, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]} numberOfLines={1}>{w.hint}</Text>
              )}
              {w.visual && <WidgetVisualView visual={w.visual} />}
              {w.previewRows.length > 0 && !open && <Rows rows={w.previewRows} compact />}
            </>
          )}
        </View>

        <View style={styles.foot}>
          {w.attention && <Chip level={w.attention.level} text={w.attention.reason} />}
          {!w.attention && firstAction && onAction && (
            <Pressable
              onPress={() => onAction(firstAction.id)}
              accessibilityRole="button"
              hitSlop={6}
              style={[styles.actionChip, { borderColor: t.colors.control }]}
            >
              <Text style={[styles.actionChipText, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} numberOfLines={1}>
                {firstAction.label}
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
      {full && open && <WidgetBody widget={w} onAction={onAction} />}
      {outline && <View pointerEvents="none" style={[styles.outline, outline]} />}
    </View>
  );
});

/** A half widget opened: a full-width panel under its row, with a close button. */
export const WidgetPanel = memo(function WidgetPanel({
  widget: w,
  onClose,
  onAction,
}: {
  widget: InicioWidget;
  onClose: () => void;
  onAction?: (id: WidgetActionId) => void;
}) {
  const t = useV2Theme();
  const Icon = WIDGET_ICONS[w.key];
  return (
    <View style={[styles.panel, { backgroundColor: t.colors.card }, t.shadow]} accessibilityLiveRegion="polite">
      <View style={styles.panelHead}>
        <Icon size={18} color={t.colors.ink} strokeWidth={2} />
        <Text style={[styles.panelTitle, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} accessibilityRole="header">{w.title}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Cerrar ${w.title}`}
          hitSlop={10}
          style={[styles.close, { borderColor: t.colors.control }]}
        >
          <X size={14} color={t.colors.ink} strokeWidth={2.2} />
        </Pressable>
      </View>
      <WidgetBody widget={w} onAction={onAction} />
    </View>
  );
});

/** The expanded view: lead, rows, totals, note, empty-state actions, "Ver todo". */
export const WidgetBody = memo(function WidgetBody({
  widget: w,
  onAction,
}: {
  widget: InicioWidget;
  onAction?: (id: WidgetActionId) => void;
}) {
  const t = useV2Theme();
  const chart = w.key === "flujo";
  return (
    <View style={[styles.body, chart && [styles.chartBody, { borderTopColor: t.colors.line }]]}>
      {w.lead && <Text style={[styles.lead, { color: t.colors.ink, fontFamily: t.fonts.uiMedium }]}>{w.lead}</Text>}
      {w.totals.length > 0 && (
        <View style={styles.totals}>
          {w.totals.map((x) => (
            <View key={x.label} style={styles.total}>
              <Text style={[styles.totalLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>{x.label}</Text>
              <Text style={[styles.totalValue, { color: t.colors.ink, fontFamily: t.fonts.numberSemibold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>{x.amount}</Text>
            </View>
          ))}
        </View>
      )}
      {w.rows.length > 0 && <Rows rows={w.rows} />}
      {w.note && <Text style={[styles.note, { color: t.colors.muted, fontFamily: t.fonts.ui }]}>{w.note}</Text>}
      {w.empty && w.actions.length > 0 && onAction && (
        <View style={styles.actions}>
          {w.actions.map((a, i) => (
            <Pressable
              key={a.id}
              onPress={() => onAction(a.id)}
              accessibilityRole="button"
              style={[styles.action, i === 0 ? { backgroundColor: t.colors.button } : { borderWidth: 1.5, borderColor: t.colors.control }]}
            >
              <Text style={[styles.actionText, { color: i === 0 ? t.colors.onButton : t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {w.seeAll && onAction && (
        <Pressable onPress={() => onAction(w.seeAll!)} accessibilityRole="link" style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Ver todo</Text>
          <ChevronRight size={14} color={t.colors.ink} strokeWidth={2.2} />
        </Pressable>
      )}
    </View>
  );
});

function Rows({ rows, compact }: { rows: InicioWidgetRow[]; compact?: boolean }) {
  const t = useV2Theme();
  return (
    <View style={styles.rows}>
      {rows.map((r, i) => (
        <View
          key={r.id}
          style={[styles.rowLine, !compact && { borderBottomWidth: 1, borderBottomColor: t.colors.line }, compact && i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.line }]}
          accessible
          accessibilityLabel={`${r.title}${r.detail ? `, ${r.detail}` : ""}: ${spoken(r.amount)}${r.level === "red" ? ", crítico" : r.level === "amber" ? ", atención" : ""}`}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: t.colors.ink, fontFamily: t.fonts.uiMedium }]} numberOfLines={1}>{r.title}</Text>
            {!!r.detail && <Text style={[styles.rowDetail, { color: t.colors.muted, fontFamily: t.fonts.ui }]} numberOfLines={1}>{r.detail}</Text>}
          </View>
          {r.level && <View style={[styles.dot, { backgroundColor: levelColors(t, r.level)!.solid }]} />}
          <Text style={[styles.amount, { color: t.colors.ink, fontFamily: t.fonts.numberSemibold }]}>{r.amount}</Text>
        </View>
      ))}
    </View>
  );
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

const spoken = (s: string) => s.replace(/−/g, "menos ").replace(/≈\s/g, "aproximadamente ");

function spokenLabel(w: InicioWidget): string {
  const parts = [w.title];
  if (w.value) parts.push(spoken(w.value));
  if (w.hint) parts.push(w.hint);
  if (w.attention) parts.push(w.attention.reason);
  return `${parts.map((p) => p.replace(/\.$/, "")).join(". ")}.`;
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 18 },
  outline: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 18 },
  press: { flexGrow: 1, minHeight: 120, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12, alignItems: "center" },
  pressEdit: { paddingTop: 42 },
  head: { height: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "stretch" },
  title: { fontSize: 13, flexShrink: 1 },
  middle: { flexGrow: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", gap: 2, marginVertical: 8 },
  value: { lineHeight: 32, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  hint: { fontSize: 12, lineHeight: 20, textAlign: "center", marginBottom: 2 },
  foot: { minHeight: 24, alignItems: "center", justifyContent: "flex-end" },
  chip: { height: 24, paddingHorizontal: 10, borderRadius: 99, justifyContent: "center", maxWidth: "100%" },
  chipText: { fontSize: 12 },
  actionChip: { height: 28, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1.5, justifyContent: "center", maxWidth: "100%" },
  actionChipText: { fontSize: 12 },
  panel: { borderRadius: 18, paddingBottom: 4 },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 14, paddingTop: 14, paddingBottom: 4 },
  panelTitle: { flex: 1, fontSize: 15 },
  close: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 16, paddingTop: 4 },
  chartBody: { borderTopWidth: 1, marginHorizontal: 16, paddingHorizontal: 0, paddingTop: 10 },
  lead: { fontSize: 14, lineHeight: 20, paddingTop: 6, paddingBottom: 4 },
  totals: { flexDirection: "row", gap: 6, paddingVertical: 6 },
  total: { flex: 1, alignItems: "center" },
  totalLabel: { fontSize: 12 },
  totalValue: { fontSize: 15, fontVariant: ["tabular-nums"] },
  rows: { alignSelf: "stretch" },
  rowLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14 },
  rowDetail: { fontSize: 12, marginTop: 1 },
  amount: { fontSize: 14, fontVariant: ["tabular-nums"] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  note: { fontSize: 13, lineHeight: 18, paddingTop: 10 },
  actions: { gap: 8, paddingTop: 10 },
  action: { height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 15 },
  seeAll: { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  seeAllText: { fontSize: 14 },
});
