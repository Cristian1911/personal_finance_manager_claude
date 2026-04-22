import { useEffect, useState, useCallback } from "react";
import { View, type LayoutChangeEvent } from "react-native";
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
   * Fallback height used on first render before the content has been
   * measured. Overestimate is fine — after the first layout pass the
   * measured value takes over. Default 500.
   */
  estimatedHeight?: number;
  /** Animation duration in ms. Default 220. */
  duration?: number;
}

/**
 * Expand/collapse container using react-native-reanimated.
 *
 * Animates `height` (not `maxHeight`) using the content's measured height, so
 * the transition tracks real content and siblings reflow smoothly. On first
 * render the `estimatedHeight` prop provides a height budget until `onLayout`
 * fires. Content is always mounted so sizing doesn't flicker.
 */
export function AnimatedAccordion({
  expanded,
  children,
  estimatedHeight = 500,
  duration = 220,
}: AnimatedAccordionProps) {
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration });
  }, [expanded, duration, progress]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && h !== measuredHeight) setMeasuredHeight(h);
    },
    [measuredHeight]
  );

  const target = measuredHeight ?? estimatedHeight;

  const animatedStyle = useAnimatedStyle(() => ({
    height: progress.value * target,
    opacity: progress.value,
    overflow: "hidden" as const,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View onLayout={handleLayout}>{children}</View>
    </Animated.View>
  );
}
