import { View, Text } from "react-native";

type Props = {
  /** Percent change. 0 (or undefined) hides the chip. */
  percent?: number;
  /** Which direction means improvement. "up" = balance growth (assets); "down" = debt reduction. */
  goodDirection?: "up" | "down";
};

/**
 * Small tinted pill showing trend direction (▲/▼) and absolute percent.
 * The arrow always reflects the actual numeric direction; color reflects
 * whether that direction is "good" for this account type.
 */
export function TrendChip({ percent, goodDirection = "up" }: Props) {
  if (percent === undefined || percent === 0) return null;
  const arrowUp = percent > 0;
  const isGood = goodDirection === "up" ? arrowUp : !arrowUp;
  return (
    <View
      className={`rounded-full px-1.5 py-0.5 ${
        isGood ? "bg-z-income-12" : "bg-z-debt-12"
      }`}
    >
      <Text
        className={`font-inter-semibold text-xs ${
          isGood ? "text-z-income" : "text-z-debt"
        }`}
      >
        {arrowUp ? "▲" : "▼"} {Math.abs(percent).toFixed(1)}%
      </Text>
    </View>
  );
}
