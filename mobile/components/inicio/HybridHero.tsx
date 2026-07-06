import { memo, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import Svg, { Polyline, Line, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useRouter } from "expo-router";
import {
  formatCurrency,
  computeRitmo,
  BUCKET_LABEL,
  WEEKDAYS_MONDAY_START,
  deriveRitmoStatus,
  weekdayMondayStart,
  type CurrencyCode,
  type DailyBucket,
  type RitmoResult,
  type RitmoStatusTone,
} from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";

export interface PrimaryAccountSummary {
  id: string;
  name: string;
  currentBalance: number;
  currencyCode: CurrencyCode;
}

interface HybridHeroProps {
  today: string;
  endOfMonth: string;
  liquidBalance: number;
  pendingObligations: number;
  nextIncomeDate: string | null;
  nextIncomeAmount: number;
  nextIncomeName: string | null;
  dailyOutflows: { date: string; expense: number }[];
  currency: CurrencyCode;
  primaryAccount?: PrimaryAccountSummary;
}

// NativeWind v3 can't parse Tailwind v4's `/N` opacity modifier — those
// classes compile to nothing. Use the pre-computed tokens from
// mobile/tailwind.config.js instead.
const BUCKET_TONE: Record<DailyBucket, string> = {
  none: "bg-z-surface-2",
  low: "bg-z-income-20",
  med: "bg-z-alert-30",
  high: "bg-z-debt-40",
};

const TONE_COLOR: Record<RitmoStatusTone, string> = {
  income: COLORS.income,
  alert: COLORS.alert,
  debt: COLORS.debt,
};

// Heatmap legend swatch colors. SVG/inline backgrounds can't take a className,
// so derive translucent tints from the brand COLORS tokens (matches the
// bucket-tone opacities used in BUCKET_TONE).
const LEGEND_LOW_COLOR = `${COLORS.income}4D`; // 0.30
const LEGEND_MED_COLOR = `${COLORS.alert}66`; // 0.40
const LEGEND_HIGH_COLOR = `${COLORS.debt}80`; // 0.50

function dayOfMonth(iso: string): number {
  return parseInt(iso.slice(8, 10), 10);
}

function formatDayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })
    .replace(/\./g, "")
    .toLowerCase();
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

