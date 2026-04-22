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
            className={`rounded-full px-4 py-2 border active:opacity-80 ${
              isSelected
                ? "bg-z-brass border-z-brass"
                : "bg-z-surface-2-55 border-white-6"
            }`}
            onPress={() => onSelect(currency.code)}
            accessibilityRole="button"
            accessibilityLabel={currency.code}
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              className={`font-inter-semibold text-sm ${
                isSelected ? "text-z-ink" : "text-muted-foreground"
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
