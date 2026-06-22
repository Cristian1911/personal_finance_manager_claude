import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { registerPayment } from "../../lib/repositories/accounts";
import { isDebtAccountType, LIQUID_ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { parseLocalizedAmount } from "../../lib/amount";
import { COLORS } from "../../lib/constants/colors";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { MobileSheet } from "../ui/MobileSheet";
import {
  SheetAccountPicker,
  SheetAmountInput,
  SheetError,
  SheetFieldLabel,
} from "./account-action-sheet-parts";

interface PaymentActionSheetProps {
  visible: boolean;
  /** The account being paid (debt account for the common Pagar case). */
  account: AccountRow;
  /** All accounts — used to derive the liquid source-account options. */
  allAccounts: AccountRow[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Quick payment sheet → registerPayment. For a debt account it shows a source
 * (liquid) account picker; the registerPayment INFLOW reduces the debt and the
 * paired source OUTFLOW deducts the cash. Mirrors PaymentSheet's amount-input +
 * source-picker + modal styling.
 */
export function PaymentActionSheet({
  visible,
  account,
  allAccounts,
  onClose,
  onSuccess,
}: PaymentActionSheetProps) {
  const currency = (account.currency_code as CurrencyCode) ?? "COP";
  const isDebt = isDebtAccountType(account.account_type ?? "OTHER");

  const sourceAccounts = useMemo(
    () =>
      allAccounts.filter(
        (a) =>
          a.id !== account.id &&
          LIQUID_ACCOUNT_TYPES.has(a.account_type ?? "OTHER") &&
          a.currency_code === account.currency_code
      ),
    [allAccounts, account.id, account.account_type, account.currency_code]
  );

  const [amountInput, setAmountInput] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Initialize once per open. `sourceAccounts` stays in deps for exhaustive-deps,
  // but the ref guard prevents a background account reload from wiping the user's
  // in-progress amount/source selection while the sheet is open.
  useEffect(() => {
    if (visible) {
      if (!hasInitializedRef.current) {
        setAmountInput("");
        setSelectedSourceId(sourceAccounts[0]?.id ?? "");
        setShowSourcePicker(false);
        setSubmitting(false);
        setError(null);
        hasInitializedRef.current = true;
      }
    } else {
      hasInitializedRef.current = false;
    }
  }, [visible, sourceAccounts]);

  const parsedAmount = parseLocalizedAmount(amountInput);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  // For debt accounts a source account is required (the paired OUTFLOW). For
  // non-debt accounts (recording income) the source is optional.
  const sourceOk = !isDebt || selectedSourceId !== "";
  const canSubmit = hasValidAmount && sourceOk && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await registerPayment(account.id, {
        amount: parsedAmount,
        sourceAccountId: selectedSourceId || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, account.id, parsedAmount, selectedSourceId, onSuccess]);

  const title = isDebt ? "Registrar pago" : "Registrar ingreso";

  return (
    <MobileSheet visible={visible} onClose={onClose} hideHandle>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-[15px] font-inter-semibold text-foreground">{title}</Text>
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
              {isDebt ? "Deuda actual" : "Saldo"}
              {" · "}
              {formatCurrency(Math.abs(account.current_balance ?? 0), currency)}
            </Text>
          </View>

          {/* Amount */}
          <SheetFieldLabel>{isDebt ? "Monto a pagar" : "Monto a registrar"}</SheetFieldLabel>
          <View className="mb-3">
            <SheetAmountInput value={amountInput} onChangeText={setAmountInput} autoFocus />
          </View>

          {/* Source account (debt → required) */}
          {isDebt && (
            <>
              <SheetFieldLabel>Cuenta origen</SheetFieldLabel>
              <SheetAccountPicker
                accounts={sourceAccounts}
                selectedId={selectedSourceId}
                onSelect={(id) => {
                  setSelectedSourceId(id);
                  setShowSourcePicker(false);
                }}
                open={showSourcePicker}
                onToggle={() => setShowSourcePicker((v) => !v)}
              />
            </>
          )}

          {/* Summary */}
          {hasValidAmount && (
            <View className="flex-row items-center justify-between mt-2 mb-2">
              <Text className="text-xs font-inter text-muted-foreground">
                {isDebt ? "Total a pagar" : "Total"}
              </Text>
              <Text className="text-base font-inter-bold text-foreground">
                {formatCurrency(parsedAmount, currency)}
              </Text>
            </View>
          )}

          {error && <SheetError message={error} />}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`rounded-xl py-3 items-center mt-2 ${canSubmit ? "bg-z-brass" : "bg-z-brass/30"}`}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.ink} />
            ) : (
              <Text className={`text-sm font-inter-semibold ${canSubmit ? "text-z-ink" : "text-z-ink/50"}`}>
                {isDebt ? "Confirmar pago" : "Registrar"}
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
