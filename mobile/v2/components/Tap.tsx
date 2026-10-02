import { useState } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

/**
 * Pressable with a pressed look. NativeWind's Pressable wrapper (v1) drops
 * `style` functions on native — the control renders unstyled — so the
 * pressed state is tracked here and the style passed as a plain value.
 */
export function Tap({ style, onPressIn, onPressOut, ...props }: Omit<PressableProps, "style"> & {
  style: (pressed: boolean) => StyleProp<ViewStyle>;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...props}
      onPressIn={(e) => { setPressed(true); onPressIn?.(e); }}
      onPressOut={(e) => { setPressed(false); onPressOut?.(e); }}
      style={style(pressed)}
    />
  );
}
