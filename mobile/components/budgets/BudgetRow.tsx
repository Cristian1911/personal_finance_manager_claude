import { memo, useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import {
  BRASS_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  FORM_INPUT_CLASS,
  GHOST_BUTTON_CLASS,
  PANEL_SURFACE_SUBTLE_CLASS,
} from "../../lib/constants/styles";
import { parseLocalizedAmount } from "../../lib/amount";
import { COLORS } from "../../lib/constants/colors";
import type { BudgetProgressRow } from "../../lib/repositories/budgets";

interface BudgetRowProps {
  item: BudgetProgressRow;
  currency: CurrencyCode;
  saving: boolean;
  onSave: (item: BudgetProgressRow, amount: number) => Promise<void>;
  onDelete: (item: BudgetProgressRow) => Promise<void>;
}

function progressBarClass(progress: number): string {
  if (progress >= 100) return "bg-z-debt";
  if (progress >= 80) return "bg-z-alert";
  return "bg-z-income";
}

function BudgetRowBase({ item, currency, saving, onSave, onDelete }: BudgetRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [amountInput, setAmountInput] = useState(String(Math.round(item.amount)));

  const toggle = useCallback(() => {
    if (!expanded) {
      setAmountInput(String(Math.round(item.amount)));
    }
    setExpanded((prev) => !prev);
  }, [expanded, item.amount]);

  const handleSave = useCallback(async () => {
    const parsed = parseLocalizedAmount(amountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    await onSave(item, parsed);
    setExpanded(false);
  }, [amountInput, item, onSave]);

  const handleDelete = useCallback(async () => {
    await onDelete(item);
    setExpanded(false);
  }, [item, onDelete]);

  const clamped = Math.min(item.progress, 100);

  return (
    <View className={`${PANEL_SURFACE_SUBTLE_CLASS} mb-3 p-4`}>
      <Pressable onPress={toggle} className="active:opacity-80">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-shrink min-w-0">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.category_color ?? COLORS.sageDark }}
            />
            <Text
              className="font-inter-semibold text-foreground flex-shrink"
              numberOfLines={1}
            >
              {item.category_name}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-inter-medium text-muted-foreground">
              {Math.round(item.progress)}%
            </Text>
            <ChevronDown
              size={14}
              color={COLORS.sageDark}
              style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
            />
          </View>
        </View>

        <Text className="mt-2 text-sm font-inter text-muted-foreground">
          {formatCurrency(item.spent, currency)} · {formatCurrency(item.amount, currency)}
        </Text>

        <View className="mt-3 h-2 rounded-full bg-black-10">
          <View
            className={`${progressBarClass(item.progress)} h-2 rounded-full`}
            style={{ width: `${clamped}%` }}
          />
        </View>
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View className="mt-4 gap-3">
          <Text className="text-[11px] font-inter-semibold uppercase tracking-[2px] text-z-sage-dark">
            Monto mensual
          </Text>
          <TextInput
            value={amountInput}
            onChangeText={setAmountInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={COLORS.sageDark}
            className={FORM_INPUT_CLASS}
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className={`${BRASS_BUTTON_CLASS} flex-1 items-center rounded-xl py-3 active:opacity-80`}
            >
              <Text className="font-inter-semibold text-z-ink">
                {saving ? "Guardando..." : "Guardar"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setExpanded(false)}
              disabled={saving}
              className={`${GHOST_BUTTON_CLASS} items-center justify-center rounded-xl px-4 py-3`}
            >
              <Text className="font-inter-medium text-z-sage-light">Cancelar</Text>
            </Pressable>
          </View>
          {item.id && (
            <Pressable
              onPress={handleDelete}
              disabled={saving}
              className={`${DESTRUCTIVE_GHOST_BUTTON_CLASS} items-center justify-center rounded-xl py-3`}
            >
              <Text className="font-inter-medium text-z-expense">
                Eliminar presupuesto
              </Text>
            </Pressable>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}

export const BudgetRow = memo(BudgetRowBase);
