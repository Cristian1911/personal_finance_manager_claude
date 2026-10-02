import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useV2Theme } from "../theme/ThemeProvider";

/**
 * The v2 button system (S8-8, botones.html). Red only for actions that can't
 * be undone or that end something; `destructiveConfirm` (red fill) only
 * inside a ConfirmSheet. Anything with Deshacer stays `text`.
 */
export type ButtonVariant = "primary" | "secondary" | "text" | "destructive" | "destructiveConfirm";
export type ButtonSize = "L" | "M" | "S";

const SIZE = {
  L: { height: 50, radius: 12, font: 15, pad: 18 },
  M: { height: 44, radius: 11, font: 14, pad: 18 },
  S: { height: 32, radius: 9, font: 13, pad: 12 },
} as const;

export function Button({ label, onPress, variant = "primary", size = "L", icon, disabled, loading, accessibilityLabel, accessibilityHint, style }: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  disabled?: boolean;
  /** Spinner in place of the label, same size; taps ignored. */
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useV2Theme();
  const c = t.colors;
  const z = SIZE[size];
  const off = disabled && !loading;
  const look: { bg?: string; border?: string; ink: string } = off
    ? { bg: variant === "text" ? undefined : c.sunk, ink: c.muted }
    : variant === "primary" ? { bg: c.button, ink: c.onButton }
    : variant === "secondary" ? { border: c.control, ink: c.ink }
    : variant === "destructive" ? { border: c.bad.solid, ink: c.bad.text }
    : variant === "destructiveConfirm" ? { bg: c.bad.solid, ink: c.bad.onSolid }
    : { ink: c.muted };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      hitSlop={size === "S" ? 6 : undefined}
      style={({ pressed }) => [
        styles.base,
        { height: z.height, borderRadius: z.radius, paddingHorizontal: variant === "text" ? 6 : z.pad },
        look.bg ? { backgroundColor: look.bg } : null,
        look.border ? { borderWidth: 1.5, borderColor: look.border } : null,
        variant === "text" && size !== "S" ? { minHeight: 44 } : null,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.ink} />
      ) : (
        <View style={styles.inner}>
          {icon}
          <Text
            numberOfLines={1}
            style={{
              color: look.ink,
              fontSize: z.font,
              fontFamily: t.fonts.uiSemibold,
              textDecorationLine: variant === "text" ? "underline" : "none",
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Square (or round) outlined icon control: back, search, ⋯. 36 visible, 44 touch. */
export function IconButton({ icon, onPress, label, round, disabled, size = 36 }: {
  icon: ReactNode;
  onPress: () => void;
  label: string;
  round?: boolean;
  disabled?: boolean;
  size?: number;
}) {
  const t = useV2Theme();
  const slop = Math.max(0, (44 - size) / 2);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={slop}
      style={({ pressed }) => [
        styles.icon,
        { width: size, height: size, borderRadius: round ? size / 2 : 10, borderColor: t.colors.control },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  inner: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
