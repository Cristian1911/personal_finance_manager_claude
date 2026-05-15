import { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { TrendChip } from "../ui/TrendChip";
import type { SnapshotPoint } from "../../lib/repositories/accounts-detail";
import type { RangeValue } from "./RangePills";

type Props = {
  data: SnapshotPoint[];
  currencyCode: string;
  range: RangeValue;
  trendPercent?: number;
  height?: number;
  strokeColor?: string;
  showHeader?: boolean;
  /** When true, container takes card aspect ratio (85.6/53.98) and chart fills it. */
  fillCard?: boolean;
  /** Optional pre-filtered data; skips internal filterByRange. */
  filteredData?: SnapshotPoint[];
  /** Trend semantics: "up" = improvement (assets), "down" = improvement (debt). */
  goodDirection?: "up" | "down";
};

export function filterByRange(
  data: SnapshotPoint[],
  range: RangeValue,
): SnapshotPoint[] {
  if (range === 0 || data.length === 0) return data;
  // Snapshot dates come from accounts-detail.ts as Colombia-local YYYY-MM-DD
  // (en-CA + America/Bogota). Use the same format for the cutoff to avoid a
  // UTC-shifted off-by-one at night in UTC-5.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - range);
  const cutoffStr = cutoff.toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
  return data.filter((p) => p.date >= cutoffStr);
}

const CHART_W = 320;

export function GraphFace({
  data,
  currencyCode,
  range,
  trendPercent,
  height = 100,
  strokeColor = COLORS.brass,
  showHeader = true,
  fillCard = false,
  filteredData,
  goodDirection = "up",
}: Props) {
  const filtered = useMemo(
    () => filteredData ?? filterByRange(data, range),
    [filteredData, data, range],
  );

  const h = height;

  const paths = useMemo(() => {
    if (filtered.length < 2) return null;
    const min = Math.min(...filtered.map((p) => p.balance));
    const max = Math.max(...filtered.map((p) => p.balance));
    const span = max - min || 1;
    const stepX = filtered.length > 1 ? CHART_W / (filtered.length - 1) : 0;
    const linePath = filtered
      .map((p, i) => {
        const x = i * stepX;
        const y = h - ((p.balance - min) / span) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const areaPath = `${linePath} L${CHART_W.toFixed(1)},${h} L0,${h} Z`;
    return {
      linePath,
      areaPath,
      latest: filtered[filtered.length - 1].balance,
    };
  }, [filtered, h]);

  const emptyContainerStyle = fillCard
    ? { aspectRatio: 85.6 / 53.98, width: "100%" as const }
    : { height: h + (showHeader ? 28 : 0) };

  if (!paths) {
    return (
      <View
        style={emptyContainerStyle}
        className="items-center justify-center rounded-xl border border-white-6 bg-z-surface-2-55"
      >
        <Text className="text-z-sage-dark font-inter text-sm">
          Sin datos suficientes
        </Text>
      </View>
    );
  }

  const headerNode = showHeader ? (
    <View className="flex-row items-baseline gap-2">
      <Text className="text-z-white font-inter-bold text-lg tabular-nums">
        {formatCurrency(paths.latest, currencyCode as CurrencyCode)}
      </Text>
      <TrendChip percent={trendPercent} goodDirection={goodDirection} />
    </View>
  ) : null;

  const chartNode = (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${CHART_W} ${h}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="graphFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={strokeColor} stopOpacity={0.3} />
          <Stop offset="1" stopColor={strokeColor} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={paths.areaPath} fill="url(#graphFill)" />
      <Path
        d={paths.linePath}
        stroke={strokeColor}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );

  if (fillCard) {
    return (
      <View
        style={{ aspectRatio: 85.6 / 53.98, width: "100%" }}
        className="rounded-xl bg-z-surface-2-55 border border-white-6 overflow-hidden p-3"
      >
        {headerNode}
        <View className="flex-1">{chartNode}</View>
      </View>
    );
  }

  return (
    <View className="gap-1">
      {headerNode}
      <View
        style={{ height: h }}
        className="rounded-xl bg-z-surface-2-55 border border-white-6 overflow-hidden"
      >
        {chartNode}
      </View>
    </View>
  );
}
