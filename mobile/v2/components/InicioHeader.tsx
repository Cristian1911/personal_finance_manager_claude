import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Grip, Mic } from "lucide-react-native";
import { useV2Theme } from "../theme/ThemeProvider";

/**
 * Inicio's top row (Claude Design "Z Inicio"): greeting and date, Organizar
 * and the voice button; while organizing, the title and "Listo".
 */
export const InicioHeader = memo(function InicioHeader({
  name,
  date,
  editing,
  onOrganize,
  onDone,
  onVoice,
  onProfile,
  initials,
}: {
  name: string | null;
  date: string;
  editing: boolean;
  onOrganize?: () => void;
  onDone: () => void;
  onVoice: () => void;
  /** Ajustes (S8-1: from the avatar on Inicio). */
  onProfile?: () => void;
  initials?: string;
}) {
  const t = useV2Theme();
  const title = editing ? "Organizar Inicio" : name ? `Hola, ${name}` : "Hola";
  const sub = editing ? "Arrastra para mover · toca el tamaño" : date;
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
        <Text style={[styles.sub, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]} numberOfLines={1}>{sub}</Text>
      </View>
      {editing ? (
        <Pressable onPress={onDone} accessibilityRole="button" hitSlop={6} style={[styles.done, { backgroundColor: t.colors.button }]}>
          <Text style={{ color: t.colors.onButton, fontFamily: t.fonts.uiSemibold, fontSize: 14 }}>Listo</Text>
        </Pressable>
      ) : (
        <>
          {onOrganize && (
            <Pressable onPress={onOrganize} accessibilityRole="button" hitSlop={6} style={[styles.organize, { borderColor: t.colors.control }]}>
              <Grip size={14} color={t.colors.ink} />
              <Text style={{ color: t.colors.ink, fontFamily: t.fonts.uiSemibold, fontSize: 13 }}>Organizar</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onVoice}
            accessibilityRole="button"
            accessibilityLabel="Anotar con la voz"
            hitSlop={6}
            style={[styles.mic, { backgroundColor: t.colors.button }]}
          >
            <Mic size={18} color={t.colors.onButton} />
          </Pressable>
          {/* Ajustes is a place, not "back": top right on every tab (the left is for going back). */}
          {onProfile && (
            <Pressable onPress={onProfile} accessibilityRole="button" accessibilityLabel="Ajustes" hitSlop={4}
              style={[styles.avatar, { backgroundColor: t.colors.sunk, borderColor: t.colors.control }]}>
              <Text style={{ fontSize: 13, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{initials || "Z"}</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 2 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 17 },
  sub: { fontSize: 13 },
  organize: { height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  mic: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  done: { height: 36, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
