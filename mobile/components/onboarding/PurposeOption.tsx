import { Pressable, Text, View } from "react-native";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";

type Props = {
  icon: ComponentType<LucideProps>;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Swap surface to neutral-theme variant when the user has opted in. */
  neutral?: boolean;
};

/**
 * Row tile used on onboarding step 1 to pick the user's main purpose.
 * Radio-button semantics (re-clicking a selected option doesn't deselect).
 */
export function PurposeOption({
  icon: Icon,
  label,
  selected,
  onPress,
  neutral = false,
}: Props) {
  const unselectedSurface = neutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 ${
        selected
          ? "border-z-brass bg-z-brass-12"
          : `border-white-6 ${unselectedSurface}`
      }`}
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${
          selected ? "bg-z-brass-20" : "bg-z-surface-2-6"
        }`}
      >
        <Icon
          size={20}
          color={selected ? COLORS.brass : COLORS.sageLight}
          strokeWidth={2}
        />
      </View>
      <Text
        className={`flex-1 font-inter-semibold text-base ${
          selected ? "text-z-white" : "text-z-sage-light"
        }`}
      >
        {label}
      </Text>
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border ${
          selected ? "border-z-brass bg-z-brass" : "border-white-15"
        }`}
      >
        {selected && <View className="h-2 w-2 rounded-full bg-z-ink" />}
      </View>
    </Pressable>
  );
}
