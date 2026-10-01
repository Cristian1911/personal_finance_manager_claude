import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useMotionMs } from "./Collapse";

/**
 * How far the rest of Inicio fades while one view is open (Z Inicio "panel":
 * 38%, kept from the design: faded cards stay tappable, a tap moves the focus,
 * and their buttons announce that with a hint).
 */
export const DIM_OPACITY = 0.38;

/** Fades its content when something else has the focus. */
export function Dim({ on, children, style }: { on: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const duration = useMotionMs(200);
  const fade = useAnimatedStyle(() => ({ opacity: withTiming(on ? DIM_OPACITY : 1, { duration }) }), [on, duration]);
  return <Animated.View style={[style, fade]}>{children}</Animated.View>;
}
