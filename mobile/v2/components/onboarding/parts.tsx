import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { amountTyping } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";

/** Small pieces every onboarding step shares, so the steps read alike. */

export function StepLabel({ children }: { children: string }) {
  const t = useV2Theme();
  return <Text style={{ fontSize: 12, letterSpacing: 0.5, color: t.colors.muted, fontFamily: t.fonts.mono }}>{children}</Text>;
}

export function Title({ children }: { children: string }) {
  const t = useV2Theme();
  return <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{children}</Text>;
}

export function Hint({ children }: { children: ReactNode }) {
  const t = useV2Theme();
  return <Text style={[styles.hint, { color: t.colors.muted, fontFamily: t.fonts.ui }]}>{children}</Text>;
}

export function ErrorLine({ text }: { text: string | null }) {
  const t = useV2Theme();
  if (!text) return null;
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: t.colors.bad.text, fontFamily: t.fonts.uiMedium, fontSize: 14 }}>
      {text}
    </Text>
  );
}

/** A labelled input. `money` formats as pesos while typing; `day` takes 1–2 digits. */
export function Field({ label, value, onChange, placeholder, money, day, flex, hideLabel }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  money?: boolean;
  day?: boolean;
  flex?: number;
  /** The label is still read aloud, just not drawn (rows of short inputs). */
  hideLabel?: boolean;
}) {
  const t = useV2Theme();
  return (
    <View style={{ flex: flex ?? 1, gap: 6, minWidth: 0 }}>
      {!hideLabel && <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={(v) => onChange(money ? amountTyping(v) : day ? v.replace(/\D/g, "") : v)}
        placeholder={placeholder}
        placeholderTextColor={t.colors.control}
        keyboardType={money ? "decimal-pad" : day ? "number-pad" : "default"}
        maxLength={day ? 2 : 60}
        accessibilityLabel={label}
        style={[styles.input, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
      />
    </View>
  );
}

/** A white card on the sand (the onboarding's own surfaces). */
export function Card({ children, style, outlined }: { children: ReactNode; style?: StyleProp<ViewStyle>; outlined?: "strong" | "soft" | "ok" }) {
  const t = useV2Theme();
  const border = outlined === "strong" ? t.colors.ink : outlined === "ok" ? t.colors.ok.solid : outlined === "soft" ? t.colors.line : undefined;
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card }, border ? { borderWidth: outlined === "strong" ? 2 : 1.5, borderColor: border } : t.shadow, style]}>
      {children}
    </View>
  );
}

/** "+20%" and friends: a small state-tinted chip. */
export function GainChip({ text, muted }: { text: string; muted?: boolean }) {
  const t = useV2Theme();
  return (
    <View style={[styles.gain, { backgroundColor: muted ? t.colors.sunk : t.colors.ok.tint }]}>
      <Text style={{ fontSize: 12, color: muted ? t.colors.muted : t.colors.ok.text, fontFamily: t.fonts.uiSemibold }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 27, letterSpacing: -0.4 },
  hint: { fontSize: 14, lineHeight: 20 },
  input: { height: 46, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 10, fontSize: 15 },
  card: { borderRadius: 18, padding: 14, gap: 10 },
  gain: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
});
