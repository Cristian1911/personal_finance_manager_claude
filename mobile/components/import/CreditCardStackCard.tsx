import { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
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
  currency: CurrencyCode;
  metadata: CreditCardMetadata;
  summary: StatementSummary | null;
  transactionCount: number;
  active?: boolean;
  onPress?: () => void;
};

function compactAmount(value: number, currency: CurrencyCode): string {
  if (currency !== "COP") return formatCurrency(value, currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$ ${m.toFixed(m < 10 ? 2 : 1)}m`;
  }
  if (abs >= 1_000) return `${sign}$ ${Math.round(abs / 1_000)}k`;
  return `${sign}$ ${Math.round(abs)}`;
}

export function CreditCardStackCard({
  currency,
  metadata,
  summary,
  transactionCount,
  active = false,
  onPress,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const balance = metadata.total_payment_due;
  const minPayment = metadata.minimum_payment;
  const interestRateEA = metadata.interest_rate;
  const dueDate = metadata.payment_due_date;

  const projection = useMemo(
    () =>
      balance != null && interestRateEA != null && minPayment != null
        ? projectMinimumPayoff12mo(balance, interestRateEA / 100, minPayment)
        : null,
    [balance, interestRateEA, minPayment],
  );

  const { neutral } = useImportTheme();
  const borderCls = active ? "border-z-brass" : "border-white-6";
  const bgCls = active
    ? "bg-z-brass-8"
    : neutral
      ? "bg-z-surface-2-neutral"
      : "bg-z-surface-2";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver movimientos en ${currency}`}
      className={`mb-2 rounded-2xl border ${borderCls} ${bgCls} p-3.5`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-inter-bold uppercase tracking-[0.18em] text-z-brass">
          {currency}
        </Text>
        {dueDate && (
          <Text className="text-xs font-inter-semibold text-z-debt">
            Vence {formatDate(dueDate, "d MMM")}
          </Text>
        )}
      </View>

      <View className="mt-2 flex-row items-end gap-3">
        <View className="flex-1">
          <Text className="text-[10px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Saldo
          </Text>
          <Text className="mt-0.5 text-[22px] font-inter-bold tracking-tight text-z-white">
            {balance != null ? formatCurrency(balance, currency) : "—"}
          </Text>
        </View>
        {minPayment != null && (
          <>
            <View className="h-10 w-px self-center bg-z-sage-10" />
            <View className="flex-1">
              <Text className="text-[10px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Pago mínimo
              </Text>
              <Text className="mt-0.5 text-[22px] font-inter-bold tracking-tight text-z-brass">
                {formatCurrency(minPayment, currency)}
              </Text>
            </View>
          </>
        )}
      </View>

      {interestRateEA != null && (
        <Text className="mt-1.5 text-[11px] font-inter text-z-sage-dark">
          Tasa {interestRateEA.toFixed(2)}% E.A.
        </Text>
      )}

      {projection && (
        <View className="mt-2.5 border-t border-z-sage-10 pt-2.5">
          {projection.growing ? (
            <Text className="font-inter-italic text-[11px] text-z-debt">
              El mínimo no cubre intereses — saldo crecería.
            </Text>
          ) : (
            <Text className="font-inter-italic text-[11px] text-z-brass">
              Con mínimo:{" "}
              <Text className="font-inter-bold not-italic text-z-alert">
                {compactAmount(projection.interestAccrued, currency)}
              </Text>{" "}
              en intereses 12 meses · queda{" "}
              <Text className="font-inter-semibold not-italic text-z-sage-light">
                {compactAmount(projection.remainingBalance, currency)}
              </Text>
            </Text>
          )}
        </View>
      )}

      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Ocultar detalles" : "Ver detalles"}
        className="mt-2.5 flex-row items-center gap-1 self-start"
      >
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          {expanded ? "Ocultar detalles" : "Ver detalles"}
        </Text>
        <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
          <ChevronDown size={12} color={COLORS.sageDark} />
        </View>
      </Pressable>

      {expanded && (
        <View className="mt-2.5 gap-1.5 border-t border-z-sage-10 pt-2.5">
          <DetailRow
            label="Cupo total"
            value={
              metadata.credit_limit != null
                ? formatCurrency(metadata.credit_limit, currency)
                : null
            }
          />
          <DetailRow
            label="Cupo disponible"
            value={
              metadata.available_credit != null
                ? formatCurrency(metadata.available_credit, currency)
                : null
            }
          />
          <DetailRow
            label="Tasa moratoria"
            value={
              metadata.late_interest_rate != null
                ? `${metadata.late_interest_rate.toFixed(2)}% E.A.`
                : null
            }
          />
          <DetailRow
            label="Saldo anterior"
            value={
              summary?.previous_balance != null
                ? formatCurrency(summary.previous_balance, currency)
                : null
            }
          />
          <DetailRow
            label="Compras y cargos"
            value={
              summary?.purchases_and_charges != null
                ? formatCurrency(summary.purchases_and_charges, currency)
                : null
            }
          />
          <DetailRow
            label="Abonos"
            value={
              summary?.total_credits != null
                ? formatCurrency(summary.total_credits, currency)
                : null
            }
          />
          <DetailRow
            label="Intereses del mes"
            value={
              summary?.interest_charged != null
                ? formatCurrency(summary.interest_charged, currency)
                : null
            }
          />
          <DetailRow
            label="Saldo final"
            value={
              summary?.final_balance != null
                ? formatCurrency(summary.final_balance, currency)
                : null
            }
          />
          <DetailRow label="Movimientos" value={String(transactionCount)} />
        </View>
      )}
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (value == null) return null;
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[11px] font-inter text-z-sage-dark">{label}</Text>
      <Text className="text-[12px] font-inter-semibold text-z-sage-light">
        {value}
      </Text>
    </View>
  );
}
