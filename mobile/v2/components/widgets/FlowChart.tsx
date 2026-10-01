import { memo, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import type { FlowDay } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";

/**
 * Tu flujo's chart, mini (Claude Design "Z Grafico"): shaded edge days, the
 * counted balance (solid to today, dashed after, a soft area under it), money
 * in as bars up (filled = arrived, outlined = expected), money out as bars
 * down (filled = spent, outlined = bills, light = estimated), today's dotted
 * line, a ring at the lowest point (or where it runs out, in red), and a
 * diamond on card cuts.
 */
export const FlowChart = memo(function FlowChart({
  days,
  todayIndex,
  markIndex,
  bad,
  height = 80,
  selectedIndex,
  onSelect,
}: {
  days: FlowDay[];
  todayIndex: number;
  markIndex: number;
  bad: boolean;
  height?: number;
  /** The day being read (open widget); undefined = no selection drawn. */
  selectedIndex?: number;
  /** Tap or drag sideways to pick a day. Vertical drags stay with the page scroll. */
  onSelect?: (index: number) => void;
}) {
  const t = useV2Theme();
  const [W, setW] = useState(0);
  const H = height;
  const n = days.length;
  const draw = W > 0 && n > 0;

  const s = W / Math.max(1, n);
  const top = 6;
  const y0 = Math.round(H * 0.64);
  const up = y0 - top;
  const dn = H - y0 - 3;
  const maxBal = Math.max(1, ...days.map((d) => d.balance));
  const yB = (v: number) => Math.min(H - 2, y0 - (v / maxBal) * up);
  const xs = (i: number) => i * s + s / 2;
  const maxIn = Math.max(1, ...days.map((d) => Math.max(d.income, d.incomeExpected)));
  const maxOut = Math.max(1, ...days.map((d) => Math.max(d.spent, d.bill, d.estimated)));
  const hIn = (v: number) => Math.max(2, (v / maxIn) * up * 0.4);
  const hOut = (v: number) => Math.max(2, Math.min(dn, (v / maxOut) * dn * 0.9));
  const pts = days.map((d, i) => [xs(i), yB(d.balance)] as const);
  const path = (a: (readonly [number, number])[]) => a.map(([x, y], j) => `${j ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const bw = s * 0.56;

  // Contiguous edge days share one shaded rectangle.
  const shades: { x: number; w: number }[] = [];
  days.forEach((d, i) => {
    if (!d.edge) return;
    const last = shades[shades.length - 1];
    if (last && Math.abs(last.x + last.w - i * s) < 0.5) last.w += s;
    else shades.push({ x: i * s, w: s });
  });

  const future = bad ? t.colors.bad.solid : t.colors.ink;
  const mark = days[markIndex];
  const pick = (x: number) => {
    if (!onSelect || W <= 0 || n === 0) return;
    onSelect(Math.max(0, Math.min(n - 1, Math.floor(x / s))));
  };
  // Horizontal only: a vertical drag fails this gesture and the page scrolls.
  const pan = Gesture.Pan().runOnJS(true).enabled(!!onSelect)
    .activeOffsetX([-6, 6]).failOffsetY([-10, 10])
    .onStart((e) => pick(e.x)).onUpdate((e) => pick(e.x));
  const tap = Gesture.Tap().runOnJS(true).enabled(!!onSelect).onEnd((e) => pick(e.x));
  const sel = selectedIndex != null && selectedIndex >= 0 && selectedIndex < n ? days[selectedIndex] : null;

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
    <View style={{ height: H, alignSelf: "stretch" }} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible={false}>
      {draw && (
        <Svg width={W} height={H}>
          {shades.map((r) => (
            <Rect key={r.x} x={r.x} y={0} width={r.w} height={H} rx={6} fill={t.colors.sunk} />
          ))}
          {sel && <Rect x={selectedIndex! * s} y={0} width={s} height={H} rx={4} fill={t.colors.ink} opacity={0.08} />}
          <Path d={`${path(pts)} L${xs(n - 1).toFixed(1)} ${y0} L${xs(0).toFixed(1)} ${y0} Z`} fill={t.colors.ink} opacity={0.06} />
          {bad && (
            <Path
              d={`${path(pts.slice(todayIndex).map(([x, y]) => [x, Math.max(y, y0)] as const))} L${xs(n - 1).toFixed(1)} ${y0} L${xs(todayIndex).toFixed(1)} ${y0} Z`}
              fill={t.colors.bad.solid}
              opacity={0.22}
            />
          )}
          <Line x1={0} x2={W} y1={y0} y2={y0} stroke={bad ? t.colors.bad.solid : t.colors.control} strokeWidth={1} />
          {days.map((d, i) => {
            const bx = i * s + (s - bw) / 2;
            const bars = [];
            if (d.income) bars.push(<Rect key="in" x={bx} y={y0 - hIn(d.income)} width={bw} height={hIn(d.income)} rx={1.5} fill={t.colors.muted} />);
            if (d.incomeExpected) {
              const h = hIn(d.incomeExpected);
              bars.push(<Rect key="inP" x={bx + 0.75} y={y0 - h + 0.75} width={bw - 1.5} height={h - 1.5} rx={1.5} fill={t.colors.card} stroke={t.colors.muted} strokeWidth={1.5} />);
            }
            let y = y0 + 1.5;
            if (d.spent) {
              const h = hOut(d.spent);
              bars.push(<Rect key="out" x={bx} y={y} width={bw} height={h} rx={1.5} fill={t.colors.muted} />);
              y += h + 1;
            }
            if (d.bill) {
              const h = hOut(d.bill);
              bars.push(<Rect key="bill" x={bx + 0.75} y={y + 0.75} width={bw - 1.5} height={Math.max(1, h - 1.5)} rx={1.5} fill={t.colors.card} stroke={t.colors.ink} strokeWidth={1.5} />);
              y += h + 1;
            }
            if (d.estimated) {
              const h = Math.min(H - y, hOut(d.estimated));
              if (h > 1) bars.push(<Rect key="est" x={bx} y={y} width={bw} height={h} rx={1.5} fill={t.colors.est} />);
            }
            if (d.cardCut) {
              const cx = xs(i);
              const cy = H - 4;
              bars.push(<Path key="cut" d={`M${cx} ${cy - 4} L${cx + 4} ${cy} L${cx} ${cy + 4} L${cx - 4} ${cy} Z`} fill={t.colors.muted} />);
            }
            return bars.length ? <G key={d.date}>{bars}</G> : null;
          })}
          <Line x1={xs(todayIndex)} x2={xs(todayIndex)} y1={0} y2={H} stroke={t.colors.muted} strokeWidth={1} strokeDasharray="2 3" />
          <Path d={path(pts.slice(0, todayIndex + 1))} fill="none" stroke={t.colors.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <Path d={path(pts.slice(todayIndex))} fill="none" stroke={future} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
          {mark && (
            <Circle cx={xs(markIndex)} cy={yB(mark.balance)} r={4.5} fill={t.colors.card} stroke={bad ? t.colors.bad.solid : t.colors.ink} strokeWidth={2} />
          )}
          {sel && (
            <Circle cx={xs(selectedIndex!)} cy={yB(sel.balance)} r={5} fill={sel.balance < 0 ? t.colors.bad.solid : t.colors.ink} stroke={t.colors.card} strokeWidth={2} />
          )}
        </Svg>
      )}
    </View>
    </GestureDetector>
  );
});
