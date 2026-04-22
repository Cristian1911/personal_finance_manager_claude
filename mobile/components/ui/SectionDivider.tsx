import { View, Text } from "react-native";

interface SectionDividerProps {
  label: string;
}

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <View className="flex-row items-center gap-2 px-0.5 py-1">
      <View className="h-px flex-1 bg-white-6" />
      <Text className="text-[9px] font-inter-semibold uppercase tracking-[4px] text-z-sage-dark">
        {label}
      </Text>
      <View className="h-px flex-1 bg-white-6" />
    </View>
  );
}
