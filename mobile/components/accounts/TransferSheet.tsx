import { useCallback, useEffect, useMemo, useState } from "react";
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
import { createTransfer } from "../../lib/repositories/transfers";
import { parseLocalizedAmount } from "../../lib/amount";
import { toLocalDateString } from "../../lib/utils/date";
import { COLORS } from "../../lib/constants/colors";
import { MobileSheet } from "../ui/MobileSheet";
import {
  SheetAccountPicker,
  SheetAmountInput,
  SheetError,
  SheetFieldLabel,
} from "./account-action-sheet-parts";

interface TransferSheetProps {
  visible: boolean;
  allAccounts: AccountRow[];
  /** Optional pre-selected origin account. */
  initialFromAccountId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Transfer sheet → createTransfer. From-account picker + to-account picker
 * (filtered to the same currency — createTransfer hard-rejects cross-currency)
 * + amount. Mirrors PaymentSheet's picker + amount-input styling.
 */
export function TransferSheet({
  visible,
  allAccounts,
  initialFromAccountId,
  onClose,
  onSuccess,
}: TransferSheetProps) {
  const [fromId, setFromId] = useState<string>(initialFromAccountId ?? allAccounts[0]?.id ?? "");
  const [toId, setToId] = useState<string>("");
  const [amountInput, setAmountInput] = useState("");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setFromId(initialFromAccountId ?? allAccounts[0]?.id ?? "");
      setToId("");
      setAmountInput("");
      setShowFromPicker(false);
      setShowToPicker(false);
      setSubmitting(false);
      setError(null);
    }
  }, [visible, initialFromAccountId, allAccounts]);

  const fromAccount = useMemo(
    () => allAccounts.find((a) => a.id === fromId) ?? null,
    [allAccounts, fromId]
  );
  const currency = (fromAccount?.currency_code as CurrencyCode) ?? "COP";

  // Destination accounts: any account except the origin, same currency only
  // (createTransfer rejects cross-currency).
  const toAccounts = useMemo(
    () =>
      allAccounts.filter(
        (a) => a.id !== fromId && a.currency_code === fromAccount?.currency_code
      ),
    [allAccounts, fromId, fromAccount?.currency_code]
  );

  const parsedAmount = parseLocalizedAmount(amountInput);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const canSubmit = !!fromId && !!toId && hasValidAmount && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createTransfer({
        fromAccountId: fromId,
        toAccountId: toId,
        amount: parsedAmount,
        date: toLocalDateString(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la transferencia.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, fromId, toId, parsedAmount, onSuccess]);

  return (
    <MobileSheet visible={visible} onClose={onClose} hideHandle>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-[15px] font-inter-semibold text-foreground">
            Nueva transferencia
          </Text>
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
          {/* From */}
          <SheetFieldLabel>Desde</SheetFieldLabel>
          <SheetAccountPicker
            accounts={allAccounts}
            selectedId={fromId}
            onSelect={(id) => {
              setFromId(id);
              // Origin changed → destination currency filter changes; reset to.
              setToId("");
              setShowFromPicker(false);
            }}
            open={showFromPicker}
            onToggle={() => setShowFromPicker((v) => !v)}
          />

          {/* To */}
          <SheetFieldLabel>Hacia</SheetFieldLabel>
          <SheetAccountPicker
            accounts={toAccounts}
            selectedId={toId}
            onSelect={(id) => {
              setToId(id);
              setShowToPicker(false);
            }}
            open={showToPicker}
            onToggle={() => setShowToPicker((v) => !v)}
            placeholder="Seleccionar cuenta destino"
          />

          {/* Amount */}
          <SheetFieldLabel>Monto</SheetFieldLabel>
          <View className="mb-3">
            <SheetAmountInput value={amountInput} onChangeText={setAmountInput} />
          </View>

          {/* Summary */}
          {hasValidAmount && (
            <View className="flex-row items-center justify-between mt-1 mb-2">
              <Text className="text-xs font-inter text-muted-foreground">Total a transferir</Text>
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
                Confirmar transferencia
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
