import { View } from "react-native";

type Props = {
  /** 1-indexed current step */
  step: number;
  /** Total number of steps */
  total: number;
};

export function ImportProgress({ step, total }: Props) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-[3px] flex-1 rounded-full ${
            i < step ? "bg-z-brass" : "bg-z-sage-10"
          }`}
        />
      ))}
    </View>
  );
}
