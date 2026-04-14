import { View, Text, Pressable } from "react-native";
import { PANEL_SURFACE_SUBTLE_CLASS } from "../../lib/constants/styles";

interface StrategyCardProps {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

export function StrategyCard({
  title,
  description,
  selected,
  onPress,
}: StrategyCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`${PANEL_SURFACE_SUBTLE_CLASS} p-4 ${selected ? "border-z-brass" : ""}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-[15px] font-inter-semibold text-foreground">
            {title}
          </Text>
          <Text className="text-[12px] font-inter text-muted-foreground mt-1">
            {description}
          </Text>
        </View>
        <View
          className={`h-5 w-5 rounded-full border-2 ${
            selected ? "border-z-brass bg-z-brass" : "border-white-8"
          }`}
        />
      </View>
    </Pressable>
  );
}
