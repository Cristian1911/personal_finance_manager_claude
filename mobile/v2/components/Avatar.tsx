import { StyleSheet, Text, View } from "react-native";
import { Store, User } from "lucide-react-native";
import { useV2Theme } from "../theme/ThemeProvider";

/**
 * A destinatario's face (S8-5, S8-9): shape, never color, tells them apart.
 * comercio = squircle + store glyph, one letter; persona = outlined circle +
 * person glyph, two initials; none = plain squircle (no destinatario yet).
 */
export type AvatarKind = "comercio" | "persona" | "none";

export function initialsOf(name: string, kind: AvatarKind): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (kind !== "persona") return words[0][0].toUpperCase();
  return ((words[0][0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, kind, size = 38 }: { name: string; kind: AvatarKind; size?: number }) {
  const t = useV2Theme();
  const large = size >= 56;
  const glyph = large ? 24 : 17;
  const Glyph = kind === "persona" ? User : Store;
  return (
    <View
      accessible={false}
      style={[
        styles.av,
        {
          width: size,
          height: size,
          backgroundColor: t.colors.sunk,
          borderRadius: kind === "persona" ? size / 2 : large ? 18 : 11,
        },
        kind === "persona" && { borderWidth: 1.5, borderColor: t.colors.control },
      ]}
    >
      <Text style={{ fontSize: large ? 20 : 12.5, color: t.colors.muted, fontFamily: t.fonts.uiSemibold }}>{initialsOf(name, kind)}</Text>
      {kind !== "none" && (
        <View
          style={[
            styles.glyph,
            { width: glyph, height: glyph, right: large ? -5 : -4, bottom: large ? -5 : -4, backgroundColor: t.colors.card, borderColor: t.colors.line },
          ]}
        >
          <Glyph size={large ? 13 : 10} color={t.colors.muted} strokeWidth={2.2} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  av: { alignItems: "center", justifyContent: "center" },
  glyph: { position: "absolute", borderRadius: 99, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
