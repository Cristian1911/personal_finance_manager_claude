import { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { TrendingUp, ChevronDown, Search } from "lucide-react-native";
import {
  formatCurrency,
  type CategoryTrend,
  type Verdict,
} from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import {
  PANEL_SURFACE_SUBTLE_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../../lib/constants/styles";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { DrilldownTransactions } from "./DrilldownTransactions";

const CURRENCY = "COP";
const TABULAR = { fontVariant: ["tabular-nums" as const] };

/** Accent- and case-insensitive fold for client-side search (mirrors the webapp
 * foldForSearch). */
export function foldForSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
}

/** Period chips — mirrors the webapp PeriodControl (Semana/Mes/3M/6M/12M/Año). */
export const RANGES = ["WTD", "MTD", "3M", "6M", "12M", "YTD"] as const;
export type RangeKey = (typeof RANGES)[number];
const RANGE_LABELS: Record<RangeKey, string> = {
  WTD: "Semana",
  MTD: "Mes",
  "3M": "3M",
  "6M": "6M",
  "12M": "12M",
  YTD: "Año",
};

export function PeriodControl({
  range,
  onChange,
}: {
  range: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Pill row: never grow vertically (see PlanificadorRoot).
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ gap: 8 }}
      className="mt-3"
      accessibilityRole="tablist"
    >
      {RANGES.map((r) => {
        const active = r === range;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 10, bottom: 10 }}
            className={`rounded-full border px-3 py-1.5 active:opacity-80 ${
              active
                ? "border-z-brass-20 bg-z-brass-10"
                : "border-white-6 bg-black-10"
            }`}
          >
            <Text
              className={`text-xs font-inter-medium ${
                active ? "text-z-brass" : "text-z-sage-dark"
              }`}
            >
              {RANGE_LABELS[r]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** MoM delta for a spend row: up = spending more (concerning, red), down = green. */
export function DeltaChip({ pct }: { pct: number }) {
  if (!isFinite(pct)) return null;
  const rounded = Math.round(pct);
  if (rounded === 0) return null;
  const up = rounded > 0;
  return (
    <Text
      className={`text-[11px] font-inter-semibold ${up ? "text-z-expense" : "text-z-income"}`}
      style={TABULAR}
      accessibilityLabel={`${up ? "Aumentó" : "Bajó"} ${Math.abs(rounded)}%`}
    >
      {up ? "▲" : "▼"} {Math.abs(rounded)}%
    </Text>
  );
}

export const Sparkline = memo(function Sparkline({
  points,
  color,
}: {
  points: number[];
  color: string;
}) {
  const w = 56;
  const h = 18;
  const max = Math.max(...points, 1);
  const d = points
    .map(
      (p, i) =>
        `${(i / Math.max(points.length - 1, 1)) * w},${h - (p / max) * h}`
    )
    .join(" ");
  return (
    <Svg
      width={w}
      height={h}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Polyline points={d} fill="none" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
});

export const VerdictHeader = memo(function VerdictHeader({
  verdict,
}: {
  verdict: Verdict;
}) {
  return (
    <View className="mt-3">
      <View className="flex-row items-center gap-3 rounded-2xl border border-z-brass-20 bg-z-brass-8 p-3">
        <TrendingUp size={16} color={COLORS.brass} />
        <View className="flex-1">
          <Text className="text-sm font-inter-semibold text-foreground">
            {verdict.headline}
          </Text>
          {verdict.sub ? (
            <Text className="text-xs font-inter text-z-sage-dark">
              {verdict.sub}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {verdict.tiles.map((t) => (
          <View
            key={t.label}
            accessible
            accessibilityLabel={`${t.label}: ${t.value}${t.deltaLabel ? `, ${t.deltaLabel}` : ""}`}
            className={`${PANEL_SURFACE_SUBTLE_CLASS} min-w-[30%] flex-1 p-3`}
          >
            <Text className={SECTION_EYEBROW_CLASS}>{t.label}</Text>
            <Text
              className="mt-1 text-base font-inter-bold text-foreground"
              style={TABULAR}
            >
              {t.value}
            </Text>
            {t.deltaLabel ? (
              <Text
                className={`mt-0.5 text-[10px] font-inter-semibold ${
                  t.tone === "pos"
                    ? "text-z-income"
                    : t.tone === "neg"
                      ? "text-z-expense"
                      : "text-z-sage-dark"
                }`}
              >
                {t.deltaLabel}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
});

const DEFAULT_VISIBLE = 8;

const CategoryRow = memo(function CategoryRow({
  cat,
  last,
  windowFrom,
  windowTo,
}: {
  cat: CategoryTrend;
  last: boolean;
  windowFrom: string;
  windowTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const toggle = () => {
    setOpen((o) => !o);
    setEverOpened(true);
  };
  return (
    <View className={last ? "" : "border-b border-white-6"}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${cat.nameEs}, ${formatCurrency(cat.total, CURRENCY)}`}
        className="flex-row items-center gap-3 py-2.5 active:opacity-80"
      >
        <ChevronDown
          size={15}
          color={COLORS.sageDark}
          style={open ? { transform: [{ rotate: "180deg" }] } : undefined}
        />
        <View
          className="h-2.5 w-2.5 rounded"
          style={{ backgroundColor: cat.color }}
        />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-baseline justify-between gap-2">
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 text-sm font-inter-medium text-foreground"
            >
              {cat.nameEs}
            </Text>
            <Text
              className="text-sm font-inter-semibold text-foreground"
              style={TABULAR}
            >
              {formatCurrency(cat.total, CURRENCY)}
            </Text>
          </View>
          <View className="mt-1 flex-row items-center justify-between gap-2">
            <Sparkline points={cat.monthly} color={cat.color} />
            {cat.momPct != null ? <DeltaChip pct={cat.momPct} /> : <View />}
          </View>
        </View>
      </Pressable>
      <AnimatedAccordion expanded={open} estimatedHeight={1200}>
        <View className="ml-2 border-l border-white-6 pl-3">
          {everOpened ? (
            <DrilldownTransactions
              categoryId={cat.categoryId}
              dateFrom={windowFrom}
              dateTo={windowTo}
            />
          ) : null}
        </View>
      </AnimatedAccordion>
    </View>
  );
});

export function CategoryTrendList({
  categories,
  windowFrom,
  windowTo,
}: {
  categories: CategoryTrend[];
  windowFrom: string;
  windowTo: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const folded = foldForSearch(query.trim());
  const searching = folded.length > 0;
  const foldedNames = useMemo(
    () => categories.map((c) => foldForSearch(c.nameEs)),
    [categories]
  );
  const rows = useMemo(() => {
    if (searching) return categories.filter((_, i) => foldedNames[i].includes(folded));
    return showAll ? categories : categories.slice(0, DEFAULT_VISIBLE);
  }, [searching, folded, categories, foldedNames, showAll]);
  const hidden = categories.length - DEFAULT_VISIBLE;

  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-4`}>
      <Text className="mb-2 text-sm font-inter-semibold text-foreground">
        Gasto por categoría
      </Text>
      {categories.length === 0 ? (
        <Text className="py-4 text-center text-sm font-inter text-z-sage-dark">
          Sin gastos categorizados en el periodo.
        </Text>
      ) : (
        <>
          <View className="mb-1 flex-row items-center gap-2 rounded-xl border border-white-6 bg-black-10 px-3 py-2">
            <Search size={15} color={COLORS.sageDark} accessible={false} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar categoría..."
              placeholderTextColor={COLORS.sageDark}
              accessibilityLabel="Buscar categoría"
              className="min-w-0 flex-1 text-sm font-inter text-foreground"
            />
          </View>
          {rows.length === 0 ? (
            <Text className="py-3 text-center text-xs font-inter text-z-sage-dark">
              Sin resultados
            </Text>
          ) : (
            rows.map((cat, i) => (
              <CategoryRow
                key={cat.categoryId}
                cat={cat}
                last={i === rows.length - 1}
                windowFrom={windowFrom}
                windowTo={windowTo}
              />
            ))
          )}
          {!searching && hidden > 0 ? (
            <Pressable
              onPress={() => setShowAll((s) => !s)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showAll }}
              className="mt-2 flex-row items-center justify-center gap-1 py-2 active:opacity-80"
            >
              <Text className="text-xs font-inter-semibold text-z-brass">
                {showAll ? "Ver menos" : `Ver todas (${categories.length})`}
              </Text>
              <ChevronDown
                size={13}
                color={COLORS.brass}
                style={showAll ? { transform: [{ rotate: "180deg" }] } : undefined}
              />
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
