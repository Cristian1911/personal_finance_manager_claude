import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

/** How far the rest of Inicio fades while one view is open (Z Inicio "panel": 38%). */
export const DIM_OPACITY = 0.38;

/** Fades its content when something else has the focus. */
export function Dim({ on, children, style }: { on: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const fade = useAnimatedStyle(() => ({ opacity: withTiming(on ? DIM_OPACITY : 1, { duration: 200 }) }), [on]);
  return <Animated.View style={[style, fade]}>{children}</Animated.View>;
}