export const HybridHero = memo(function HybridHero({
  today,
  endOfMonth,
  liquidBalance,
  pendingObligations,
  nextIncomeDate,
  nextIncomeAmount,
  nextIncomeName,
  dailyOutflows,
  currency,
  primaryAccount,
}: HybridHeroProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"calc" | "pattern">("calc");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const ritmo: RitmoResult = useMemo(
    () =>
      computeRitmo({
        today,
        endOfMonth,
        liquidBalance,
        nextIncomeDate,
        nextIncomeAmount,
        pendingObligations,
        dailyOutflows,
      }),
    [today, endOfMonth, liquidBalance, nextIncomeDate, nextIncomeAmount, pendingObligations, dailyOutflows],
  );

  // Headline = what's still spendable TODAY: the daily allowance minus what
  // you've already spent today. Signed on purpose — each new expense subtracts
  // from it, and it drops below zero once you blow past the daily budget.
  const remainingToday = ritmo.availablePerDay - ritmo.spentToday;
  const overspentToday = remainingToday < 0;
  const status = deriveRitmoStatus(ritmo);
  const statusColor = TONE_COLOR[status.tone];
  // Bright when you still have room, red once you're in the negative. The
  // status pill carries the nuanced green/amber/red verdict.
  const amountColor = overspentToday ? COLORS.debt : COLORS.foreground;

  const spark = useMemo(() => {
    const values = ritmo.calendar.slice(-7).map((d) => d.expense);
    const max = values.reduce((m, v) => Math.max(m, v), 0);
    return { values, max };
  }, [ritmo.calendar]);

  const cumulativeByDate = useMemo(() => {
    const map = new Map<string, number>();
    let running = 0;
    for (const day of ritmo.calendar) {
      running += day.expense;
      map.set(day.date, running);
    }
    return map;
  }, [ritmo.calendar]);

  const selectedEntry = useMemo(
    () => (selectedDay ? ritmo.calendar.find((d) => d.date === selectedDay) ?? null : null),
    [selectedDay, ritmo.calendar],
  );
  const selectedBalance = useMemo(
    () =>
      selectedEntry
        ? ritmo.periodBudget - (cumulativeByDate.get(selectedEntry.date) ?? 0)
        : null,
    [selectedEntry, cumulativeByDate, ritmo.periodBudget],
  );

  const windowEndLabel = formatShortDate(ritmo.windowEndDate);
  const nextIncomeDateLabel = nextIncomeDate ? formatShortDate(nextIncomeDate) : null;
  const dailyValue = `${formatCurrency(ritmo.availablePerDay, currency)}/día`;

  return (
    <View className="rounded-2xl border border-white-6 bg-z-surface p-5">
      {/* Top row: eyebrow + status pill */}
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[2px] text-z-sage-dark">
          Disponible hoy
        </Text>
        <View
          className="flex-row items-center gap-1.5 rounded-full border border-white-6 bg-white-4 px-2.5 py-1"
        >
          <View className="size-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
          <Text
            className="text-[10px] font-inter-semibold uppercase tracking-[1.2px]"
            style={{ color: statusColor }}
          >
            {status.label}
          </Text>
        </View>
      </View>

      {/* Bottom row: what's still spendable today (headline) + sparkline. */}
      <View className="mt-2 flex-row items-end justify-between">
        <Text
          className="text-[34px] font-inter-bold tracking-[-1.2px]"
          style={{ color: amountColor, fontVariant: ["tabular-nums"] }}
        >
          {overspentToday
            ? `−${formatCurrency(Math.abs(remainingToday), currency)}`
            : formatCurrency(remainingToday, currency)}
        </Text>
        {spark.values.length > 0 && (
          <Sparkline values={spark.values} max={spark.max} color={statusColor} />
        )}
      </View>

      {/* Context: how much of today's allowance is already spent. */}
      <Text
        className="mt-2 text-[12px]"
        style={{
          color: overspentToday ? COLORS.debt : COLORS.sageLight,
          fontVariant: ["tabular-nums"],
        }}
      >
        {`Gastaste ${formatCurrency(ritmo.spentToday, currency)} de ${formatCurrency(ritmo.availablePerDay, currency)} hoy`}
      </Text>

      {/* % del período above bar */}
      <View className="mt-5 flex-row items-end justify-end">
        <Text className="text-[10px] font-inter-medium text-z-sage-light" style={{ fontVariant: ["tabular-nums"] }}>
          {Math.round(ritmo.spentFraction * 100)}% del período
        </Text>
      </View>

      {/* Period progress bar with gradient */}
      <View className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-z-surface-2">
        <Svg height="10" width="100%">
          <Defs>
            <LinearGradient id="periodGrad" x1="0" y1="0" x2="1" y2="0">
              {/* Mobile color palette lacks an "excellent" + "sage" stop, so we
               *  approximate the webapp gradient with income → income → alert → debt. */}
              <Stop offset="0" stopColor={COLORS.income} />
              <Stop offset="0.4" stopColor={COLORS.income} />
              <Stop offset="0.7" stopColor={COLORS.alert} />
              <Stop offset="1" stopColor={COLORS.debt} />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={`${Math.min(100, Math.round(ritmo.spentFraction * 100))}%`}
            height="10"
            rx="5"
            fill="url(#periodGrad)"
          />
        </Svg>
      </View>

      {/* Legend rows */}
      <View className="mt-3 gap-1">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-[11px] font-inter text-z-sage-dark">Gastados</Text>
          <Text className="text-[11px] font-inter text-z-sage-light" style={{ fontVariant: ["tabular-nums"] }}>
            {formatCurrency(ritmo.spentMonth, currency)}
          </Text>
        </View>
        <View className="flex-row items-baseline justify-between">
          <Text className="text-[11px] font-inter text-z-sage-dark">Restantes</Text>
          <Text
            className="text-[11px] font-inter"
            style={{
              fontVariant: ["tabular-nums"],
              color: ritmo.availableTotal < 0 ? COLORS.debt : COLORS.sageLight,
            }}
          >
            {formatCurrency(ritmo.availableTotal, currency)}
          </Text>
        </View>
      </View>

      {/* Expand toggle */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="mt-4 flex-row items-center justify-center gap-1.5 rounded-lg border border-white-6 px-3 py-2 active:bg-white-4"
      >
        <Text className="text-[11px] font-inter-semibold tracking-wide text-z-sage-light">
          {expanded ? "Ocultar detalle" : "Ver detalle"}
        </Text>
        <ChevronDown
          size={14}
          color={COLORS.brass}
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        />
      </Pressable>

      {expanded && (
        <View className="mt-4 border-t border-dashed border-white-6 pt-4">
          {/* Tabs */}
          <View className="mb-3 flex-row gap-1 rounded-lg border border-white-6 bg-z-surface-2 p-0.5">
            <Pressable
              onPress={() => setView("calc")}
              className={`flex-1 rounded-md px-2 py-1.5 ${view === "calc" ? "bg-z-brass-20" : ""}`}
            >
              <Text
                className="text-center text-[10px] font-inter-semibold uppercase tracking-[1.2px]"
                style={{ color: view === "calc" ? COLORS.brass : COLORS.sageDark }}
              >
                Cómo se calcula
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setView("pattern")}
              className={`flex-1 rounded-md px-2 py-1.5 ${view === "pattern" ? "bg-z-brass-20" : ""}`}
            >
              <Text
                className="text-center text-[10px] font-inter-semibold uppercase tracking-[1.2px]"
                style={{ color: view === "pattern" ? COLORS.brass : COLORS.sageDark }}
              >
                Patrón del mes
              </Text>
            </Pressable>
          </View>

          {view === "calc" ? (
            <CalcView
              ritmo={ritmo}
              liquidBalance={liquidBalance}
              pendingObligations={pendingObligations}
              nextIncomeName={nextIncomeName}
              nextIncomeAmount={nextIncomeAmount}
              nextIncomeDateLabel={nextIncomeDateLabel}
              windowEndLabel={windowEndLabel}
              dailyValue={dailyValue}
              currency={currency}
              primaryAccount={primaryAccount}
              onAccountPress={() =>
                primaryAccount &&
                router.push(`/account/${primaryAccount.id}` as never)
              }
            />
          ) : (
            <PatternView
              ritmo={ritmo}
              currency={currency}
              selectedDay={selectedDay}
              onSelect={(date) =>
                setSelectedDay((prev) => (prev === date ? null : date))
              }
              selectedEntry={selectedEntry ?? null}
              selectedBalance={selectedBalance}
            />
          )}
        </View>
      )}
    </View>
  );
});

