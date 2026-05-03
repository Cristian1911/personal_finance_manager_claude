import { memo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  formatCurrency,
  type CurrencyCode,
  type ScenarioMonth,
  type ScenarioResult,
} from "@zeta/shared";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  DollarSign,
  TrendingDown,
  Zap,
} from "lucide-react-native";
import { COLORS } from "../../../lib/constants/colors";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import { MCard } from "../../ui/MCard";
import type { DebtAccountInfo } from "../../../lib/repositories/debt";
import type { ScenarioState } from "./reducer";
import {
  abbreviateName,
  formatCalendarMonth,
  formatDebtFreeDate,
  PLAN_COLORS,
} from "./utils";

interface Props {
  accounts: DebtAccountInfo[];
  scenarios: ScenarioState[];
  results: Record<number, ScenarioResult>;
  baseline: ScenarioResult;
  currency: CurrencyCode;
  income?: number;
}

export const DetailStep = memo(function DetailStep({
  accounts,
  scenarios,
  results,
  baseline,
  currency,
  income,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = Math.min(selectedIndex, scenarios.length - 1);
  const scenario = scenarios[safeIndex];
  const result = results[safeIndex];

  if (!scenario || !result) {
    return (
      <MCard>
        <Text className="text-[12px] font-inter text-muted-foreground text-center py-4">
          No hay datos para mostrar. Configura un escenario primero.
        </Text>
      </MCard>
    );
  }

  const interestSaved = Math.max(
    0,
    baseline.totalInterestPaid - result.totalInterestPaid
  );
  const monthsLess = Math.max(0, baseline.totalMonths - result.totalMonths);

  return (
    <View className="gap-3">
      {/* Plan selector */}
      <View className="flex-row items-center gap-2">
        <Text className="text-[11px] font-inter text-muted-foreground">
          Ver plan:
        </Text>
        {scenarios.map((s, i) => {
          const active = i === safeIndex;
          return (
            <Pressable
              key={i}
              onPress={() => setSelectedIndex(i)}
              className={`flex-row items-center gap-1.5 rounded-full border px-2.5 py-1 ${active ? "border-z-brass bg-z-brass/15" : "border-white-6"}`}
            >
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: PLAN_COLORS[i] ?? COLORS.brass }}
              />
              <Text
                className={`text-[11px] font-inter-semibold ${active ? "text-z-brass" : "text-foreground"}`}
              >
                {s.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Summary tiles */}
      <View className="flex-row gap-2">
        <SummaryTile
          icon={<Clock size={14} color={COLORS.sageDark} />}
          value={`${result.totalMonths}`}
          label={result.totalMonths === 1 ? "mes" : "meses"}
        />
        <SummaryTile
          icon={<DollarSign size={14} color={COLORS.expense} />}
          value={formatCurrency(result.totalInterestPaid, currency)}
          label="intereses"
          compact
        />
      </View>
      <View className="flex-row gap-2">
        <SummaryTile
          icon={
            <TrendingDown
              size={14}
              color={interestSaved > 0 ? COLORS.income : COLORS.sageDark}
            />
          }
          value={interestSaved > 0 ? formatCurrency(interestSaved, currency) : "—"}
          label={interestSaved > 0 ? "ahorrado" : "sin ahorro"}
          highlight={interestSaved > 0}
          compact
        />
        <SummaryTile
          icon={<CalendarCheck size={14} color={COLORS.sageDark} />}
          value={formatDebtFreeDate(result.debtFreeDate)}
          label="libre de deuda"
          compact
        />
      </View>

      {/* Before vs after */}
      <MCard className="gap-2 border-z-income/20 bg-z-income/5">
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Hoy vs con tu plan
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <Text className="text-[10px] font-inter-semibold uppercase tracking-wide text-muted-foreground">
              Sin plan
            </Text>
            <Stat
              label="Tiempo"
              value={`${baseline.totalMonths} ${baseline.totalMonths === 1 ? "mes" : "meses"}`}
            />
            <Stat
              label="Intereses"
              value={formatCurrency(baseline.totalInterestPaid, currency)}
              valueClass="text-z-expense"
            />
            <Stat
              label="Total"
              value={formatCurrency(baseline.totalAmountPaid, currency)}
              small
            />
          </View>
          <View className="w-px bg-white-6" />
          <View className="flex-1 gap-2">
            <Text className="text-[10px] font-inter-semibold uppercase tracking-wide text-z-income">
              Con tu plan
            </Text>
            <Stat
              label="Tiempo"
              value={`${result.totalMonths} ${result.totalMonths === 1 ? "mes" : "meses"}`}
              valueClass="text-z-income"
              extra={
                monthsLess > 0
                  ? `${monthsLess} ${monthsLess === 1 ? "mes" : "meses"} menos`
                  : undefined
              }
            />
            <Stat
              label="Intereses"
              value={formatCurrency(result.totalInterestPaid, currency)}
              valueClass="text-z-income"
              extra={
                interestSaved > 0
                  ? `Ahorras ${formatCurrency(interestSaved, currency)}`
                  : undefined
              }
            />
            <Stat
              label="Total"
              value={formatCurrency(result.totalAmountPaid, currency)}
              small
            />
          </View>
        </View>
      </MCard>

      {/* Payoff order */}
      {result.payoffOrder.length > 0 && (
        <MCard className="gap-2">
          <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
            Orden de liquidación
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {result.payoffOrder.map((entry, i) => (
              <View key={entry.accountId} className="flex-row items-center gap-1">
                <View className={`${PANEL_INSET_CLASS} flex-row items-center gap-1.5 px-2 py-1`}>
                  <View className="h-4 w-4 items-center justify-center rounded-full bg-white-8">
                    <Text className="text-[9px] font-inter-bold text-muted-foreground">
                      {i + 1}
                    </Text>
                  </View>
                  <Text className="text-[11px] font-inter-medium text-foreground">
                    {abbreviateName(
                      accounts.find((a) => a.id === entry.accountId)?.name ??
                        entry.accountName,
                      14
                    )}
                  </Text>
                  <View className="rounded-full bg-z-brass/10 px-1.5">
                    <Text className="text-[9px] font-inter-semibold text-z-brass">
                      {formatCalendarMonth(entry.calendarMonth)}
                    </Text>
                  </View>
                </View>
                {i < result.payoffOrder.length - 1 && (
                  <ArrowRight size={10} color={COLORS.sageDark} />
                )}
              </View>
            ))}
          </View>
        </MCard>
      )}

      {/* Income context */}
      {income && income > 0 && (
        <MCard className="gap-1">
          <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
            Contexto salarial
          </Text>
          <Text className="text-[12px] font-inter text-foreground">
            Hoy destinas{" "}
            <Text className="font-inter-semibold">
              {Math.min(
                100,
                Math.round(
                  ((baseline.timeline[0]?.accounts.reduce(
                    (s, a) => s + a.minimumPaymentApplied,
                    0
                  ) ?? 0) /
                    income) *
                    100
                )
              )}
              %
            </Text>{" "}
            de tu ingreso a deuda. Al final del plan: 0%.
          </Text>
        </MCard>
      )}

      {/* Month-by-month list */}
      <MCard className="gap-2">
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Mes a mes
        </Text>
        <Text className="text-[11px] font-inter text-muted-foreground">
          {result.timeline.length}{" "}
          {result.timeline.length === 1 ? "mes" : "meses"} hasta deuda cero.
        </Text>
        <MonthList timeline={result.timeline} currency={currency} />
      </MCard>
    </View>
  );
});

interface SummaryTileProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  compact?: boolean;
  highlight?: boolean;
}

const SummaryTile = memo(function SummaryTile({
  icon,
  value,
  label,
  compact,
  highlight,
}: SummaryTileProps) {
  return (
    <View
      className={`${PANEL_INSET_CLASS} flex-1 p-3 gap-1 ${highlight ? "border-z-income/30 bg-z-income/5" : ""}`}
    >
      <View className="flex-row items-center gap-1.5">{icon}</View>
      <Text
        className={`${compact ? "text-[14px]" : "text-[20px]"} font-inter-bold text-foreground`}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text className="text-[10px] font-inter text-muted-foreground">
        {label}
      </Text>
    </View>
  );
});

interface StatProps {
  label: string;
  value: string;
  valueClass?: string;
  extra?: string;
  small?: boolean;
}

const Stat = memo(function Stat({
  label,
  value,
  valueClass,
  extra,
  small,
}: StatProps) {
  return (
    <View className="gap-0.5">
      <Text className="text-[10px] font-inter text-muted-foreground">
        {label}
      </Text>
      <Text
        className={`${small ? "text-[12px]" : "text-[14px]"} font-inter-semibold ${valueClass ?? "text-foreground"}`}
        numberOfLines={1}
      >
        {value}
      </Text>
      {extra && (
        <Text className="text-[9px] font-inter text-z-income">{extra}</Text>
      )}
    </View>
  );
});

const INITIAL_MONTH_LIMIT = 36;

const MonthList = memo(function MonthList({
  timeline,
  currency,
}: {
  timeline: ScenarioMonth[];
  currency: CurrencyCode;
}) {
  const [expanded, setExpanded] = useState(false);
  const truncated = !expanded && timeline.length > INITIAL_MONTH_LIMIT;
  const visible = truncated ? timeline.slice(0, INITIAL_MONTH_LIMIT) : timeline;

  return (
    <View className="gap-1.5">
      {visible.map((m) => (
        <MonthRow key={m.month} month={m} currency={currency} />
      ))}
      {truncated && (
        <Pressable
          onPress={() => setExpanded(true)}
          className="rounded-xl border border-white-6 py-2.5 items-center"
        >
          <Text className="text-[12px] font-inter-semibold text-z-brass">
            Ver {timeline.length - INITIAL_MONTH_LIMIT} meses más
          </Text>
        </Pressable>
      )}
    </View>
  );
});

const MonthRow = memo(function MonthRow({
  month,
  currency,
}: {
  month: ScenarioMonth;
  currency: CurrencyCode;
}) {
  const events = month.events;
  const hasPaidOff = events.some((e) => e.type === "account_paid_off");
  const hasCash = events.some((e) => e.type === "cash_injection");
  const bgClass = hasPaidOff
    ? "bg-z-income/5 border-z-income/20"
    : hasCash
    ? "bg-z-brass/5 border-z-brass/20"
    : "border-white-6";

  return (
    <View className={`rounded-xl border ${bgClass} p-2.5 gap-1`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[12px] font-inter-semibold text-foreground">
          {formatCalendarMonth(month.calendarMonth)}
        </Text>
        <Text className="text-[12px] font-inter-semibold text-foreground">
          {formatCurrency(month.totalBalance, currency)}
        </Text>
      </View>
      {events.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mt-0.5">
          {events.map((ev, i) => (
            <EventBadge key={i} type={ev.type} description={ev.description} />
          ))}
        </View>
      )}
    </View>
  );
});

const EventBadge = memo(function EventBadge({
  type,
  description,
}: {
  type: string;
  description: string;
}) {
  if (type === "cash_injection") {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-z-brass/15 px-1.5 py-0.5">
        <Zap size={9} color={COLORS.brass} />
        <Text className="text-[9px] font-inter-semibold text-z-brass">
          {description}
        </Text>
      </View>
    );
  }
  if (type === "account_paid_off") {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-z-income/15 px-1.5 py-0.5">
        <CalendarCheck size={9} color={COLORS.income} />
        <Text className="text-[9px] font-inter-semibold text-z-income">
          {description}
        </Text>
      </View>
    );
  }
  if (type === "cascade_redirect") {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-z-alert/15 px-1.5 py-0.5">
        <ArrowRight size={9} color={COLORS.alert} />
        <Text className="text-[9px] font-inter-semibold text-z-alert">
          {description}
        </Text>
      </View>
    );
  }
  return null;
});

