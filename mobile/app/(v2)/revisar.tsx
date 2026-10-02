import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { inicioSince, posiblesDuplicados, readInicioData, type PosibleDuplicado } from "@zeta/shared";
import { toColombiaDateString } from "../../lib/utils/date";
import { useV2Changes } from "../../lib/v2/changes";
import { getV2Database } from "../../lib/v2/engine/database";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { syncProblems, type SyncProblem } from "../../lib/v2/sync/sync";
import { useV2UserId } from "../../lib/v2/user";
import { Button } from "../../v2/components/Button";
import { ProfileButton } from "../../v2/components/ProfileButton";
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
  setTransactionCategory: "La categoría de un movimiento",
  createDestinatario: "Un comercio o persona nuevo",
  setTransactionDestinatario: "Quién es un movimiento",
  setDestinatarioCategory: "La categoría de un comercio o persona",
  resolveBankDuplicate: "Una respuesta en Revisar",
};

/**
 * Revisar (S8-1): what Zeta won't decide alone.
 * - A bank movement that may be one you anotaste (S1-2): "¿Es el mismo?".
 * - Changes that didn't reach the account, so nothing disappears without a word.
 */
export default function RevisarScreen() {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const userId = useV2UserId();
  const [problems, setProblems] = useState<SyncProblem[]>([]);
  const [dups, setDups] = useState<PosibleDuplicado[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setProblems(await syncProblems(userId).catch(() => []));
    try {
      const { driver } = await getV2Database();
      const data = await readInicioData(driver, userId, inicioSince(toColombiaDateString()));
      setDups(posiblesDuplicados(data.transactions, data.accounts));
    } catch (e) {
      console.warn("[v2 revisar] load failed", e);
    }
  }, [userId]);
  useV2Changes(() => void reload());
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const dismiss = useCallback(async () => {
    const { driver } = await getV2Database();
    // Only the queue's memory of them; the account never had them.
    for (const p of problems) await driver.query("DELETE FROM outbox WHERE command_id = ?", [p.commandId]);
    await reload();
  }, [problems, reload]);

  const answer = useCallback(async (id: string, same: boolean) => {
    setBusy(id);
    try {
      const { result } = await runLocalCommand({ type: "resolveBankDuplicate", userId, payload: { transactionId: id, same } });
      if (result.status === "rejected") Alert.alert("No se pudo guardar", result.error ?? "Intenta de nuevo.");
    } catch (e) {
      console.warn("[v2 revisar] answer failed", e);
      Alert.alert("No se pudo guardar", "Intenta de nuevo.");
    }
    await reload();
    setBusy(null);
  }, [userId, reload]);

  if (problems.length === 0 && dups.length === 0) {
    return <EmptyState title="Revisar" profile message="Nada por revisar. Cuando Zeta no esté segura de algo, te lo va a preguntar aquí." />;
  }
  const line = (label: string, s: { title: string; amount: string; date: string; account?: string }) => (
    <View style={styles.side}>
      <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.mono }}>{label}</Text>
      <View style={styles.sideRow}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{s.title}</Text>
        <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.numberSemibold }}>{s.amount}</Text>
      </View>
      <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>{[s.date, s.account].filter(Boolean).join(" · ")}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.titleRow}>
          <ProfileButton />
          <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Revisar</Text>
        </View>
        {dups.map((d) => (
          <View key={d.id} style={[styles.card, styles.dup, { backgroundColor: t.colors.card }, t.shadow]}>
            <Text style={{ fontSize: 17, color: t.colors.ink, fontFamily: t.fonts.uiSemibold, textAlign: "center" }}>
              {d.tuyo ? "¿Es el mismo movimiento?" : "Un movimiento de tu banco"}
            </Text>
            {line("TU BANCO", d.banco)}
            {d.tuyo && line("ANOTASTE", d.tuyo)}
            <Text style={{ fontSize: 13, lineHeight: 18, color: t.colors.muted, fontFamily: t.fonts.uiMedium, textAlign: "center" }}>
              {d.tuyo ? "Mientras respondes, solo cuenta lo que anotaste." : "Lo que anotaste ya no está. ¿Lo cuentas?"}
            </Text>
            {d.tuyo && <Button label="Sí, es el mismo" disabled={busy !== null} loading={busy === d.id} onPress={() => void answer(d.id, true)} />}
            <Button label={d.tuyo ? "No, son dos" : "Contarlo"} variant={d.tuyo ? "secondary" : "primary"} disabled={busy !== null}
              onPress={() => void answer(d.id, false)} />
          </View>
        ))}
        {problems.length > 0 && (
          <>
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  title: { fontSize: 26, letterSpacing: -0.5 },
  card: { borderRadius: 18, paddingHorizontal: 14 },
  dup: { paddingVertical: 16, gap: 12 },
  side: { gap: 2 },
  sideRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: { gap: 4, paddingVertical: 12 },
});
