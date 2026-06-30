import { Fragment, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Polyline, Rect } from "react-native-svg";
import { AlertTriangle } from "lucide-react-native";
import {
  formatCurrency,
  type AdherencePoint,
  type Anomaly,
  type CashflowPoint,
  type FixedVariable,
  type ForecastPoint,
  type Mover,
  type RecipientRank,
  type SavingsPoint,
} from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { PANEL_SURFACE_SUBTLE_CLASS } from "../../lib/constants/styles";
import { DeltaChip } from "./TendenciasView";

const CURRENCY = "COP";
const TABULAR = { fontVariant: ["tabular-nums" as const] };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "2026-06" → "jun". TZ-safe string slice (no Date parsing). */
const monthShort = (m: string) => MESES[Number(m.slice(5, 7)) - 1] ?? m;

const SVG_HIDDEN = {
  accessible: false as const,
  accessibilityElementsHidden: true as const,
  importantForAccessibility: "no-hide-descendants" as const,
};

export type Lens = "gastos" | "ahorro" | "cambios";
const LENS_TABS: { id: Lens; label: string }[] = [
  { id: "gastos", label: "¿A dónde va?" },
  { id: "ahorro", label: "¿Voy bien?" },
  { id: "cambios", label: "¿Cambios?" },
];

