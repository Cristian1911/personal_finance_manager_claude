import { Pressable, Text, View } from "react-native";
import type { ComponentType, ReactNode } from "react";
import { COLORS } from "../../lib/constants/colors";
import type { ChipTone } from "./ExpandableChip";

const SURFACE: Record<ChipTone, string> = {
  brass: "border-z-brass-20 bg-z-brass-8",
  income: "border-z-income-30 bg-z-income-10",
  debt: "border-z-debt-30 bg-z-debt-12",
  alert: "border-z-alert-25 bg-z-alert-12",
  foreground: "border-white-10 bg-z-surface-2-3",
};

const TITLE_COLOR: Record<ChipTone, string> = {
  brass: "text-z-brass",
  income: "text-z-income",
  debt: "text-z-debt",
  alert: "text-z-alert",
  foreground: "text-foreground",
};

const ICON_COLOR: Record<ChipTone, string> = {
  brass: COLORS.brass,
  income: COLORS.income,
  debt: COLORS.debt,
  alert: COLORS.alert,
  foreground: COLORS.sageDark,
};

interface ToneActionRowProps {
  tone: ChipTone;
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}

/**
 * Tone-tinted pressable action row used in chip detail panels. Picks its
 * border/fill/title-color/icon-color from the same palette `ExpandableChip`
 * uses for active states, so surfaces stay in sync.
 */
export function ToneActionRow({
  tone,
  icon: Icon,
  title,
  subtitle,
  onPress,
  trailing,
}: ToneActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      className={`flex-row items-center gap-3 rounded-xl border px-3 py-2.5 ${SURFACE[tone]}`}
    >
      <Icon size={18} color={ICON_COLOR[tone]} />
      <View className="flex-1">
        <Text className={`text-[12px] font-inter-semibold ${TITLE_COLOR[tone]}`}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-[10px] font-inter text-muted-foreground">
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </Pressable>
  );
}
