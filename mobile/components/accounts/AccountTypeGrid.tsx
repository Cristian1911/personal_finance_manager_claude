import { View, Text, Pressable } from "react-native";
import { ACCOUNT_TYPES } from "../../lib/constants/accounts";

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
            className={`flex-1 min-w-[44%] rounded-xl p-3.5 border-2 ${
              isSelected
                ? "border-primary bg-primary/10"
                : "border-gray-200 bg-white"
            } ${disabled ? "opacity-60" : "active:bg-gray-50"}`}
            onPress={() => !disabled && onSelect(type.value)}
          >
            <Icon
              size={22}
              color={isSelected ? "#10B981" : "#6B7280"}
            />
            <Text
              className={`font-inter-semibold text-sm mt-2 ${
                isSelected ? "text-primary" : "text-gray-900"
              }`}
            >
              {type.label}
            </Text>
            <Text className="text-gray-400 font-inter text-xs mt-0.5" numberOfLines={2}>
              {type.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
