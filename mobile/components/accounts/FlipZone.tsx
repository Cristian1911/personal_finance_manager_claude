import { useCallback, useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { CardFace } from "./CardFace";
import { GraphFace } from "./GraphFace";
import { RangePills, type RangeValue } from "./RangePills";
import type { AccountRow } from "../../lib/repositories/accounts";
import type { SnapshotPoint } from "../../lib/repositories/accounts-detail";

type Props = {
  account: AccountRow;
  snapshotData: SnapshotPoint[];
  trendPercent?: number;
  goodDirection?: "up" | "down";
};

export function FlipZone({
  account,
  snapshotData,
  trendPercent,
  goodDirection = "up",
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const [range, setRange] = useState<RangeValue>(90);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(flipped ? 1 : 0, { duration: 400 });
  }, [flipped, progress]);

  const handleFlip = useCallback(() => setFlipped((f) => !f), []);

  const frontStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [0, 180]);
    const opacity = interpolate(
      progress.value,
      [0, 0.5, 0.5001],
      [1, 1, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotate}deg` }],
      opacity,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [180, 360]);
    const opacity = interpolate(
      progress.value,
      [0, 0.4999, 0.5, 1],
      [0, 0, 1, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotate}deg` }],
      opacity,
    };
  });

  return (
    <View className="gap-3">
      <Pressable onPress={handleFlip}>
        <View style={{ aspectRatio: 85.6 / 53.98, width: "100%" }}>
          <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
            <CardFace account={account} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
            <GraphFace
              data={snapshotData}
              currencyCode={account.currency_code ?? "COP"}
              range={range}
              trendPercent={trendPercent}
              goodDirection={goodDirection}
              fillCard
            />
          </Animated.View>
        </View>
      </Pressable>
      <View className="items-center gap-2">
        <View className="flex-row gap-1.5">
          <View
            className={`w-1.5 h-1.5 rounded-full ${
              !flipped ? "bg-z-brass" : "bg-white-15"
            }`}
          />
          <View
            className={`w-1.5 h-1.5 rounded-full ${
              flipped ? "bg-z-brass" : "bg-white-15"
            }`}
          />
        </View>
        {flipped && <RangePills value={range} onChange={setRange} />}
      </View>
    </View>
  );
}