const Sparkline = memo(function Sparkline({
  values,
  max,
  color,
}: {
  values: number[];
  max: number;
  color: string;
}) {
  const w = 96;
  const h = 32;
  const pad = 3;
  if (values.length === 0) return null;
  if (values.length === 1) {
    return (
      <Svg width={w} height={h}>
        <Line
          x1={pad}
          x2={w - pad}
          y1={h / 2}
          y2={h / 2}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.6}
        />
      </Svg>
    );
  }
  const safeMax = max > 0 ? max : 1;
  const step = (w - pad * 2) / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = pad + step * i;
      const y = h - pad - (v / safeMax) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <Svg width={w} height={h}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

const CalcView = memo(function CalcView(props: {
  ritmo: RitmoResult;
  liquidBalance: number;
  pendingObligations: number;
  nextIncomeName: string | null;
  nextIncomeAmount: number;
  nextIncomeDateLabel: string | null;
  windowEndLabel: string;
  dailyValue: string;
  currency: CurrencyCode;
  primaryAccount?: PrimaryAccountSummary;
  onAccountPress: () => void;
}) {
  const {
    ritmo,
    liquidBalance,
    pendingObligations,
    nextIncomeName,
    nextIncomeAmount,
    nextIncomeDateLabel,
    windowEndLabel,
    dailyValue,
    currency,
    primaryAccount,
    onAccountPress,
  } = props;
  return (
    <View className="gap-3">
      <View className="gap-1.5 rounded-lg border border-white-6 bg-z-surface-2 p-3">
        <Text className="text-[10px] font-inter-bold uppercase tracking-[2px] text-z-brass">
          Cómo se calcula
        </Text>
        <Row label="Saldo líquido" value={formatCurrency(liquidBalance, currency)} />
        <Row
          label="− Obligaciones pendientes"
          value={`−${formatCurrency(pendingObligations, currency)}`}
          valueColor={COLORS.expense}
        />
        <Row
          label="− Ya gastado"
          value={`−${formatCurrency(ritmo.spentMonth, currency)}`}
          valueColor={COLORS.expense}
        />
        <View className="my-1 border-t border-white-6" />
        <Row
          label="= Disponible"
          value={formatCurrency(ritmo.availableTotal, currency)}
          bold
          valueColor={ritmo.availableTotal < 0 ? COLORS.debt : undefined}
        />
        <Text className="text-[10px] text-muted-foreground">
          ÷ {ritmo.daysRemaining} días (hasta {windowEndLabel}) = {dailyValue}
        </Text>
        {nextIncomeDateLabel && nextIncomeAmount > 0 && (
          <>
            <View className="my-1 border-t border-white-6" />
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-inter text-z-income" numberOfLines={1}>
                Próximo ingreso: {nextIncomeName ?? "ingreso"}
              </Text>
              <Text
                className="text-[11px] font-inter text-z-income"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                +{formatCurrency(nextIncomeAmount, currency)} el {nextIncomeDateLabel}
              </Text>
            </View>
          </>
        )}
      </View>

      {primaryAccount && (
        <Pressable
          onPress={onAccountPress}
          className="flex-row items-center justify-between rounded-lg border border-white-6 bg-black-20 p-3 active:bg-white-4"
        >
          <View className="flex-1">
            <Text className="text-[10px] font-inter-semibold uppercase tracking-[2px] text-z-sage-dark">
              Cuenta principal
            </Text>
            <Text className="mt-0.5 text-[12px] text-z-sage-light" numberOfLines={1}>
              {primaryAccount.name}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text
              className="text-[15px] font-inter-bold text-foreground"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatCurrency(primaryAccount.currentBalance, primaryAccount.currencyCode)}
            </Text>
            <ChevronRight size={14} color={COLORS.sageDark} />
          </View>
        </Pressable>
      )}
    </View>
  );
});

