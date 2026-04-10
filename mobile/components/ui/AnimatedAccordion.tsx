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
  /** Estimated max height of content. Overestimate is fine. Default 500. */
  estimatedHeight?: number;
  /** Animation duration in ms. Default 250. */
  duration?: number;
}

/**
 * Expand/collapse container using react-native-reanimated.
 * Replaces webapp's CSS `grid-template-rows: 0fr → 1fr` transition.
 *
 * Content is always mounted (for consistent hook behavior) but
 * clipped to 0 height when collapsed.
 */
export function AnimatedAccordion({
  expanded,
  children,
  estimatedHeight = 500,
  duration = 250,
}: AnimatedAccordionProps) {
  const height = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    height.value = withTiming(expanded ? 1 : 0, { duration });
  }, [expanded, duration, height]);

  const animatedStyle = useAnimatedStyle(() => ({
    maxHeight: height.value * estimatedHeight,
    opacity: height.value,
    overflow: "hidden" as const,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View>{children}</View>
    </Animated.View>
  );
}
