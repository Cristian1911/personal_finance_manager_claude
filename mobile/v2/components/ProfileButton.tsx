import { StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useV2Theme } from "../theme/ThemeProvider";
import { Tap } from "./Tap";

/** Your initials, top-left of every tab: Ajustes from anywhere (Inicio's is part of its greeting). */
export function ProfileButton({ size = 40 }: { size?: number }) {
  const t = useV2Theme();
  const router = useRouter();
  const meta = useAuth().session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const initials = (meta?.full_name ?? meta?.name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (
    <Tap
      onPress={() => router.push("/ajustes" as never)}
      accessibilityRole="button"
      accessibilityLabel="Ajustes"
      hitSlop={4}
      style={() => [styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.colors.sunk, borderColor: t.colors.control }]}
    >
      <Text style={{ fontSize: 13, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{initials || "Z"}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  avatar: { borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