export function LensTabs({
  lens,
  onChange,
}: {
  lens: Lens;
  onChange: (l: Lens) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      className="mt-4 flex-row gap-1 rounded-full border border-white-6 bg-black-10 p-1"
    >
      {LENS_TABS.map((l) => {
        const active = l.id === lens;
        return (
          <Pressable
            key={l.id}
            onPress={() => onChange(l.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 8, bottom: 8 }}
            className={`flex-1 rounded-full py-2 active:opacity-80 ${active ? "bg-z-brass-10" : ""}`}
          >
            <Text
              numberOfLines={1}
              className={`text-center text-xs font-inter-semibold ${active ? "text-z-brass" : "text-z-sage-dark"}`}
            >
              {l.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-6`}>
      <Text className="text-center text-sm font-inter text-z-sage-dark">
        {text}
      </Text>
    </View>
  );
}

/** Full-width trend line. viewBox 0-100 + preserveAspectRatio none scales x to
 * the card; non-scaling-stroke keeps the line crisp. */
function TrendLine({
  values,
  color,
  height = 44,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values
    .map(
      (v, i) =>
        `${(i / Math.max(values.length - 1, 1)) * 100},${height - ((v - min) / range) * height}`
    )
    .join(" ");
  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      {...SVG_HIDDEN}
    >
      <Polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </Svg>
  );
}

export function SavingsRateCard({ savings }: { savings: SavingsPoint[] }) {
  if (savings.length === 0)
    return <EmptyCard text="Sin datos de ahorro en el periodo." />;
  const rates = savings.map((s) => (s.rate == null ? 0 : Math.round(s.rate * 100)));
  const current = rates[rates.length - 1] ?? 0;
  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-4`}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-inter-semibold text-foreground">
          Tasa de ahorro
        </Text>
        <Text className="text-lg font-inter-bold text-z-brass" style={TABULAR}>
          {current}%
        </Text>
      </View>
      <TrendLine values={rates} color={COLORS.brass} />
      <Text className="mt-1 text-[11px] font-inter text-z-sage-dark">Meta 20%</Text>
    </View>
  );
}

/** Grouped income/expense bars per month. */
function MonthBars({ cashflow }: { cashflow: CashflowPoint[] }) {
  const h = 64;
  const max = Math.max(...cashflow.flatMap((p) => [p.income, p.expense]), 1);
  const n = Math.max(cashflow.length, 1);
  const slot = 100 / n;
  const barW = slot * 0.3;
  return (
    <Svg
      width="100%"
      height={h}
      viewBox={`0 0 100 ${h}`}
      preserveAspectRatio="none"
      {...SVG_HIDDEN}
    >
      {cashflow.map((p, i) => {
        const cx = i * slot + slot / 2;
        const ih = (p.income / max) * h;
        const eh = (p.expense / max) * h;
        return (
          <Fragment key={p.month}>
            <Rect x={cx - barW - 0.6} y={h - ih} width={barW} height={ih} fill={COLORS.income} />
            <Rect x={cx + 0.6} y={h - eh} width={barW} height={eh} fill={COLORS.expense} />
          </Fragment>
        );
      })}
    </Svg>
  );
}

export function IncomeExpenseCard({ cashflow }: { cashflow: CashflowPoint[] }) {
  const avgNet = cashflow.length
    ? cashflow.reduce((a, p) => a + p.net, 0) / cashflow.length
    : 0;
  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-4`}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-inter-semibold text-foreground">
          Ingreso vs. gasto
        </Text>
        <Text className="text-xs font-inter text-z-sage-dark">
          Neto prom{" "}
          <Text
            className={avgNet >= 0 ? "text-z-income" : "text-z-expense"}
            style={TABULAR}
          >
            {avgNet >= 0 ? "+" : ""}
            {formatCurrency(avgNet, CURRENCY)}
          </Text>
        </Text>
      </View>
      <MonthBars cashflow={cashflow} />
      <View className="mt-2 flex-row items-center gap-4">
        <View className="flex-row items-center gap-1.5">
          <View accessible={false} className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.income }} />
          <Text className="text-[11px] font-inter text-z-sage-dark">Ingreso</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View accessible={false} className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.expense }} />
          <Text className="text-[11px] font-inter text-z-sage-dark">Gasto</Text>
        </View>
      </View>
    </View>
  );
}

export function BudgetAdherenceCard({ adherence }: { adherence: AdherencePoint[] }) {
  if (adherence.length === 0) return null;
  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-4`}>
      <Text className="mb-1 text-sm font-inter-semibold text-foreground">
        Cumplimiento de presupuesto
      </Text>
      {adherence.slice(0, 6).map((a, i) => {
        const total = a.monthsWithin + a.monthsExceeded;
        return (
          <View
            key={a.categoryId}
            className={`flex-row items-center gap-3 py-2 ${i === 0 ? "" : "border-t border-white-6"}`}
          >
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 text-sm font-inter-medium text-foreground"
            >
              {a.nameEs}
            </Text>
            <Text className="text-[11px] font-inter text-z-sage-dark">
              {a.monthsExceeded > 0
                ? `excedido ${a.monthsExceeded} de ${total}`
                : `dentro ${a.monthsWithin} de ${total}`}
            </Text>
            {a.momPct != null ? <DeltaChip pct={a.momPct} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export function MoversCard({ movers }: { movers: Mover[] }) {
  if (movers.length === 0)
    return <EmptyCard text="Sin cambios destacados en el periodo." />;
  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-4`}>
      <Text className="mb-1 text-sm font-inter-semibold text-foreground">
        Cambios destacados
      </Text>
      {movers.map((m, i) => (
        <View
          key={m.categoryId}
          className={`flex-row items-center gap-2 py-2 ${i === 0 ? "" : "border-t border-white-6"}`}
        >
          <View className="h-2.5 w-2.5 shrink-0 rounded" style={{ backgroundColor: m.color }} />
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 text-sm font-inter-medium text-foreground"
          >
            {m.nameEs}
          </Text>
          <Text className="shrink-0 text-[11px] font-inter text-z-sage-dark" style={TABULAR}>
            {formatCurrency(m.from, CURRENCY)} → {formatCurrency(m.to, CURRENCY)}
          </Text>
          <DeltaChip pct={m.deltaPct} />
        </View>
      ))}
    </View>
  );
}

export function AnomaliesCard({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-4`}>
      <Text className="mb-2 text-sm font-inter-semibold text-foreground">
        Anomalías detectadas
      </Text>
      {anomalies.length === 0 ? (
        <Text className="text-sm font-inter text-z-sage-dark">
          Sin anomalías en el periodo.
        </Text>
      ) : (
        anomalies.slice(0, 5).map((a, i) => (
          <View
            key={`${a.categoryId}-${a.month}`}
            className={`flex-row items-start gap-3 rounded-2xl border border-z-brass-20 bg-z-brass-8 p-3 ${i > 0 ? "mt-2" : ""}`}
          >
            <AlertTriangle size={16} color={COLORS.brass} />
            <View className="flex-1">
              <Text className="text-xs font-inter-semibold text-foreground">
                Gasto inusual en {a.nameEs}
              </Text>
              <Text className="text-[11px] font-inter text-z-sage-dark">
                {formatCurrency(a.amount, CURRENCY)} en {monthShort(a.month)} —{" "}
                {a.multiple.toFixed(1)}× tu promedio.
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const RECIPIENTS_VISIBLE = 8;
// "Ver todas" renders all recipients inline — bounded by distinct merchants in
// the window (typically 20–80, same blessed regime as the category list). A 200+
// merchant user over a 12M range should route to a FlatList screen instead of an
// inline mount (~120 threshold). Tracked in BACKLOG.

export function TopRecipientsCard({ recipients }: { recipients: RecipientRank[] }) {
  const [showAll, setShowAll] = useState(false);
  const max = useMemo(
    () => Math.max(...recipients.map((r) => r.total), 1),
    [recipients]
  );
  if (recipients.length === 0) return null;
  const visible = showAll ? recipients : recipients.slice(0, RECIPIENTS_VISIBLE);
  const hidden = recipients.length - RECIPIENTS_VISIBLE;
  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-4`}>
      <Text className="mb-1 text-sm font-inter-semibold text-foreground">
        ¿A dónde va? · Destinatarios
      </Text>
      {visible.map((r, i) => (
        <View
          key={r.destinatarioId ?? "none"}
          className={`flex-row items-center gap-2.5 py-2.5 ${i === 0 ? "" : "border-t border-white-6"}`}
        >
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: r.color }}
          >
            <Text className="text-xs font-inter-bold text-z-ink">
              {r.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-baseline justify-between gap-2">
              <Text
                numberOfLines={1}
                className="min-w-0 flex-1 text-sm font-inter-semibold text-foreground"
              >
                {r.name}
              </Text>
              <Text className="text-sm font-inter-semibold text-foreground" style={TABULAR}>
                {formatCurrency(r.total, CURRENCY)}
              </Text>
            </View>
            <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-black-10">
              <View
                className="h-full rounded-full"
                style={{ width: `${(r.total / max) * 100}%`, backgroundColor: r.color }}
              />
            </View>
            <View className="mt-1 flex-row items-center gap-2">
              <Text className="text-[11px] font-inter text-z-sage-dark">
                {r.count} mov.
              </Text>
              {r.momPct != null ? <DeltaChip pct={r.momPct} /> : null}
            </View>
          </View>
        </View>
      ))}
      {hidden > 0 ? (
        <Pressable
          onPress={() => setShowAll((s) => !s)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showAll }}
          className="mt-2 flex-row items-center justify-center gap-1 py-2 active:opacity-80"
        >
          <Text className="text-xs font-inter-semibold text-z-brass">
            {showAll ? "Ver menos" : `Ver todas (${recipients.length})`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function FixedVariableCard({ data }: { data: FixedVariable }) {
  const total = data.fixed + data.variable || 1;
  const fixedPct = Math.round((data.fixed / total) * 100);
  const mom = data.variableMoM;
  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-4`}>
      <Text className="mb-2 text-sm font-inter-semibold text-foreground">
        Fijos vs. variables
      </Text>
      <View className="h-7 flex-row overflow-hidden rounded-lg border border-white-6">
        <View
          className="items-center justify-center"
          style={{ width: `${fixedPct}%`, backgroundColor: COLORS.brass }}
        >
          <Text className="text-[11px] font-inter-semibold text-z-ink" numberOfLines={1}>
            Fijos {fixedPct}%
          </Text>
        </View>
        <View
          className="items-center justify-center"
          style={{ width: `${100 - fixedPct}%`, backgroundColor: COLORS.expense }}
        >
          <Text className="text-[11px] font-inter-semibold text-z-ink" numberOfLines={1}>
            Variables {100 - fixedPct}%
          </Text>
        </View>
      </View>
      <View className="mt-2 flex-row justify-between">
        <Text className="text-[11px] font-inter text-z-sage-dark">
          Fijos{" "}
          <Text className="font-inter-semibold text-foreground" style={TABULAR}>
            {formatCurrency(data.fixed, CURRENCY)}
          </Text>
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-[11px] font-inter text-z-sage-dark">
            Variables{" "}
            <Text className="font-inter-semibold text-foreground" style={TABULAR}>
              {formatCurrency(data.variable, CURRENCY)}
            </Text>
          </Text>
          {mom != null && isFinite(mom) && Math.round(mom) !== 0 ? (
            <DeltaChip pct={mom} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ForecastCard({
  points,
  currentBalance,
}: {
  points: ForecastPoint[];
  currentBalance: number;
}) {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  const values = [Math.round(currentBalance), ...points.map((p) => p.balance)];
  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-3 p-4`}>
      <Text className="mb-2 text-sm font-inter-semibold text-foreground">
        Proyección de saldo
      </Text>
      <TrendLine values={values} color={COLORS.brass} height={56} />
      <View className="mt-2 flex-row justify-between">
        <Text className="text-[11px] font-inter text-z-sage-dark">
          Saldo hoy{" "}
          <Text className="font-inter-semibold text-foreground" style={TABULAR}>
            {formatCurrency(currentBalance, CURRENCY)}
          </Text>
        </Text>
        {last ? (
          <Text className="text-[11px] font-inter text-z-sage-dark">
            Proy. {monthShort(last.month)}{" "}
            <Text className="font-inter-semibold text-z-brass" style={TABULAR}>
              {formatCurrency(last.balance, CURRENCY)}
            </Text>
          </Text>
        ) : null}
      </View>
      <Text className="mt-2 text-[11px] font-inter text-z-sage-dark">
        Proyección lineal sobre tu neto promedio. No incluye ingresos no confirmados.
      </Text>
    </View>
  );
}
