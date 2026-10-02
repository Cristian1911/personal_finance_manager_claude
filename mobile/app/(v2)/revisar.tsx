import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useV2Changes } from "../../lib/v2/changes";
import { getV2Database } from "../../lib/v2/engine/database";
import { syncProblems, type SyncProblem } from "../../lib/v2/sync/sync";
import { useV2UserId } from "../../lib/v2/user";
import { Button } from "../../v2/components/Button";
import { EmptyState } from "../../v2/components/EmptyState";
import { useV2Theme } from "../../v2/theme/ThemeProvider";

const WHAT: Record<string, string> = {
  captureManualTransaction: "Un movimiento que anotaste",
  captureTransfer: "Un movimiento entre cuentas",
  editTransaction: "Un cambio a un movimiento",
  deleteTransaction: "Un movimiento que borraste",
  setTransactionNote: "Una nota",
  setTransactionExcluded: "Un movimiento que ignoraste",
  createAccount: "Una cuenta nueva",
  editAccount: "Un cambio a una cuenta",
  archiveAccount: "Una cuenta archivada",
  setAccountCountsInDisponible: "Si una cuenta cuenta para tu Disponible",
  setCycleSettings: "Cuándo te pagan",
  createPagoFijo: "Un pago fijo nuevo",
  editPagoFijo: "Un cambio a un pago fijo",
  archivePagoFijo: "Un pago fijo que dejaste",
  setOccurrenceStatus: "Un pago marcado",
};

/**
 * Revisar (S8-1). For launch: changes that didn't reach the account (set
 * aside after repeated failures, or refused by it), so nothing disappears
 * without a word. Weak duplicates and unknown destinatarios come later (S9-6).
 */
export default function RevisarScreen() {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const userId = useV2UserId();
  const [problems, setProblems] = useState<SyncProblem[]>([]);

  const reload = useCallback(async () => {
    setProblems(await syncProblems(userId).catch(() => []));
  }, [userId]);
  useV2Changes(() => void reload());
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const dismiss = useCallback(async () => {
    const { driver } = await getV2Database();
    // Only the queue's memory of them; the account never had them.
    for (const p of problems) await driver.query("DELETE FROM outbox WHERE command_id = ?", [p.commandId]);
    await reload();
  }, [problems, reload]);

  if (problems.length === 0) {
    return <EmptyState title="Revisar" message="Nada por revisar. Cuando Zeta no esté segura de algo, te lo va a preguntar aquí." />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 8 }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Revisar</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: t.colors.muted, fontFamily: t.fonts.uiMedium, paddingHorizontal: 4 }}>
          Estos cambios no se guardaron en tu cuenta. Ya no están en el teléfono; si los necesitas, anótalos de nuevo.
        </Text>
        <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
          {problems.map((p, i) => (
            <View key={p.commandId} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.line }]}>
              <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{WHAT[p.type] ?? "Un cambio"}</Text>
              <Text style={{ fontSize: 13, color: t.colors.warn.text, fontFamily: t.fonts.uiMedium }}>{p.error}</Text>
            </View>
          ))}
        </View>
        <Button label="Entendido" variant="secondary" onPress={() => void dismiss()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  title: { fontSize: 26, letterSpacing: -0.5, paddingHorizontal: 4, paddingTop: 4 },
  card: { borderRadius: 18, paddingHorizontal: 14 },
  row: { gap: 4, paddingVertical: 12 },
});
