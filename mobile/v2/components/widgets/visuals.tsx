import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import type { InicioWidgetLevel, InicioWidgetVisual } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";
import type { V2Theme } from "../../tokens";

/** Widget state → token state. */
export const levelColors = (t: V2Theme, level: InicioWidgetLevel | null | undefined) =>
  level === "red" ? t.colors.bad : level === "amber" ? t.colors.warn : null;

/** The collapsed visual of a widget: bar, initials or mini line (13 §Content). */
export const WidgetVisualView = memo(function WidgetVisualView({ visual }: { visual: InicioWidgetVisual }) {
  switch (visual.kind) {
    case "bar":
      return <Bar percent={visual.percent} level={visual.level} />;
    case "initials":
      return <Initials letters={visual.letters} />;
    case "line":
      return <MiniLine points={visual.points} todayIndex={visual.todayIndex} />;
  }
});

function Bar({ percent, level }: { percent: number; level: InicioWidgetLevel | null }) {
  const t = useV2Theme();
  const fill = levelColors(t, level)?.solid ?? t.colors.muted;
  return (
    <View style={[styles.track, { backgroundColor: t.colors.sunk }]}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: fill }]} />
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
          style={[styles.initial, { backgroundColor: t.colors.sunk, borderColor: t.colors.card, marginLeft: i ? -6 : 0 }]}
        >
          <Text style={{ color: t.colors.ink, fontFamily: t.fonts.uiSemibold, fontSize: 12 }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

const LINE_HEIGHT = 44;

/** Day-by-day amounts: solid up to today, dashed after; a red zero line when it goes below $0. */
function MiniLine({ points, todayIndex }: { points: number[]; todayIndex: number }) {
  const t = useV2Theme();
  const [width, setWidth] = useState(0);
  const below = points.some((p) => p < 0);
  const lo = Math.min(...points, below ? 0 : Infinity);
  const hi = Math.max(...points);
  const span = hi - lo || 1;
  const pad = 4;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / Math.max(1, points.length - 1);
  const y = (v: number) => pad + ((hi - v) * (LINE_HEIGHT - 2 * pad)) / span;
  const path = (from: number, to: number) => points.slice(from, to + 1).map((v, k) => `${x(from + k)},${y(v)}`).join(" ");
  const future = below ? t.colors.bad.solid : t.colors.muted;

  return (
    <View style={{ height: LINE_HEIGHT, alignSelf: "stretch" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={LINE_HEIGHT}>
          {below && <Line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke={t.colors.bad.solid} strokeWidth={1} strokeDasharray="2 3" />}
          <Polyline points={path(0, todayIndex)} fill="none" stroke={t.colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {todayIndex < points.length - 1 && (
            <Polyline points={path(todayIndex, points.length - 1)} fill="none" stroke={future} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />
          )}
          <Circle cx={x(todayIndex)} cy={y(points[todayIndex])} r={3.5} fill={t.colors.ink} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 9, overflow: "hidden", alignSelf: "stretch" },
  fill: { height: "100%", borderRadius: 9 },
  initials: { flexDirection: "row", justifyContent: "center" },
  initial: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
