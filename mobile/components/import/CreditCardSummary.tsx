import { useMemo } from "react";
import { View, Text } from "react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import { projectMinimumPayoff12mo } from "../../lib/utils/cc-projection";
import { useImportTheme } from "./import-theme";

type CreditCardMetadata = {
  credit_limit: number | null;
  available_credit: number | null;
  interest_rate: number | null;
  late_interest_rate: number | null;
  total_payment_due: number | null;
  minimum_payment: number | null;
  payment_due_date: string | null;
};

type StatementSummary = {
  previous_balance: number | null;
  total_credits: number | null;
  total_debits: number | null;
  final_balance: number | null;
  purchases_and_charges: number | null;
  interest_charged: number | null;
};

type Props = {
  metadata: CreditCardMetadata;
  summary: StatementSummary | null;
  transactionCount: number;
  currency: CurrencyCode;
};

/**
 * Compact currency formatter for projection stats.
 * $1.420.800 → "$ 1.42m", $492.000 → "$ 492k", $340 → "$ 340".
 * COP-only compacting — other currencies fall back to formatCurrency.
 */
function compactAmount(value: number, currency: CurrencyCode): string {
  if (currency !== "COP") return formatCurrency(value, currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$ ${m.toFixed(m < 10 ? 2 : 1)}m`;
  }
  if (abs >= 1_000) {
    return `${sign}$ ${Math.round(abs / 1_000)}k`;
  }
  return `${sign}$ ${Math.round(abs)}`;
}

/**
 * Whole-calendar-day difference between today and a "YYYY-MM-DD" string.
 * Treats both as local-timezone dates (Colombia UTC-5), not UTC midnight.
 */
function daysUntil(iso: string): number | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const target = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export function CreditCardSummary({
  metadata,
  summary,
  transactionCount,
  currency,
}: Props) {
  const { neutral } = useImportTheme();
  const surface2Cls = neutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2";
  const surface3Cls = neutral ? "bg-z-surface-3-neutral" : "bg-z-surface-3";

  const balance = metadata.total_payment_due;
  const dueDate = metadata.payment_due_date;
  const minPayment = metadata.minimum_payment;
  const interestRateEA = metadata.interest_rate;

  const projection = useMemo(
    () =>
      balance != null && interestRateEA != null && minPayment != null
        ? projectMinimumPayoff12mo(balance, interestRateEA / 100, minPayment)
        : null,
    [balance, interestRateEA, minPayment],
  );

  const days = useMemo(() => (dueDate ? daysUntil(dueDate) : null), [dueDate]);
  const daysLabel =
    days == null
      ? null
      : days < 0
        ? `${Math.abs(days)} días tarde`
        : days === 0
          ? "hoy"
          : `${days} día${days === 1 ? "" : "s"}`;

  const spent = summary?.purchases_and_charges ?? null;
  const paid = summary?.total_credits ?? null;
  const hasPeriodData = spent != null || paid != null || transactionCount > 0;

  return (
    <View>
      {/* DUE NOW card */}
      <View className={`rounded-2xl border border-white-6 ${surface2Cls} p-4`}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[10px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
              Saldo total
            </Text>
            <Text className="mt-1 text-[28px] font-inter-bold text-z-white tracking-tight">
              {balance != null ? formatCurrency(balance, currency) : "—"}
            </Text>
          </View>
          {dueDate && (
            <View className="items-end">
              <Text className="text-[10px] font-inter-semibold uppercase text-z-debt tracking-[0.18em]">
                Vence
              </Text>
              <Text className="mt-1 text-xl font-inter-semibold text-z-debt">
                {formatDate(dueDate, "d MMM")}
              </Text>
              {daysLabel && (
                <Text className="mt-0.5 text-[11px] font-inter text-z-sage-dark">
                  {daysLabel}
                </Text>
              )}
            </View>
          )}
        </View>

        {(minPayment != null || interestRateEA != null) && (
          <View className="mt-3.5 flex-row gap-2">
            <View className={`flex-1 rounded-xl border border-white-6 ${surface3Cls} px-3 py-2.5`}>
              <Text className="text-[9px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
                Pago mínimo
              </Text>
              <Text className="mt-1 text-lg font-inter-bold text-z-brass tracking-tight">
                {minPayment != null ? formatCurrency(minPayment, currency) : "—"}
              </Text>
            </View>
            <View className={`flex-1 rounded-xl border border-white-6 ${surface3Cls} px-3 py-2.5`}>
              <Text className="text-[9px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
                Tasa
              </Text>
              <Text className="mt-1 text-lg font-inter-bold text-z-white tracking-tight">
                {interestRateEA != null
                  ? `${interestRateEA.toFixed(2)}`
                  : "—"}
                {interestRateEA != null && (
                  <Text className="text-xs font-inter-medium text-z-sage-dark">
                    {" "}
                    %&nbsp;E.A.
                  </Text>
                )}
              </Text>
            </View>
          </View>
        )}

        {projection && (
          <View className="mt-3.5 rounded-xl border border-z-brass-30 bg-z-brass-6 px-4 py-3">
            <Text className="text-[10px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
              Si pagas solo el mínimo
            </Text>

            {projection.growing ? (
              <>
                <Text className="mt-2.5 font-inter-medium-italic text-sm text-z-debt">
                  El mínimo no cubre los intereses.
                </Text>
                <Text className="mt-1 font-inter-italic text-xs text-z-brass">
                  El saldo crecería cada mes. Paga más para empezar a reducirlo.
                </Text>
              </>
            ) : (
              <>
                <View className="mt-2.5 flex-row items-end gap-4">
                  <View className="flex-1">
                    <Text className="text-[22px] font-inter-bold text-z-white tracking-tight">
                      {projection.months} meses
                    </Text>
                    <Text className="mt-1 font-inter-italic text-xs text-z-brass">
                      aún pagando
                    </Text>
                  </View>
                  <View className="w-px self-stretch bg-z-brass-25" />
                  <View className="flex-1">
                    <Text className="text-[22px] font-inter-bold text-z-alert tracking-tight">
                      {compactAmount(projection.interestAccrued, currency)}
                    </Text>
                    <Text className="mt-1 font-inter-italic text-xs text-z-brass">
                      en intereses
                    </Text>
                  </View>
                </View>
                <View className="mt-2.5 border-t border-z-brass-20 pt-2.5">
                  <Text className="font-inter-italic text-xs text-z-brass">
                    Quedarían{" "}
                    <Text className="font-inter-semibold text-z-sage-light">
                      {compactAmount(projection.remainingBalance, currency)}
                    </Text>{" "}
                    de saldo en deuda.
                  </Text>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {/* THIS PERIOD tiles */}
      {hasPeriodData && (
        <View className="mt-4 flex-row gap-2">
          <PeriodTile
            label="Gastos"
            value={spent != null ? compactAmount(spent, currency) : "—"}
            tone="spent"
          />
          <PeriodTile
            label="Abonos"
            value={paid != null ? compactAmount(paid, currency) : "—"}
            tone="paid"
          />
          <PeriodTile
            label="Movs"
            value={String(transactionCount)}
            tone="txns"
          />
        </View>
      )}
    </View>
  );
}

function PeriodTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "spent" | "paid" | "txns";
}) {
  const { neutral } = useImportTheme();
  const surfaceCls = neutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2";
  const valueClass =
    tone === "spent"
      ? "text-z-debt"
      : tone === "paid"
        ? "text-z-income"
        : "text-z-white";
  return (
    <View className={`flex-1 rounded-xl border border-white-6 ${surfaceCls} p-3`}>
      <Text className="text-[9px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
        {label}
      </Text>
      <Text
        className={`mt-1.5 text-xl font-inter-bold tracking-tight ${valueClass}`}
      >
        {value}
      </Text>
    </View>
  );
}
