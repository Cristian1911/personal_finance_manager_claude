import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/constants/colors";
import { BRASS_BUTTON_CLASS, PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { MobileSheet } from "../ui/MobileSheet";
import { formatAmountInput, parseFormattedAmount } from "../../lib/amount";
import {
  createAssignment,
  deleteAssignment,
  updateAssignmentAmount,
} from "../../lib/repositories/planning";

import { ENVELOPE_COLORS } from "../../lib/constants/envelope-colors";

export interface ReassignTarget {
  assignmentId: string;
  expenseEntryId: string;
  expenseLabel: string;
  currentIncomeEntryId: string;
  currentAmount: number;
}

export interface IncomeOption {
  entryId: string;
  label: string;
  remainingAmount: number;
  colorIndex: number;
}

interface ReassignSheetProps {
  visible: boolean;
  target: ReassignTarget | null;
  incomeOptions: IncomeOption[];
  currency: CurrencyCode;
  periodId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReassignSheet({
  visible,
  target,
  incomeOptions,
  currency,
  periodId,
  onClose,
  onSuccess,
}: ReassignSheetProps) {
  const { session } = useAuth();
  const [selectedIncomeId, setSelectedIncomeId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setSelectedIncomeId(null);
    setAmountInput("");
    setError(null);
    onClose();
  }, [onClose]);

  // When selecting an income, pre-fill amount with min(current assignment, remaining on new envelope)
  const handleSelectIncome = useCallback((incomeId: string, remaining: number) => {
    setSelectedIncomeId(incomeId);
    if (target) {
      setAmountInput(
        formatAmountInput(
          String(
            Math.min(
              target.currentAmount,
              remaining +
                (incomeId === target.currentIncomeEntryId
                  ? target.currentAmount
                  : 0)
            )
          )
        )
      );
    }
  }, [target]);

  const handleReassign = useCallback(async () => {
    if (!target || !selectedIncomeId || !session?.user?.id) return;

    const amount = parseFormattedAmount(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Monto invalido");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (selectedIncomeId === target.currentIncomeEntryId) {
        // Same envelope — just update amount
        await updateAssignmentAmount(target.assignmentId, amount);
      } else {
        // Different envelope — delete old, create new
        await deleteAssignment(target.assignmentId);
        await createAssignment({
          user_id: session.user.id,
          period_id: periodId,
          income_entry_id: selectedIncomeId,
          expense_entry_id: target.expenseEntryId,
          assigned_amount: amount,
        });
      }

      handleClose();
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Error al reasignar");
    } finally {
      setSubmitting(false);
    }
  }, [target, selectedIncomeId, amountInput, session?.user?.id, periodId, handleClose, onSuccess]);

  if (!target) return null;

  // Available envelopes: include current (to change amount) + others with remaining capacity
  const options = incomeOptions.filter((opt) =>
    opt.entryId === target.currentIncomeEntryId || opt.remainingAmount > 0
  );

  return (
    <MobileSheet visible={visible} onClose={handleClose} maxHeightClass="max-h-[70%]" hideHandle>
      <View>
        <View>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-2 pb-2">
            <Text className="text-[15px] font-inter-semibold text-foreground">Reasignar gasto</Text>
            <Pressable onPress={handleClose} className="h-8 w-8 items-center justify-center rounded-full">
              <X size={16} color={COLORS.sageLight} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          >
            {/* Current assignment info */}
            <View className={`${PANEL_INSET_CLASS} p-3 mb-4`}>
              <Text className="text-sm font-inter-semibold text-foreground">{target.expenseLabel}</Text>
              <Text className="text-[11px] font-inter text-muted-foreground mt-0.5">
                Asignacion actual: {formatCurrency(target.currentAmount, currency)}
              </Text>
            </View>

            {/* Income envelope picker */}
            <Text className="text-xs font-inter-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Asignar a ingreso
            </Text>

            {options.length === 0 ? (
              <Text className="text-xs font-inter text-muted-foreground py-4 text-center">
                No hay ingresos con saldo disponible
              </Text>
            ) : (
              options.map((opt) => {
                const isSelected = selectedIncomeId === opt.entryId;
                const isCurrent = opt.entryId === target.currentIncomeEntryId;
                const color = ENVELOPE_COLORS[opt.colorIndex % ENVELOPE_COLORS.length];
                const displayRemaining = isCurrent
                  ? opt.remainingAmount + target.currentAmount
                  : opt.remainingAmount;

                return (
                  <Pressable
                    key={opt.entryId}
                    onPress={() => handleSelectIncome(opt.entryId, displayRemaining)}
                    className={`${PANEL_INSET_CLASS} flex-row items-center p-3 mb-2`}
                    style={isSelected ? { borderColor: color } : undefined}
                  >
                    <View className="h-3 w-3 rounded-full mr-3" style={{ backgroundColor: color }} />
                    <View className="flex-1">
                      <Text className="text-xs font-inter-semibold text-foreground">
                        {opt.label} {isCurrent ? "(actual)" : ""}
                      </Text>
                      <Text className="text-[10px] font-inter text-muted-foreground">
                        Disponible: {formatCurrency(displayRemaining, currency)}
                      </Text>
                    </View>
                    {isSelected && <Check size={16} color={color} />}
                  </Pressable>
                );
              })
            )}

            {/* Amount input */}
            {selectedIncomeId && (
              <View className="mt-3">
                <Text className="text-xs font-inter-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Monto a asignar
                </Text>
                <TextInput
                  className="rounded-xl border border-white-6 bg-black-10 px-3 py-2.5 text-sm font-inter-medium text-foreground"
                  placeholderTextColor={COLORS.sageDark}
                  placeholder="Monto"
                  keyboardType="numeric"
                  value={amountInput}
                  onChangeText={(next) => setAmountInput(formatAmountInput(next))}
                />
              </View>
            )}

            {error && (
              <View className="rounded-xl bg-z-debt-12 px-3 py-2 mt-2">
                <Text className="text-xs font-inter-medium text-z-debt">{error}</Text>
              </View>
            )}

            {/* Actions */}
            <Pressable
              onPress={handleReassign}
              disabled={!selectedIncomeId || submitting}
              className={`${BRASS_BUTTON_CLASS} rounded-xl py-3 items-center mt-4 ${selectedIncomeId ? "" : "opacity-40"}`}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.ink} />
              ) : (
                <Text className="text-sm font-inter-semibold text-z-ink">
                  Reasignar
                </Text>
              )}
            </Pressable>

            <Pressable onPress={handleClose} className="items-center py-3 mt-1">
              <Text className="text-sm font-inter-medium text-muted-foreground">Cancelar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </MobileSheet>
  );
}
