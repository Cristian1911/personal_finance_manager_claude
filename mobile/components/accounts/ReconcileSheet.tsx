import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import type { AccountRow } from "../../lib/repositories/accounts";
import { reconcileBalance } from "../../lib/repositories/accounts";
import { isDebtAccountType } from "../../lib/constants/accounts";
import { parseFormattedAmount } from "../../lib/amount";
import { COLORS } from "../../lib/constants/colors";
import { BRASS_BUTTON_CLASS, PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { MobileSheet } from "../ui/MobileSheet";
import {
  SheetAmountInput,
  SheetError,
  SheetFieldLabel,
} from "./account-action-sheet-parts";

interface ReconcileSheetProps {
  visible: boolean;
  account: AccountRow;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Reconcile sheet → reconcileBalance (OVERWRITE). The user enters the real
 * current balance; reconcileBalance writes the balance directly + records the
 * adjustment transaction. Pre-fills the current balance.
 */
export function ReconcileSheet({ visible, account, onClose, onSuccess }: ReconcileSheetProps) {
  const currency = (account.currency_code as CurrencyCode) ?? "COP";
  const isDebt = isDebtAccountType(account.account_type ?? "OTHER");
  const currentBalance = Math.abs(account.current_balance ?? 0);

  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      // Pre-fill with the current balance (no thousands grouping — the numeric
      // keypad + parseFormattedAmount accept a plain integer).
      setAmountInput(currentBalance ? String(Math.round(currentBalance)) : "");
      setSubmitting(false);
      setError(null);
    }
  }, [visible, currentBalance]);

  const parsedAmount = parseFormattedAmount(amountInput);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0;
  const canSubmit = hasValidAmount && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await reconcileBalance(account.id, { currentBalance: parsedAmount });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ajustar el saldo.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, account.id, parsedAmount, onSuccess]);

  return (
    <MobileSheet visible={visible} onClose={onClose} hideHandle>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-[15px] font-inter-semibold text-foreground">Ajustar saldo</Text>
          <Pressable
            onPress={onClose}
            className="h-8 w-8 items-center justify-center rounded-full"
          >
            <X size={16} color={COLORS.sageLight} />
          </Pressable>
        </View>

        <ScrollView
          className="max-h-[80%]"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Account info */}
          <View className={`${PANEL_INSET_CLASS} p-3 mb-4`}>
            <Text className="text-sm font-inter-semibold text-foreground">{account.name}</Text>
            <Text className="text-[11px] font-inter text-muted-foreground mt-0.5">
              {isDebt ? "Deuda actual" : "Saldo actual"}
              {" · "}
              {formatCurrency(currentBalance, currency)}
            </Text>
          </View>

          <SheetFieldLabel>{isDebt ? "Deuda real" : "Saldo real"}</SheetFieldLabel>
          <View className="mb-2">
            <SheetAmountInput value={amountInput} onChangeText={setAmountInput} autoFocus />
          </View>
          <Text className="text-[11px] font-inter text-muted-foreground mb-3">
            Registramos un ajuste por la diferencia y dejamos el saldo en el valor que ingreses.
          </Text>

          {error && <SheetError message={error} />}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`${BRASS_BUTTON_CLASS} rounded-xl py-3 items-center mt-2 ${canSubmit ? "" : "opacity-40"}`}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.ink} />
            ) : (
              <Text className="text-sm font-inter-semibold text-z-ink">
                Guardar ajuste
              </Text>
            )}
          </Pressable>

          <Pressable onPress={onClose} className="items-center py-2">
            <Text className="text-sm font-inter-medium text-muted-foreground">Cancelar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileSheet>
  );
}
