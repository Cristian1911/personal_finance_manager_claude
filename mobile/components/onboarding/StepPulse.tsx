import { Text, TextInput, View } from "react-native";
import { formatCurrency } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { parseMoney } from "../../lib/utils/money";
import { Narrator } from "../common/Narrator";
import type { AppPurpose, CurrencyCode } from "./types";

type Props = {
  purpose: AppPurpose;
  currency: CurrencyCode;
  income: string;
  onIncomeChange: (next: string) => void;
  expenses: string;
  onExpensesChange: (next: string) => void;
  debtCount: string;
  onDebtCountChange: (next: string) => void;
  neutral?: boolean;
};

export function StepPulse({
  purpose,
  currency,
  income,
  onIncomeChange,
  expenses,
  onExpensesChange,
  debtCount,
  onDebtCountChange,
  neutral = false,
}: Props) {
  const surface = neutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2";
  const incomeN = parseMoney(income);
  const expensesN = parseMoney(expenses);
  const available = incomeN - expensesN;
  const hasBothValues = incomeN > 0 && expensesN > 0;
  const negative = hasBothValues && available < 0;
  const debtCountN = Math.max(0, Math.min(20, Number(debtCount) || 0));

  return (
    <View className="gap-5">
      <View className="gap-1.5">
        <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Ingreso mensual estimado
        </Text>
        <TextInput
          value={income}
          onChangeText={onIncomeChange}
          keyboardType="numeric"
          placeholder="5000000"
          placeholderTextColor={COLORS.sageDark}
          accessibilityLabel="Ingreso mensual estimado"
          className={`rounded-xl border border-z-sage-10 ${surface} px-4 py-3 font-inter-semibold text-base text-z-white tabular-nums`}
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Gasto mensual estimado
        </Text>
        <TextInput
          value={expenses}
          onChangeText={onExpensesChange}
          keyboardType="numeric"
          placeholder="3200000"
          placeholderTextColor={COLORS.sageDark}
          accessibilityLabel="Gasto mensual estimado"
          className={`rounded-xl border border-z-sage-10 ${surface} px-4 py-3 font-inter-semibold text-base text-z-white tabular-nums`}
        />
      </View>

      {hasBothValues &&
        (negative ? (
          <View className="rounded-xl border border-z-debt-20 bg-z-debt-5 px-4 py-3">
            <Text className="font-inter-semibold text-sm text-z-debt">
              Tus gastos superan tus ingresos en{" "}
              {formatCurrency(Math.abs(available), currency)}.
            </Text>
            <Text className="mt-1 font-inter text-xs text-z-sage-light">
              No pasa nada — Zeta te va a ayudar a cerrar esa brecha. Seguimos.
            </Text>
          </View>
        ) : (
          <View className="rounded-xl border border-z-brass-20 bg-z-brass-8 px-4 py-3">
            <Text className="font-inter-semibold text-sm text-z-brass">
              Disponible para presupuestar: {formatCurrency(available, currency)}
            </Text>
            <Text className="mt-1 font-inter text-xs text-z-sage-light">
              Esta referencia nos ayuda a sugerirte límites desde el día uno.
            </Text>
          </View>
        ))}

      {purpose === "manage_debt" && (
        <View className="gap-1.5">
          <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            ¿Cuántas tarjetas o préstamos tienes?
          </Text>
          <TextInput
            value={debtCount}
            onChangeText={onDebtCountChange}
            keyboardType="numeric"
            placeholder="2"
            placeholderTextColor={COLORS.sageDark}
            accessibilityLabel="Cantidad de tarjetas o préstamos"
            className={`rounded-xl border border-z-sage-10 ${surface} px-4 py-3 font-inter-semibold text-base text-z-white tabular-nums`}
          />
          {debtCountN > 0 && (
            <Narrator tone="brass" spacing="tight">
              {debtCountN === 1
                ? "Dale, Zeta te ayuda a organizar tu deuda."
                : `Dale, Zeta te ayuda a organizar tus ${debtCountN} deudas.`}
            </Narrator>
          )}
        </View>
      )}
    </View>
  );
}
