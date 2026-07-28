import { memo, useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import {
  formatCurrency,
  type CurrencyCode,
  type ScenarioResult,
} from "@zeta/shared";
import { Plus, Trophy, TrendingDown, X } from "lucide-react-native";
import { COLORS } from "../../../lib/constants/colors";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import { MCard } from "../../ui/MCard";
import type { PlannerAction, ScenarioState } from "./reducer";
import { formatDebtFreeDate, formatMonths, PLAN_COLORS } from "./utils";

interface Props {
  scenarios: ScenarioState[];
  results: Record<number, ScenarioResult>;
  baseline: ScenarioResult;
  currency: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
}

export const CompareStep = memo(function CompareStep({
  scenarios,
  results,
  baseline,
  currency,
  dispatch,
}: Props) {
  const recommendedIndex = useMemo(() => {
    let min = Infinity;
    let idx = 0;
    for (let i = 0; i < scenarios.length; i++) {
      const r = results[i];
      if (r && r.totalInterestPaid < min) {
        min = r.totalInterestPaid;
        idx = i;
      }
    }
    return idx;
  }, [scenarios.length, results]);

  const canAdd = scenarios.length < 3;

  return (
    <View className="gap-3">
      {/* Plan tabs */}
      <View className="flex-row items-center gap-2 flex-wrap">
        {scenarios.map((s, i) => (
          <PlanChip
            key={i}
            name={s.name}
            color={PLAN_COLORS[i] ?? COLORS.brass}
            recommended={i === recommendedIndex}
            removable={scenarios.length > 1}
            onPress={() => dispatch({ type: "SET_ACTIVE_SCENARIO", index: i })}
            onRemove={() =>
              dispatch({ type: "REMOVE_SCENARIO", index: i })
            }
          />
        ))}
        <Pressable
          onPress={() => dispatch({ type: "ADD_SCENARIO" })}
          disabled={!canAdd}
          className={`flex-row items-center gap-1 rounded-full border border-z-brass-30 px-3 py-1.5 ${!canAdd ? "opacity-40" : ""}`}
        >
          <Plus size={11} color={COLORS.brass} />
          <Text className="text-[11px] font-inter-semibold text-z-brass">
            Agregar plan
          </Text>
        </Pressable>
      </View>

      {/* Summary table */}
      <MCard className="gap-2">
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Resumen de planes
        </Text>
        <Text className="text-[11px] font-inter text-muted-foreground">
          Comparación con el escenario base (solo pagos mínimos).
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className={`${PANEL_INSET_CLASS} flex-row p-2 gap-2`}>
            <MetricCol
              label="Solo mínimos"
              months={baseline.totalMonths}
              interest={baseline.totalInterestPaid}
              total={baseline.totalAmountPaid}
              date={baseline.debtFreeDate}
              currency={currency}
              dim
            />
            {scenarios.map((s, i) => {
              const r = results[i];
              return (
                <MetricCol
                  key={i}
                  label={s.name}
                  color={PLAN_COLORS[i]}
                  months={r?.totalMonths ?? null}
                  interest={r?.totalInterestPaid ?? null}
                  total={r?.totalAmountPaid ?? null}
                  date={r?.debtFreeDate ?? null}
                  currency={currency}
                  monthsDelta={
                    r ? Math.max(0, baseline.totalMonths - r.totalMonths) : 0
                  }
                  recommended={i === recommendedIndex}
                />
              );
            })}
          </View>
        </ScrollView>
      </MCard>

      {/* Savings callouts */}
      <View className="gap-2">
        {scenarios.map((s, i) => {
          const r = results[i];
          if (!r) return null;
          const saved = baseline.totalInterestPaid - r.totalInterestPaid;
          if (saved <= 0) return null;
          return (
            <SavingsCard
              key={i}
              name={s.name}
              saved={saved}
              monthsLess={baseline.totalMonths - r.totalMonths}
              currency={currency}
            />
          );
        })}
      </View>

      {/* Note: timeline area chart deferred — see BACKLOG.md */}
    </View>
  );
});

interface PlanChipProps {
  name: string;
  color: string;
  recommended: boolean;
  removable: boolean;
  onPress: () => void;
  onRemove: () => void;
}

const PlanChip = memo(function PlanChip({
  name,
  color,
  recommended,
  removable,
  onPress,
  onRemove,
}: PlanChipProps) {
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-white-8 bg-z-surface-2 pl-2.5 pr-1 py-1.5">
      <Pressable
        onPress={onPress}
        className="flex-row items-center gap-1.5"
        hitSlop={6}
      >
        <View
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <Text className="text-[12px] font-inter-semibold text-foreground">
          {name}
        </Text>
        {recommended && <Trophy size={10} color={COLORS.income} />}
      </Pressable>
      {removable && (
        <Pressable onPress={onRemove} hitSlop={6} className="ml-1 p-0.5">
          <X size={11} color={COLORS.sageDark} />
        </Pressable>
      )}
    </View>
  );
});

