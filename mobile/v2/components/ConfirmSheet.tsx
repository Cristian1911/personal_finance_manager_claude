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
  return (
    <Sheet open={open} onClose={onCancel} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{title}</Text>
      <Text style={[styles.body, { color: t.colors.muted, fontFamily: t.fonts.ui }]}>{consequence}</Text>
      <View style={styles.actions}>
        <Button label={confirmLabel} variant={destructive ? "destructiveConfirm" : "primary"} onPress={onConfirm} />
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
