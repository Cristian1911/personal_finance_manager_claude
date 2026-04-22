import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import type { ReactNode } from "react";

interface AnimatedAccordionProps {
  expanded: boolean;
  children: ReactNode;
  /**
   * Maximum visible height when expanded. Overestimate is fine — the
   * container caps at this value but content taller than the estimate
   * gets clipped, so tune per use-site. Default 500.
   */
  estimatedHeight?: number;
  /** Animation duration in ms. Default 220. */
  duration?: number;
}

/**
 * Expand/collapse container using react-native-reanimated. Animates
 * `maxHeight` 0 → `estimatedHeight` so siblings reflow normally and there is
 * no layout jank from native `height: 0` inside flex columns. Content is
 * always mounted so measurements don't flicker when toggled.
 */
export function AnimatedAccordion({
  expanded,
  children,
  estimatedHeight = 500,
  duration = 220,
}: AnimatedAccordionProps) {
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration });
  }, [expanded, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    maxHeight: progress.value * estimatedHeight,
    opacity: progress.value,
    overflow: "hidden" as const,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View>{children}</View>
    </Animated.View>
  );
}
