import { ScrollView, Pressable, Text } from "react-native";
import { CURRENCIES } from "../../lib/constants/accounts";

type Props = {
  selected: string;
  onSelect: (code: string) => void;
};

export function CurrencyPicker({ selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {CURRENCIES.map((currency) => {
        const isSelected = selected === currency.code;
        return (
          <Pressable
            key={currency.code}
            className={`rounded-full px-4 py-2 border-2 active:opacity-80 ${
              isSelected
                ? "bg-primary border-primary"
                : "bg-white border-gray-200"
            }`}
            onPress={() => onSelect(currency.code)}
          >
            <Text
              className={`font-inter-semibold text-sm ${
                isSelected ? "text-white" : "text-gray-700"
              }`}
            >
              {currency.code}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
