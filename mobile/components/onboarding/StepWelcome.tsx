import { View } from "react-native";
import { TrendingUp, CreditCard, PiggyBank, Sparkles } from "lucide-react-native";
import { PurposeOption } from "./PurposeOption";
import type { AppPurpose } from "./types";

type Props = {
  value: AppPurpose | null;
  onChange: (next: AppPurpose) => void;
  neutral?: boolean;
};

const OPTIONS = [
  { id: "manage_debt" as const, icon: CreditCard, label: "Salir de deudas" },
  { id: "track_spending" as const, icon: TrendingUp, label: "Entender mis gastos" },
  { id: "save_money" as const, icon: PiggyBank, label: "Ahorrar para una meta" },
  { id: "improve_habits" as const, icon: Sparkles, label: "Mejorar mis hábitos" },
];

export function StepWelcome({ value, onChange, neutral }: Props) {
  return (
    <View className="gap-2">
      {OPTIONS.map((opt) => (
        <PurposeOption
          key={opt.id}
          icon={opt.icon}
          label={opt.label}
          selected={value === opt.id}
          onPress={() => onChange(opt.id)}
          neutral={neutral}
        />
      ))}
    </View>
  );
}
