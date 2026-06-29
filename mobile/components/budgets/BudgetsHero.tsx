import { memo } from "react";
import { Text, View } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { PANEL_SURFACE_SUBTLE_CLASS, SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { StateChip } from "../ui/StateChip";

interface BudgetsHeroProps {
  spent: number;
  target: number;
  progress: number;
  currency: CurrencyCode;
}

/** Verdict pill mirrors the webapp budget hero: <80% en control, 80–99 atención,
 * >=100 sobre límite. */
function verdict(pct: number) {
  if (pct >= 100) return { label: "Sobre límite", variant: "danger" as const };
  if (pct >= 80) return { label: "Atención", variant: "warn" as const };
  return { label: "En control", variant: "sage" as const };
}

function BudgetsHeroBase({ spent, target, progress, currency }: BudgetsHeroProps) {
  const hasBudgets = target > 0;
  const pct = Math.round(progress);
  const over = pct >= 100;
  const chip = verdict(pct);

  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} p-5`}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className={SECTION_EYEBROW_CLASS}>Gastado este mes</Text>
        {hasBudgets && <StateChip label={chip.label} variant={chip.variant} />}
      </View>

      {hasBudgets ? (
        <>
          <View className="mt-2 flex-row items-end justify-between">
            <Text
              className={`text-5xl font-inter-bold leading-none ${over ? "text-z-debt" : "text-z-income"}`}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {pct}%
            </Text>
            <View className="items-end">
              <Text
                className="text-base font-inter-bold text-foreground"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatCurrency(spent, currency)}
              </Text>
              <Text
                className="text-[11px] font-inter text-muted-foreground"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                de {formatCurrency(target, currency)}
              </Text>
            </View>
          </View>

          <View className="mt-3 h-2.5 rounded-full bg-black-10">
            <View
              className={`h-2.5 rounded-full ${over ? "bg-z-debt" : "bg-z-income"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </View>
        </>
      ) : (
        <Text className="mt-2 text-sm font-inter text-muted-foreground">
          Aún no has fijado un presupuesto. Toca una categoría para empezar.
        </Text>
      )}
    </View>
  );
}

export const BudgetsHero = memo(BudgetsHeroBase);
