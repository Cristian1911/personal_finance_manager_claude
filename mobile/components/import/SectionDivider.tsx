import { View, Text } from "react-native";

type Props = { label: string };

export function SectionDivider({ label }: Props) {
  return (
    <View className="my-3 flex-row items-center gap-3">
      <View className="h-px flex-1 bg-z-sage-10" />
      <Text className="text-[10px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
        {label}
      </Text>
      <View className="h-px flex-1 bg-z-sage-10" />
    </View>
  );
}
