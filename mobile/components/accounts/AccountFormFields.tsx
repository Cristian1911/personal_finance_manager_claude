import { ScrollView, Pressable, Text, TextInput, View } from "react-native";
import { formatSignedAmountInput } from "../../lib/amount";
import type { ReactNode } from "react";
import { COLORS } from "../../lib/constants/colors";
import { FORM_INPUT_CLASS } from "../../lib/constants/styles";

export function FormField({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-[13px] font-inter-semibold text-foreground">
        {label}
        {required && <Text className="text-z-debt"> *</Text>}
      </Text>
      {children}
    </View>
  );
}

export function NumericInput({
  value,
  onChangeText,
  placeholder,
  money = false,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /**
   * Group thousands as the user types. Opt-in, NOT the default: this same
   * input also takes interest rates ("Tasa de interés mensual (%)"), where
   * grouping would turn 2.5 into 25.
   */
  money?: boolean;
}) {
  return (
    <TextInput
      className={FORM_INPUT_CLASS}
      value={value}
      onChangeText={
        money ? (next) => onChangeText(formatSignedAmountInput(next)) : onChangeText
      }
      placeholder={placeholder ?? "0"}
      placeholderTextColor={COLORS.sageDark}
      keyboardType="decimal-pad"
    />
  );
}

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => String(i + 1));

export function DayPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Pill row: never grow vertically (see PlanificadorRoot).
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ gap: 8 }}
    >
      {DAYS_OF_MONTH.map((day) => {
        const isSelected = value === day;
        return (
          <Pressable
            key={day}
            className={`w-10 h-10 rounded-full items-center justify-center border ${
              isSelected
                ? "bg-z-brass border-z-brass"
                : "bg-black-10 border-white-6"
            }`}
            onPress={() => onSelect(isSelected ? "" : day)}
            accessibilityRole="button"
            accessibilityLabel={`Día ${day}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              className={`font-inter-semibold text-sm ${
                isSelected ? "text-z-ink" : "text-foreground"
              }`}
            >
              {day}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
