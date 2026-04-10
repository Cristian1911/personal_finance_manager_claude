import { Pressable, View, Text } from "react-native";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

interface HubEntryProps {
  icon: LucideIcon;
  title: string;
  hint: ReactNode;
  onPress: () => void;
  className?: string;
}

export function HubEntry({
  icon: Icon,
  title,
  hint,
  onPress,
  className,
}: HubEntryProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`${PANEL_INSET_CLASS} flex-row items-center gap-3 rounded-2xl px-3.5 py-3 ${className ?? ""}`}
    >
      <View className={`h-8 w-8 items-center justify-center rounded-xl bg-z-brass-10`}>
        <Icon size={16} color={COLORS.brass} />
      </View>

      <View className="min-w-0 flex-1">
        <Text className="text-sm font-inter-medium text-foreground">
          {title}
        </Text>
        <Text
          className="mt-0.5 text-[11px] font-inter text-muted-foreground"
          numberOfLines={1}
        >
          {hint}
        </Text>
      </View>

      <Text className="text-[16px] text-muted-fg-50">{"›"}</Text>
    </Pressable>
  );
}