interface MetricColProps {
  label: string;
  color?: string;
  months: number | null;
  interest: number | null;
  total: number | null;
  date: string | null;
  currency: CurrencyCode;
  monthsDelta?: number;
  recommended?: boolean;
  dim?: boolean;
}

const MetricCol = memo(function MetricCol({
  label,
  color,
  months,
  interest,
  total,
  date,
  currency,
  monthsDelta,
  recommended,
  dim,
}: MetricColProps) {
  return (
    <View className="min-w-[140px] gap-2 px-2 py-1">
      <View className="flex-row items-center gap-1.5">
        {color && (
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        <Text
          className={`text-[12px] font-inter-semibold ${dim ? "text-muted-foreground" : "text-foreground"}`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {recommended && (
          <View className="ml-auto rounded-full bg-z-income-12 px-1.5 py-0.5">
            <Text className="text-[8px] font-inter-bold text-z-income">★</Text>
          </View>
        )}
      </View>

      <MetricRow label="Meses" value={months != null ? formatMonths(months) : "—"}>
        {monthsDelta && monthsDelta > 0 ? (
          <Text className="text-[9px] font-inter text-z-income">
            {monthsDelta} menos
          </Text>
        ) : null}
      </MetricRow>
      <MetricRow
        label="Intereses"
        value={interest != null ? formatCurrency(interest, currency) : "—"}
        valueClass="text-z-expense"
      />
      <MetricRow
        label="Total pagado"
        value={total != null ? formatCurrency(total, currency) : "—"}
      />
      <MetricRow
        label="Libre de deuda"
        value={date ? formatDebtFreeDate(date) : "—"}
      />
    </View>
  );
});

interface MetricRowProps {
  label: string;
  value: string;
  valueClass?: string;
  children?: React.ReactNode;
}

const MetricRow = memo(function MetricRow({
  label,
  value,
  valueClass,
  children,
}: MetricRowProps) {
  return (
    <View className="gap-0.5">
      <Text className="text-[9px] font-inter uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text
        className={`text-[12px] font-inter-semibold ${valueClass ?? "text-foreground"}`}
        numberOfLines={1}
      >
        {value}
      </Text>
      {children}
    </View>
  );
});

interface SavingsCardProps {
  name: string;
  saved: number;
  monthsLess: number;
  currency: CurrencyCode;
}

const SavingsCard = memo(function SavingsCard({
  name,
  saved,
  monthsLess,
  currency,
}: SavingsCardProps) {
  return (
    <View className="rounded-2xl border border-z-income-30 bg-z-income-10 p-3 flex-row items-start gap-2">
      <TrendingDown size={14} color={COLORS.income} />
      <View className="flex-1">
        <Text className="text-[12px] font-inter text-z-income leading-snug">
          <Text className="font-inter-semibold">{name}</Text> ahorra{" "}
          <Text className="font-inter-semibold">
            {formatCurrency(saved, currency)}
          </Text>{" "}
          en intereses vs solo pagos mínimos
        </Text>
        {monthsLess > 0 && (
          <Text className="text-[10px] font-inter text-muted-foreground mt-1">
            Y terminas {monthsLess} {monthsLess === 1 ? "mes" : "meses"} antes
          </Text>
        )}
      </View>
    </View>
  );
});
