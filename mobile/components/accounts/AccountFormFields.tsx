import { ScrollView, Pressable, Text, TextInput, View } from "react-native";
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
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      className={FORM_INPUT_CLASS}
      value={value}
      onChangeText={onChangeText}
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
