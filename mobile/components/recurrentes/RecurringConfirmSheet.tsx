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
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import type { AccountRow } from "../../lib/repositories/accounts";
import { recordRecurringOccurrencePayment } from "../../lib/repositories/recurring";
import type { OccurrenceWithTemplate } from "../../lib/repositories/recurring";
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
} from "../accounts/account-action-sheet-parts";

interface RecurringConfirmSheetProps {
  visible: boolean;
  occurrence: OccurrenceWithTemplate | null;
  /** All accounts — used to resolve the template's account type + liquid sources. */
  accounts: AccountRow[];
  currency: CurrencyCode;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Confirm-a-recurring-payment sheet → recordRecurringOccurrencePayment. Pre-fills
 * the expected amount (editable). If the template's account is a debt account
 * (CREDIT_CARD/LOAN) a source (liquid) account picker is required; otherwise the
 * user can confirm one-tap with the expected amount.
 */
export function RecurringConfirmSheet({
  visible,
  occurrence,
  accounts,
  currency,
  onClose,
  onSuccess,
}: RecurringConfirmSheetProps) {
  const router = useRouter();
  const templateAccount = useMemo(
    () => (occurrence ? accounts.find((a) => a.id === occurrence.account_id) ?? null : null),
    [occurrence, accounts]
  );
  // An "abono a deuda" (needs a source account) is only an INFLOW on a debt
  // account. An OUTFLOW is a recurring charge billed to the card — confirmed as
  // a single transaction, no source picker. Mirrors the webapp.
  const isDebt =
    isDebtAccountType(templateAccount?.account_type ?? "OTHER") &&
    occurrence?.direction === "INFLOW";

  const sourceAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.id !== occurrence?.account_id &&
          LIQUID_ACCOUNT_TYPES.has(a.account_type ?? "OTHER") &&
          a.currency_code === (templateAccount?.currency_code ?? a.currency_code)
      ),
    [accounts, occurrence?.account_id, templateAccount?.currency_code]
  );

  const [amountInput, setAmountInput] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Initialize once per open; the ref guard keeps a background account reload
  // from wiping the user's in-progress amount/source while the sheet is open.
  useEffect(() => {
    if (visible && occurrence) {
      if (!hasInitializedRef.current) {
        setAmountInput(String(Math.round(occurrence.expected_amount)));
        setSelectedSourceId(sourceAccounts[0]?.id ?? "");
        setShowSourcePicker(false);
        setSubmitting(false);
        setError(null);
        hasInitializedRef.current = true;
      }
    } else if (!visible) {
      hasInitializedRef.current = false;
    }
  }, [visible, occurrence, sourceAccounts]);

  const parsedAmount = parseLocalizedAmount(amountInput);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const sourceOk = !isDebt || selectedSourceId !== "";
  const canSubmit = !!occurrence && hasValidAmount && sourceOk && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !occurrence) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await recordRecurringOccurrencePayment({
        templateId: occurrence.template_id,
        occurrenceId: occurrence.id,
        occurrenceDate: occurrence.occurrence_date,
        actualAmount: parsedAmount,
        sourceAccountId: isDebt ? selectedSourceId : undefined,
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
  }, [canSubmit, occurrence, parsedAmount, isDebt, selectedSourceId, onSuccess]);

  if (!occurrence) return null;

  const label = occurrence.merchant_name || occurrence.description || "Pago recurrente";

  return (
    <MobileSheet visible={visible} onClose={onClose} hideHandle>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-[15px] font-inter-semibold text-foreground">Confirmar pago</Text>
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
          {/* Occurrence info */}
          <View className={`${PANEL_INSET_CLASS} p-3 mb-4`}>
            <Text className="text-sm font-inter-semibold text-foreground">{label}</Text>
            <Text className="text-[11px] font-inter text-muted-foreground mt-0.5">
              {formatDate(occurrence.occurrence_date, "dd MMM yyyy")}
              {templateAccount ? ` · ${templateAccount.name}` : ""}
              {" · "}
              {formatCurrency(occurrence.expected_amount, currency)}
            </Text>
          </View>

          {/* Amount */}
          <SheetFieldLabel>Monto pagado</SheetFieldLabel>
          <View className="mb-3">
            <SheetAmountInput value={amountInput} onChangeText={setAmountInput} />
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

          {error && <SheetError message={error} />}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`rounded-xl py-3 items-center mt-2 ${canSubmit ? "bg-z-brass" : "bg-z-brass/30"}`}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.ink} />
            ) : (
              // Disabled uses muted-foreground, not ink/50: over the dimmed
              // bg-z-brass/30 the ink composites to near-invisible.
              <Text className={`text-sm font-inter-semibold ${canSubmit ? "text-z-ink" : "text-muted-fg-70"}`}>
                Confirmar pago
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              onClose();
              router.push(`/recurrentes/${occurrence.template_id}/edit` as any);
            }}
            accessibilityRole="button"
            accessibilityLabel="Editar plantilla"
            className="items-center py-2"
          >
            <Text className="text-sm font-inter-medium text-z-brass">
              Editar plantilla
            </Text>
          </Pressable>

          <Pressable onPress={onClose} className="items-center py-2">
            <Text className="text-sm font-inter-medium text-muted-foreground">Cancelar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileSheet>
  );
}
