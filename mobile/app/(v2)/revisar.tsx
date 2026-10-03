import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { formatPesos, pagosFijosSugeridos, posiblesDuplicados, readInicioData, type PagoFijoSugerido, type PosibleDuplicado } from "@zeta/shared";
import { toColombiaDateString } from "../../lib/utils/date";
import { useV2Changes } from "../../lib/v2/changes";
import { getV2Database } from "../../lib/v2/engine/database";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { syncProblems, type SyncProblem } from "../../lib/v2/sync/sync";
import { useV2UserId } from "../../lib/v2/user";
import { notifyV2Change } from "../../lib/v2/changes";
import { ONBOARDING_KEYS, parseLocal, readLocal, rememberJson } from "../../lib/v2/local-state";
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

/** Far enough back to see a monthly charge twice (a statement brings ~3 months). */
const SUGGEST_DAYS = 120;
const daysBefore = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/**
 * Revisar (S8-1): what Zeta won't decide alone.
 * - A bank movement that may be one you anotaste (S1-2): "¿Es el mismo?".
 * - Changes that didn't reach the account, so nothing disappears without a word.
 * - Monthly charges that look like a fixed payment (S10-6): "¿Pagas X cada mes?".
 */
export default function RevisarScreen() {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const userId = useV2UserId();
  const [problems, setProblems] = useState<SyncProblem[]>([]);
  const [dups, setDups] = useState<PosibleDuplicado[]>([]);
  const [pagos, setPagos] = useState<PagoFijoSugerido[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setProblems(await syncProblems(userId).catch(() => []));
    try {
      const { driver } = await getV2Database();
      const today = toColombiaDateString();
      const data = await readInicioData(driver, userId, daysBefore(today, SUGGEST_DAYS));
      setDups(posiblesDuplicados(data.transactions, data.accounts));
      const dismissed = parseLocal<string[]>((await readLocal(userId, [ONBOARDING_KEYS.dismissedPagos])).get(ONBOARDING_KEYS.dismissedPagos), []);
      setPagos(pagosFijosSugeridos({
        transactions: data.transactions, templates: data.templates, occurrences: data.occurrences,
        destinatarios: data.destinatarios, dismissed, today,
      }));
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

  const answerPago = useCallback(async (s: PagoFijoSugerido, yes: boolean) => {
    setBusy(s.key);
    try {
      if (yes) {
        const { result } = await runLocalCommand({
          type: "createPagoFijo", userId,
          payload: { templateId: Crypto.randomUUID().toLowerCase(), name: s.name, amount: s.amount, dayOfMonth: s.dayOfMonth, startDate: s.startDate },
        });
        if (result.status === "rejected") Alert.alert("No se pudo guardar", result.error ?? "Intenta de nuevo.");
        else notifyV2Change();
      } else {
        const key = ONBOARDING_KEYS.dismissedPagos;
        const had = parseLocal<string[]>((await readLocal(userId, [key])).get(key), []);
        await rememberJson(userId, key, [...new Set([...had, s.key])]);
      }
    } catch (e) {
      console.warn("[v2 revisar] pago answer failed", e);
      Alert.alert("No se pudo guardar", "Intenta de nuevo.");
    }
    await reload();
    setBusy(null);
  }, [userId, reload]);

  if (problems.length === 0 && dups.length === 0 && pagos.length === 0) {
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
          <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Revisar</Text>
          <ProfileButton />
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
        {pagos.map((p) => (
          <View key={p.key} style={[styles.card, styles.dup, { backgroundColor: t.colors.card }, t.shadow]}>
            <Text style={{ fontSize: 17, color: t.colors.ink, fontFamily: t.fonts.uiSemibold, textAlign: "center" }}>¿Pagas {p.name} cada mes?</Text>
            <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.numberSemibold, textAlign: "center" }}>{formatPesos(p.amount)} · el día {p.dayOfMonth}</Text>
            <Text style={{ fontSize: 13, lineHeight: 18, color: t.colors.muted, fontFamily: t.fonts.uiMedium, textAlign: "center" }}>
              Lo vimos el {p.seen}. Si es fijo, Zeta lo aparta de tu número antes de la fecha.
            </Text>
            <Button label="Sí, es un pago fijo" disabled={busy !== null} loading={busy === p.key} onPress={() => void answerPago(p, true)} />
            <Button label="No" variant="secondary" disabled={busy !== null} onPress={() => void answerPago(p, false)} />
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
  title: { flex: 1, fontSize: 26, letterSpacing: -0.5 },
  card: { borderRadius: 18, paddingHorizontal: 14 },
  dup: { paddingVertical: 16, gap: 12 },
  side: { gap: 2 },
  sideRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: { gap: 4, paddingVertical: 12 },
});
