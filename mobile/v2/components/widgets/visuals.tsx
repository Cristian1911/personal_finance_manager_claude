import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { InicioWidgetLevel, InicioWidgetVisual } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";
import type { V2Theme } from "../../tokens";
import { FlowChart } from "./FlowChart";

/** Widget state → token state. */
export const levelColors = (t: V2Theme, level: InicioWidgetLevel | null | undefined) =>
  level === "red" ? t.colors.bad : level === "amber" ? t.colors.warn : null;

/** The collapsed visual of a widget (Claude Design "Z Widget"): bar, initials or Tu flujo's chart. */
export const WidgetVisualView = memo(function WidgetVisualView({ visual }: { visual: InicioWidgetVisual }) {
  switch (visual.kind) {
    case "bar":
      return <Bar percent={visual.percent} level={visual.level} />;
    case "initials":
      return <Initials letters={visual.letters} />;
    case "flow":
      return <FlowChart days={visual.days} todayIndex={visual.todayIndex} markIndex={visual.markIndex} bad={visual.bad} />;
  }
});

function Bar({ percent, level }: { percent: number; level: InicioWidgetLevel | null }) {
  const t = useV2Theme();
  const fill = levelColors(t, level)?.solid ?? t.colors.muted;
  return (
    <View style={[styles.track, { backgroundColor: t.colors.sunk, borderColor: t.colors.line }]}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: fill }]} />
    </View>
  );
}

function Initials({ letters }: { letters: string[] }) {
  const t = useV2Theme();
  return (
    <View style={styles.initials}>
      {letters.map((l, i) => (
        <View
          key={`${l}${i}`}
          style={[styles.initial, { backgroundColor: t.colors.sunk, borderColor: t.colors.card, marginLeft: i ? -5 : 0 }]}
        >
          <Text style={{ color: t.colors.muted, fontFamily: t.fonts.uiSemibold, fontSize: 10 }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "72%", height: 6, borderRadius: 9, overflow: "hidden", borderWidth: 1 },
  fill: { height: "100%", borderRadius: 9 },
  initials: { flexDirection: "row", justifyContent: "center" },
  initial: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