function Row({
  label,
  value,
  valueColor,
  bold,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text
        className={`text-[11px] ${bold ? "font-inter-semibold text-foreground" : "font-inter text-z-sage-light"}`}
      >
        {label}
      </Text>
      <Text
        className={`text-[11px] ${bold ? "font-inter-semibold" : "font-inter"}`}
        style={{
          color: valueColor ?? (bold ? COLORS.foreground : COLORS.sageLight),
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const PatternView = memo(function PatternView(props: {
  ritmo: RitmoResult;
  currency: CurrencyCode;
  selectedDay: string | null;
  onSelect: (date: string) => void;
  selectedEntry: RitmoResult["calendar"][number] | null;
  selectedBalance: number | null;
}) {
  const { ritmo, currency, selectedDay, onSelect, selectedEntry, selectedBalance } = props;
  if (ritmo.calendar.length === 0) return null;

  // Build week rows. RN doesn't have CSS Grid, so we emit 7-cell rows
  // explicitly — each cell flex-1 + aspectRatio 1 to stay square.
  const firstIso = ritmo.calendar[0].date;
  const leadingEmpty = weekdayMondayStart(firstIso);
  type Cell = RitmoResult["calendar"][number] | null;
  const weeks: Cell[][] = [];
  let row: Cell[] = new Array<Cell>(leadingEmpty).fill(null);
  for (const day of ritmo.calendar) {
    row.push(day);
    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    weeks.push(row);
  }

  return (
    <View>
      <Text className="mb-2 text-[10px] font-inter-semibold uppercase tracking-[2px] text-z-sage-dark">
        Toca un día para ver su detalle
      </Text>

      {/* Each cell slot occupies exactly 1/7 of the row width with
          internal padding creating the visual gap. This avoids the
          flex-1 + gap combo that was collapsing empty cells in partial
          rows and misaligning columns. */}
      <View className="flex-row">
        {WEEKDAYS_MONDAY_START.map((label) => (
          <View key={label} style={{ width: `${100 / 7}%`, alignItems: "center" }}>
            <Text className="text-[9px] font-inter-semibold uppercase tracking-wider text-z-sage-dark">
              {label}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={`w-${wi}`} className="mt-1.5 flex-row">
          {week.map((day, di) => {
            if (!day) {
              return (
                <View
                  key={`empty-${wi}-${di}`}
                  style={{ width: `${100 / 7}%`, aspectRatio: 1 }}
                />
              );
            }
            const isSelected = day.date === selectedDay;
            return (
              <View
                key={day.date}
                style={{ width: `${100 / 7}%`, padding: 3 }}
              >
                <Pressable
                  onPress={() => onSelect(day.date)}
                  className={`items-end justify-start rounded-md px-1 py-0.5 ${BUCKET_TONE[day.bucket]}`}
                  style={{
                    aspectRatio: 1,
                    // Future days dim naturally — no separate "today"
                    // ring needed (today is the last fully-bright cell).
                    opacity: day.isFuture ? 0.3 : 1,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: isSelected ? COLORS.brass : "transparent",
                  }}
                >
                  <Text
                    className="text-[10px]"
                    style={{
                      color: COLORS.foreground,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {dayOfMonth(day.date)}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View className="mt-3 flex-row flex-wrap gap-3">
        <LegendDot color={LEGEND_LOW_COLOR} label={BUCKET_LABEL.low} />
        <LegendDot color={LEGEND_MED_COLOR} label={BUCKET_LABEL.med} />
        <LegendDot color={LEGEND_HIGH_COLOR} label={BUCKET_LABEL.high} />
      </View>

      {selectedEntry && (
        <View className="mt-3 rounded-lg border border-white-6 bg-z-surface-2 p-3">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-[12px] font-inter-semibold text-z-sage-light">
              {formatDayLabel(selectedEntry.date)}
            </Text>
            <Text className="text-[10px] font-inter-medium uppercase tracking-[1.2px] text-z-sage-dark">
              {BUCKET_LABEL[selectedEntry.bucket] ?? ""}
            </Text>
          </View>
          <Text
            className="mt-1 text-[18px] font-inter-semibold text-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {selectedEntry.expense > 0
              ? `−${formatCurrency(selectedEntry.expense, currency)}`
              : "Sin gasto"}
          </Text>
          {selectedBalance !== null && (
            <Text
              className="mt-1 text-[11px]"
              style={{
                color: selectedBalance < 0 ? COLORS.debt : COLORS.sageDark,
                fontVariant: ["tabular-nums"],
              }}
            >
              Restante después de este día:{" "}
              <Text className="font-inter-semibold">
                {formatCurrency(selectedBalance, currency)}
              </Text>
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }}
      />
      <Text className="text-[10px] text-z-sage-dark">{label}</Text>
    </View>
  );
}
