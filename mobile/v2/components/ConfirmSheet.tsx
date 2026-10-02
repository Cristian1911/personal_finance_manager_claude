import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useV2Theme } from "../theme/ThemeProvider";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/**
 * Every switch and every destructive action asks here first (S8-5, S8-8):
 * a title, what will happen in words, then confirm or "Cancelar".
 */
export function ConfirmSheet({ open, title, consequence, confirmLabel, destructive, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  consequence: string;
  confirmLabel: string;
  /** Red fill: can't be undone or ends something (Cerrar sesión, Borrar). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  // The words are frozen from the moment it opens: while it slides away the
  // caller has usually cleared or changed what it was asking about.
  const shown = useRef({ title, consequence, confirmLabel, destructive });
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) shown.current = { title, consequence, confirmLabel, destructive };
  wasOpen.current = open;
  const w = shown.current;
  return (
    <Sheet open={open} onClose={onCancel} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{w.title}</Text>
      <Text style={[styles.body, { color: t.colors.muted, fontFamily: t.fonts.ui }]}>{w.consequence}</Text>
      <View style={styles.actions}>
        <Button label={w.confirmLabel} variant={w.destructive ? "destructiveConfirm" : "primary"} onPress={onConfirm} />
        <Button label="Cancelar" variant="text" onPress={onCancel} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingTop: 8, paddingHorizontal: 20, gap: 10 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 6 },
  title: { fontSize: 19, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  actions: { gap: 4, marginTop: 10 },
});
