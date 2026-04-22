import { View, Text, Pressable } from "react-native";
import { ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { COLORS } from "../../lib/constants/colors";

type Props = {
  selected: string;
  onSelect: (type: string) => void;
  disabled?: boolean;
};

export function AccountTypeGrid({ selected, onSelect, disabled = false }: Props) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {ACCOUNT_TYPES.map((type) => {
        const isSelected = selected === type.value;
        const Icon = type.icon;

        return (
          <Pressable
            key={type.value}
            className={`flex-1 min-w-[44%] rounded-xl p-3.5 border ${
              isSelected
                ? "border-z-brass bg-z-brass-8"
                : "border-white-6 bg-z-surface-2-55"
            } ${disabled ? "opacity-60" : "active:bg-black-10"}`}
            onPress={() => !disabled && onSelect(type.value)}
            accessibilityRole="button"
            accessibilityLabel={type.label}
            accessibilityState={{ selected: isSelected, disabled }}
          >
            <Icon
              size={22}
              color={isSelected ? COLORS.brass : COLORS.sageDark}
            />
            <Text
              className={`font-inter-semibold text-sm mt-2 ${
                isSelected ? "text-z-brass" : "text-foreground"
              }`}
            >
              {type.label}
            </Text>
            <Text
              className="text-muted-foreground font-inter text-xs mt-0.5"
              numberOfLines={2}
            >
              {type.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
