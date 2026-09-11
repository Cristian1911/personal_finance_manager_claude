import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { ArrowLeftRight } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { getConversionRates } from "../../lib/exchange-rates";
import { COLORS } from "../../lib/constants/colors";

type Props = {
  amount: number;
  /** Currency the amount is in (the account's). */
  currency: CurrencyCode;
  /** Profile currency — first target. */
  baseCurrency: CurrencyCode;
  /** Currency of where the phone is (from travel context) — second target. */
  localCurrency?: CurrencyCode | null;
  align?: "center" | "left";
};

/**
 * "≈ $ 412.000 COP · ≈ $ 98.000 ARS" under a foreign-currency amount.
 * Renders nothing when the amount is already in every target, when the
 * amount is empty, or while no rate is known (offline, never cached).
 */
export function ConversionHint({
  amount,
  currency,
  baseCurrency,
  localCurrency,
  align = "center",
}: Props) {
  const targets = useMemo(() => {
    const list: CurrencyCode[] = [];
    if (baseCurrency !== currency) list.push(baseCurrency);
    if (localCurrency && localCurrency !== currency && localCurrency !== baseCurrency) {
      list.push(localCurrency);
    }
    return list;
  }, [baseCurrency, currency, localCurrency]);
  const targetsKey = targets.join(",");

  const [rates, setRates] = useState<Partial<Record<CurrencyCode, number>> | null>(null);

  useEffect(() => {
    if (targets.length === 0) return;
    let active = true;
    getConversionRates(currency, targets).then((result) => {
      if (active) setRates(result);
    });
    return () => {
      active = false;
    };
    // targets is derived from targetsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, targetsKey]);

  if (targets.length === 0 || !Number.isFinite(amount) || amount <= 0 || !rates) return null;

  const parts = targets
    .map((target) => {
      const rate = rates[target];
      return rate ? `≈ ${formatCurrency(amount * rate, target)} ${target}` : null;
    })
    .filter((p): p is string => p !== null);
  if (parts.length === 0) return null;

  return (
    <View
      className={`flex-row items-center gap-1.5 ${align === "center" ? "justify-center" : ""}`}
      accessibilityLabel={`Equivale a ${parts.join(" y ")}`}
    >
      <ArrowLeftRight size={12} color={COLORS.brass} />
      <Text
        className="text-[11px] font-inter text-muted-foreground"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {parts.join("  ·  ")}
      </Text>
    </View>
  );
}
