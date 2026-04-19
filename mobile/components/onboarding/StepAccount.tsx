import { Pressable, Text, TextInput, View } from "react-native";
import { Landmark, PiggyBank, CreditCard, Wallet } from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";
import type { ComponentType } from "react";
import { COLORS } from "../../lib/constants/colors";
import type { OnboardingAccountType } from "./types";

type Props = {
  accountName: string;
  onAccountNameChange: (next: string) => void;
  accountType: OnboardingAccountType;
  onAccountTypeChange: (next: OnboardingAccountType) => void;
  balance: string;
  onBalanceChange: (next: string) => void;
  neutral?: boolean;
};

const ACCOUNT_TYPES: Array<{
  code: OnboardingAccountType;
  label: string;
  icon: ComponentType<LucideProps>;
}> = [
  { code: "SAVINGS", label: "Ahorros", icon: PiggyBank },
  { code: "CHECKING", label: "Corriente", icon: Landmark },
  { code: "CREDIT_CARD", label: "Tarjeta", icon: CreditCard },
  { code: "CASH", label: "Efectivo", icon: Wallet },
];

export function StepAccount({
  accountName,
  onAccountNameChange,
  accountType,
  onAccountTypeChange,
  balance,
  onBalanceChange,
  neutral = false,
}: Props) {
  const surface = neutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2";
  const balanceLabel =
    accountType === "CREDIT_CARD" ? "Deuda actual" : "Saldo actual";
  return (
    <View className="gap-5">
      <View className="gap-1.5">
        <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Nombre de la cuenta
        </Text>
        <TextInput
          value={accountName}
          onChangeText={onAccountNameChange}
          placeholder="Bancolombia Ahorros"
          placeholderTextColor={COLORS.sageDark}
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="Nombre de la cuenta"
          className={`rounded-xl border border-z-sage-10 ${surface} px-4 py-3 font-inter text-base text-z-white`}
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Tipo de cuenta
        </Text>
        <View
          accessibilityRole="radiogroup"
          className="flex-row flex-wrap gap-2"
        >
          {ACCOUNT_TYPES.map(({ code, label, icon: Icon }) => {
            const selected = accountType === code;
            return (
              <Pressable
                key={code}
                onPress={() => onAccountTypeChange(code)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                className={`flex-row items-center gap-2 rounded-xl border px-3.5 py-3 ${
                  selected
                    ? "border-z-brass bg-z-brass-12"
                    : `border-white-6 ${surface}`
                }`}
              >
                <Icon
                  size={16}
                  color={selected ? COLORS.brass : COLORS.sageDark}
                  strokeWidth={2}
                />
                <Text
                  className={`font-inter-semibold text-sm ${
                    selected ? "text-z-white" : "text-z-sage-light"
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          {balanceLabel}
        </Text>
        <TextInput
          value={balance}
          onChangeText={onBalanceChange}
          keyboardType="numeric"
          placeholder="1250000"
          placeholderTextColor={COLORS.sageDark}
          accessibilityLabel={balanceLabel}
          className={`rounded-xl border border-z-sage-10 ${surface} px-4 py-3 font-inter-semibold text-base text-z-white tabular-nums`}
        />
        <Text className="font-inter text-xs text-z-sage-dark">
          Si no lo sabes exacto, deja un estimado — lo ajustas después.
        </Text>
      </View>
    </View>
  );
}
