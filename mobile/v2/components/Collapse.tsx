import { useEffect, useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/** One timing for every open/close on Inicio, so the page scroll can move in step. */
export const COLLAPSE_MS = 260;
export const COLLAPSE_EASING = Easing.out(Easing.cubic);

/**
 * Opens and closes its content by animating the height (and a fade), and
 * keeps the content mounted until the close finishes. The page shrinks a
 * little each frame instead of losing the whole height at once, so a
 * scrolled-down screen eases up rather than jumping. `onHeight` reports the
 * content's full height as soon as it's measured (for scrolling it into view).
 */
export function Collapse({
  open,
  children,
  onHeight,
  style,
}: {
  open: boolean;
  children: ReactNode;
  onHeight?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);
  const contentH = useSharedValue(0);

  useEffect(() => {
    if (open) setMounted(true);
    progress.value = withTiming(open ? 1 : 0, { duration: COLLAPSE_MS, easing: COLLAPSE_EASING }, (done) => {
      if (done && !open) scheduleOnRN(setMounted, false);
    });
  }, [open, progress]);

  const animated = useAnimatedStyle(() => ({
    height: contentH.value * progress.value,
    opacity: progress.value,
  }));

  if (!mounted) return null;
  return (
    <Animated.View style={[{ overflow: "hidden" }, style, animated]}>
      {/* Absolute so it keeps its natural height while the box around it grows. */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          contentH.value = h;
          onHeight?.(h);
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}
