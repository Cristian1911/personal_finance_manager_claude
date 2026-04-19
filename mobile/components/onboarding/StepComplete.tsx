import { Pressable, Text, View } from "react-native";
import { CheckCircle2, FileText, Compass } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
} from "../../lib/constants/styles";
import type { AppPurpose } from "./types";

type Props = {
  firstName: string;
  purpose: AppPurpose;
  onPrimary: () => void;
  onExplore: () => void;
  loading?: boolean;
};

function primaryCtaFor(purpose: AppPurpose): { label: string; detail: string } {
  switch (purpose) {
    case "manage_debt":
      return {
        label: "Importa tu primer extracto",
        detail: "Carguemos tus deudas con datos reales.",
      };
    case "track_spending":
      return {
        label: "Importa tu primer extracto",
        detail: "Carguemos tus movimientos reales.",
      };
    case "save_money":
      return {
        label: "Planifica tu próximo mes",
        detail: "Asignemos sobres para tu meta.",
      };
    case "improve_habits":
      return {
        label: "Explora tu dashboard",
        detail: "Mira cómo Zeta resume tu mes.",
      };
  }
}

export function StepComplete({
  firstName,
  purpose,
  onPrimary,
  onExplore,
  loading,
}: Props) {
  const cta = primaryCtaFor(purpose);
  const PrimaryIcon = purpose === "improve_habits" ? Compass : FileText;
  // The primary CTA already goes to /(tabs) for improve_habits, so "Explorar primero"
  // would duplicate it. Hide the ghost on that purpose.
  const showExplore = purpose !== "improve_habits";
  const trimmedName = firstName.trim();

  return (
    <View className="items-center gap-6">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-z-income-12">
        <CheckCircle2 size={44} color={COLORS.income} strokeWidth={2} />
      </View>

      <View className="items-center gap-1.5">
        <Text className="font-inter-bold text-[28px] text-z-white">
          {trimmedName ? `¡Listo, ${trimmedName}!` : "¡Listo!"}
        </Text>
        <Text className="text-center font-inter text-sm text-z-sage-light">
          Tu Zeta está configurado. ¿Qué quieres hacer primero?
        </Text>
      </View>

      <View className="w-full gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          accessibilityState={{ disabled: !!loading }}
          onPress={onPrimary}
          disabled={loading}
          className={`flex-row items-center justify-center gap-2 rounded-xl ${BRASS_BUTTON_CLASS} px-5 py-4 active:opacity-90`}
        >
          <PrimaryIcon size={18} color={COLORS.ink} strokeWidth={2.2} />
          <Text className="font-inter-bold text-base text-z-ink">
            {cta.label}
          </Text>
        </Pressable>
        <Text className="text-center font-inter text-xs text-z-sage-dark">
          {cta.detail}
        </Text>

        {showExplore && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explorar Zeta primero"
            accessibilityState={{ disabled: !!loading }}
            onPress={onExplore}
            disabled={loading}
            className={`items-center justify-center rounded-xl ${GHOST_BUTTON_CLASS} px-5 py-3.5 mt-2`}
          >
            <Text className="font-inter-medium text-sm text-z-sage-light">
              Explorar primero
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
