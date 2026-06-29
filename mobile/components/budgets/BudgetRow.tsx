import { memo, useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
  index: number;
  onInputFocus?: (index: number) => void;
}

function progressBarClass(progress: number): string {
  if (progress >= 100) return "bg-z-debt";
  if (progress >= 80) return "bg-z-alert";
  return "bg-z-income";
}

function BudgetRowBase({
  item,
  currency,
  saving,
  onSave,
  onDelete,
  index,
  onInputFocus,
}: BudgetRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [amountInput, setAmountInput] = useState(String(Math.round(item.amount)));

  // Re-sync input when row collapses so the next open shows the latest amount
  // (e.g., after save + reload, or when main data refreshes).
  useEffect(() => {
    if (!expanded) {
      setAmountInput(String(Math.round(item.amount)));
    }
  }, [expanded, item.amount]);

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const chevronRotation = useSharedValue(0);
  useEffect(() => {
    chevronRotation.value = withTiming(expanded ? 180 : 0, { duration: 220 });
  }, [expanded, chevronRotation]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const handleSave = useCallback(async () => {
    const parsed = parseLocalizedAmount(amountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert("Monto inválido", "Ingresa un valor mayor a cero.");
      return;
    }
    try {
      await onSave(item, parsed);
      setExpanded(false);
    } catch (error) {
      Alert.alert(
        "No se pudo guardar",
        error instanceof Error ? error.message : "Intenta de nuevo."
      );
    }
  }, [amountInput, item, onSave]);

  const handleDelete = useCallback(async () => {
    try {
      await onDelete(item);
      setExpanded(false);
    } catch (error) {
      Alert.alert(
        "No se pudo eliminar",
        error instanceof Error ? error.message : "Intenta de nuevo."
      );
    }
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
            <Animated.View style={chevronStyle}>
              <ChevronDown size={14} color={COLORS.sageDark} />
            </Animated.View>
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
            onFocus={() => onInputFocus?.(index)}
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
