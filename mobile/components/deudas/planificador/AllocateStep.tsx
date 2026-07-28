import { memo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  formatCurrency,
  type ScenarioResult,
  type ScenarioStrategy,
  type CurrencyCode,
} from "@zeta/shared";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  ListOrdered,
  Mountain,
  Snowflake,
} from "lucide-react-native";
import { COLORS } from "../../../lib/constants/colors";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import { MCard } from "../../ui/MCard";
import type { DebtAccountInfo } from "../../../lib/repositories/debt";
import type { PlannerAction, ScenarioState } from "./reducer";
import { abbreviateName, formatDebtFreeDate } from "./utils";

interface Props {
  accounts: DebtAccountInfo[];
  scenario: ScenarioState;
  scenarioIndex: number;
  result: ScenarioResult | undefined;
  currency: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
}

export const AllocateStep = memo(function AllocateStep({
  accounts,
  scenario,
  scenarioIndex,
  result,
  currency,
  dispatch,
}: Props) {
  const sortedPreview =
    scenario.strategy === "custom"
      ? []
      : [...accounts]
          .filter((a) => a.balance > 0)
          .sort((a, b) =>
            scenario.strategy === "avalanche"
              ? b.interestRate - a.interestRate || a.balance - b.balance
              : a.balance - b.balance || b.interestRate - a.interestRate
          );

  const currentPriority =
    scenario.allocations.customPriority ?? accounts.map((a) => a.id);

  function changeStrategy(next: ScenarioStrategy) {
    const nextPriority =
      next === "custom"
        ? scenario.allocations.customPriority ?? accounts.map((a) => a.id)
        : scenario.allocations.customPriority;
    dispatch({
      type: "UPDATE_SCENARIO",
      index: scenarioIndex,
      state: {
        strategy: next,
        allocations: {
          ...scenario.allocations,
          customPriority:
            next === "custom"
              ? nextPriority
              : scenario.allocations.customPriority,
        },
      },
    });
  }

  function move(idx: number, dir: "up" | "down") {
    const next = [...currentPriority];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    dispatch({
      type: "UPDATE_SCENARIO",
      index: scenarioIndex,
      state: {
        allocations: { ...scenario.allocations, customPriority: next },
      },
    });
  }

  function setCascade(fromAccountId: string, toAccountId: string | "auto") {
    const filtered = scenario.allocations.cascadeRedirects.filter(
      (r) => r.fromAccountId !== fromAccountId
    );
    const next =
      toAccountId === "auto"
        ? filtered
        : [...filtered, { fromAccountId, toAccountId }];
    dispatch({
      type: "UPDATE_SCENARIO",
      index: scenarioIndex,
      state: {
        allocations: { ...scenario.allocations, cascadeRedirects: next },
      },
    });
  }

  function getCascade(fromAccountId: string): string {
    return (
      scenario.allocations.cascadeRedirects.find(
        (r) => r.fromAccountId === fromAccountId
      )?.toAccountId ?? "auto"
    );
  }

  const orderedAccounts =
    scenario.strategy === "custom"
      ? currentPriority
          .map((id) => accounts.find((a) => a.id === id))
          .filter((a): a is DebtAccountInfo => Boolean(a))
      : accounts;

  return (
    <View className="gap-3">
      <MCard className="gap-2">
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Estrategia de pago
        </Text>
        <Text className="text-[12px] font-inter text-muted-foreground">
          Cómo se distribuye el dinero extra entre tus deudas.
        </Text>

        <StrategyTile
          selected={scenario.strategy === "avalanche"}
          icon={<Mountain size={14} color={COLORS.brass} />}
          title="Avalancha"
          description="Paga primero la tasa más alta. Minimiza intereses totales."
          onPress={() => changeStrategy("avalanche")}
        />
        <StrategyTile
          selected={scenario.strategy === "snowball"}
          icon={<Snowflake size={14} color={COLORS.brass} />}
          title="Bola de Nieve"
          description="Paga primero el saldo más bajo. Victorias rápidas para motivación."
          onPress={() => changeStrategy("snowball")}
        />
        <StrategyTile
          selected={scenario.strategy === "custom"}
          icon={<ListOrdered size={14} color={COLORS.brass} />}
          title="Personalizado"
          description="Define tu propio orden de prioridad."
          onPress={() => changeStrategy("custom")}
        />

        {sortedPreview.length > 0 && (
          <View className={`${PANEL_INSET_CLASS} p-3 mt-1 gap-1`}>
            <Text className="text-[10px] font-inter-semibold text-muted-foreground mb-1">
              Orden de ataque inicial
            </Text>
            {sortedPreview.map((a, i) => (
              <View key={a.id} className="flex-row items-center gap-2">
                <PriorityBadge n={i + 1} />
                <Text
                  className="text-[12px] font-inter-semibold text-foreground flex-1"
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {a.interestRate != null ? `${a.interestRate}% EA · ` : ""}
                  {formatCurrency(a.balance, currency)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </MCard>

      {scenario.strategy === "custom" && (
        <MCard className="gap-2">
          <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
            Orden de prioridad
          </Text>
          <Text className="text-[12px] font-inter text-muted-foreground">
            El primero recibe el extra; los demás solo pagan mínimos.
          </Text>
          {orderedAccounts.map((a, idx) => (
            <View
              key={a.id}
              className={`${PANEL_INSET_CLASS} flex-row items-center gap-2 p-2.5`}
            >
              <Text className="w-5 text-center text-[12px] font-inter-semibold text-muted-foreground">
                {idx + 1}
              </Text>
              <View className="flex-1 min-w-0">
                <Text
                  className="text-[13px] font-inter-medium text-foreground"
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {a.interestRate != null
                    ? `${a.interestRate.toFixed(1)}% · `
                    : ""}
                  {formatCurrency(a.balance, currency)}
                </Text>
              </View>
              <View className="flex-row gap-1">
                <Pressable
                  onPress={() => move(idx, "up")}
                  disabled={idx === 0}
                  hitSlop={6}
                  className={`p-1.5 ${idx === 0 ? "opacity-30" : ""}`}
                >
                  <ArrowUp size={14} color={COLORS.brass} />
                </Pressable>
                <Pressable
                  onPress={() => move(idx, "down")}
                  disabled={idx === orderedAccounts.length - 1}
                  hitSlop={6}
                  className={`p-1.5 ${idx === orderedAccounts.length - 1 ? "opacity-30" : ""}`}
                >
                  <ArrowDown size={14} color={COLORS.brass} />
                </Pressable>
              </View>
            </View>
          ))}
        </MCard>
      )}

      {accounts.length > 1 && (
        <MCard className="gap-2">
          <View className="flex-row items-center gap-2">
            <ArrowRight size={12} color={COLORS.sageDark} />
            <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
              Cascada de pagos
            </Text>
          </View>
          <Text className="text-[12px] font-inter text-muted-foreground">
            Cuando una deuda se liquide, ¿a cuál redirigir el pago liberado?
          </Text>
          {accounts.map((a) => (
            <CascadeRow
              key={a.id}
              account={a}
              currency={currency}
              currentTo={getCascade(a.id)}
              options={accounts.filter((other) => other.id !== a.id)}
              onChange={(to) => setCascade(a.id, to)}
            />
          ))}
        </MCard>
      )}

      {result && (
        <MCard className="gap-2">
          <View className="flex-row items-center gap-2">
            <CalendarCheck size={12} color={COLORS.sageDark} />
            <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
              Proyección
            </Text>
          </View>
          <View className="flex-row gap-3">
            <ProjectionStat
              value={`${result.totalMonths}`}
              label={result.totalMonths === 1 ? "mes" : "meses"}
            />
            <ProjectionStat
              value={formatCurrency(result.totalInterestPaid, currency)}
              label="intereses"
              compact
            />
            <ProjectionStat
              value={formatDebtFreeDate(result.debtFreeDate)}
              label="libre de deuda"
              compact
            />
          </View>
        </MCard>
      )}
    </View>
  );
});

interface StrategyTileProps {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
}

const StrategyTile = memo(function StrategyTile({
  selected,
  icon,
  title,
  description,
  onPress,
}: StrategyTileProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl border p-3 ${selected ? "border-z-brass bg-z-brass-10" : "border-white-6"}`}
    >
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-[13px] font-inter-semibold text-foreground">
          {title}
        </Text>
        {selected && (
          <View className="ml-auto rounded-full bg-z-brass px-2 py-0.5">
            <Text className="text-[9px] font-inter-bold text-z-ink">ACTIVO</Text>
          </View>
        )}
      </View>
      <Text className="text-[11px] font-inter text-muted-foreground mt-1">
        {description}
      </Text>
    </Pressable>
  );
});

const PriorityBadge = memo(function PriorityBadge({ n }: { n: number }) {
  return (
    <View className="h-4 w-4 items-center justify-center rounded-full bg-white-8">
      <Text className="text-[9px] font-inter-bold text-muted-foreground">{n}</Text>
    </View>
  );
});

interface CascadeRowProps {
  account: DebtAccountInfo;
  currency: CurrencyCode;
  currentTo: string;
  options: DebtAccountInfo[];
  onChange: (to: string | "auto") => void;
}

const CascadeRow = memo(function CascadeRow({
  account,
  currency,
  currentTo,
  options,
  onChange,
}: CascadeRowProps) {
  const [open, setOpen] = useState(false);
  const targetName =
    currentTo === "auto"
      ? "Automático"
      : options.find((o) => o.id === currentTo)?.name ?? "Automático";

  return (
    <View className={`${PANEL_INSET_CLASS} p-2.5 gap-1.5`}>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 min-w-0">
          <Text
            className="text-[13px] font-inter-medium text-foreground"
            numberOfLines={1}
          >
            {account.name}
          </Text>
          <Text className="text-[10px] font-inter text-muted-foreground">
            {account.interestRate != null
              ? `${account.interestRate.toFixed(1)}% · `
              : ""}
            {formatCurrency(account.balance, currency)}
          </Text>
        </View>
        <ArrowRight size={12} color={COLORS.sageDark} />
        <Pressable
          onPress={() => setOpen((v) => !v)}
          className="rounded-md border border-white-6 px-2.5 py-1.5 min-w-[110px]"
        >
          <Text
            className="text-[11px] font-inter-medium text-foreground"
            numberOfLines={1}
          >
            {targetName} {open ? "▲" : "▼"}
          </Text>
        </Pressable>
      </View>
      {open && (
        <View className="gap-1 mt-1">
          <Pressable
            onPress={() => {
              onChange("auto");
              setOpen(false);
            }}
            className={`rounded-md px-2 py-1.5 ${currentTo === "auto" ? "bg-z-brass-20" : ""}`}
          >
            <Text className="text-[12px] font-inter text-foreground">
              Automático
            </Text>
          </Pressable>
          {options.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`rounded-md px-2 py-1.5 ${currentTo === o.id ? "bg-z-brass-20" : ""}`}
            >
              <Text
                className="text-[12px] font-inter text-foreground"
                numberOfLines={1}
              >
                {abbreviateName(o.name, 24)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
});

const ProjectionStat = memo(function ProjectionStat({
  value,
  label,
  compact,
}: {
  value: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <View className="flex-1 items-center">
      <Text
        className={`${compact ? "text-[12px]" : "text-[18px]"} font-inter-bold text-foreground text-center`}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text className="text-[10px] font-inter text-muted-foreground mt-0.5 text-center">
        {label}
      </Text>
    </View>
  );
});
