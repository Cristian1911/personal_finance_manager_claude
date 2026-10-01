import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import { LayoutAnimation, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import type { InicioWidget } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";
import { WidgetBody, WidgetCard } from "./WidgetCard";

/** Full widgets take a row; half widgets pair up in layout order (13 §Layout). */
function packRows(widgets: InicioWidget[]): InicioWidget[][] {
  const rows: InicioWidget[][] = [];
  let pending: InicioWidget | null = null;
  for (const w of widgets) {
    if (w.size === "full") {
      if (pending) rows.push([pending]);
      pending = null;
      rows.push([w]);
    } else if (pending) {
      rows.push([pending, w]);
      pending = null;
    } else {
      pending = w;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}

/**
 * Inicio's 2-column widget grid. One widget open at a time: a half widget
 * opens a full-width panel under its row and dims its neighbour; a full
 * widget opens in place. `autoOpen` (the most critical, once a day) opens
 * itself when the screen loads.
 */
export const InicioWidgetGrid = memo(function InicioWidgetGrid({
  widgets,
  autoOpen,
}: {
  widgets: InicioWidget[];
  autoOpen?: string | null;
}) {
  const t = useV2Theme();
  const [open, setOpen] = useState<string | null>(() => autoOpen ?? null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (autoOpen) setOpen(autoOpen);
  }, [autoOpen]);

  const toggle = useCallback((id: string) => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => (o === id ? null : id));
  }, [reduceMotion]);
  const rows = useMemo(() => packRows(widgets), [widgets]);

  return (
    <View style={styles.grid}>
      {rows.map((row) => {
        const openHalf = row.find((w) => w.size === "half" && w.id === open) ?? null;
        return (
          <Fragment key={row.map((w) => w.id).join("+")}>
            <View style={styles.row}>
              {row.map((w) => (
                <View key={w.id} style={styles.cell}>
                  <WidgetCard widget={w} open={open === w.id} dim={!!openHalf && openHalf.id !== w.id} onToggle={toggle} />
                </View>
              ))}
              {row.length === 1 && row[0].size === "half" && <View style={styles.cell} />}
            </View>
            {openHalf && (
              <View style={[styles.panel, { backgroundColor: t.colors.card }, t.shadow]} accessibilityLiveRegion="polite">
                <Text style={[styles.panelTitle, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} accessibilityRole="header">
                  {openHalf.title}
                </Text>
                <WidgetBody widget={openHalf} />
              </View>
            )}
          </Fragment>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { gap: 12 },
  row: { flexDirection: "row", gap: 12 },
  cell: { flex: 1 },
  panel: { borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  panelTitle: { fontSize: 15 },
});
