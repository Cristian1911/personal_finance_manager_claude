import { Pressable, Text, TextInput, View } from "react-native";
import { COLORS } from "../../lib/constants/colors";
import type { CurrencyCode } from "./types";

type Props = {
  firstName: string;
  onFirstNameChange: (next: string) => void;
  currency: CurrencyCode;
  onCurrencyChange: (next: CurrencyCode) => void;
  neutral?: boolean;
};

const CURRENCIES: Array<{ code: CurrencyCode; label: string }> = [
  { code: "COP", label: "COP" },
  { code: "USD", label: "USD" },
  { code: "EUR", label: "EUR" },
  { code: "MXN", label: "MXN" },
  { code: "BRL", label: "BRL" },
];

export function StepProfile({
  firstName,
  onFirstNameChange,
  currency,
  onCurrencyChange,
  neutral = false,
}: Props) {
  const surface = neutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2";
  return (
    <View className="gap-5">
      <View className="gap-1.5">
        <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Nombre
        </Text>
        <TextInput
          value={firstName}
          onChangeText={onFirstNameChange}
          placeholder="María"
          placeholderTextColor={COLORS.sageDark}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="given-name"
          textContentType="givenName"
          accessibilityLabel="Nombre"
          className={`rounded-xl border border-z-sage-10 ${surface} px-4 py-3 font-inter text-base text-z-white`}
        />
        <Text className="font-inter text-xs text-z-sage-dark">
          Así te vamos a saludar en la app.
        </Text>
      </View>

      <View className="gap-1.5">
        <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Moneda preferida
        </Text>
        <View
          accessibilityRole="radiogroup"
          className="flex-row flex-wrap gap-2"
        >
          {CURRENCIES.map((opt) => {
            const selected = currency === opt.code;
            return (
              <Pressable
                key={opt.code}
                onPress={() => onCurrencyChange(opt.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={opt.label}
                className={`rounded-xl border px-4 py-3 ${
                  selected
                    ? "border-z-brass bg-z-brass-12"
                    : `border-white-6 ${surface}`
                }`}
              >
                <Text
                  className={`font-inter-semibold text-sm ${
                    selected ? "text-z-white" : "text-z-sage-light"
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="font-inter text-xs text-z-sage-dark">
          Puedes cambiarla por cuenta más adelante.
        </Text>
      </View>
    </View>
  );
}
