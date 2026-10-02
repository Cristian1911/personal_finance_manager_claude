import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { Mic, Square } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { MANUAL_SALARY_DESCRIPTION, amountTyping, anotarPreview, dictado, formatPesos, isDebtAccountType, parseAmount } from "@zeta/shared";
import { loadAnotar, rememberAnotarAccount, type LoadedAnotar } from "../../lib/v2/anotar/load";
import { notifyV2Change } from "../../lib/v2/changes";
import type { AnotarPrefill } from "../../lib/v2/anotar/open";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { toColombiaDateString } from "../../lib/utils/date";
import { useV2Theme } from "../theme/ThemeProvider";
import { Button, IconButton } from "./Button";
import { Chip, Segmented } from "./Chip";
import { Sheet } from "./Sheet";

type Kind = "gasto" | "ingreso" | "entre";
type IncomeKind = "extra" | "pagaron" | "sueldo";

const KINDS = [{ key: "gasto", label: "Gasto" }, { key: "ingreso", label: "Ingreso" }, { key: "entre", label: "Entre cuentas" }] as const;
const INCOME_KINDS: { key: IncomeKind; label: string }[] = [
  { key: "extra", label: "Ingreso extra" }, { key: "pagaron", label: "Me pagaron" }, { key: "sueldo", label: "Mi sueldo" },
];

export interface AnotarSaved {
  message: string;
  undo: () => Promise<void>;
}

const yesterday = (today: string) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Anotar (S8-9, anotar.html): amount first, the effect on Disponible while
 * typing, then only what the kind needs. Guardar closes; the number moving
 * plus Deshacer (toast) is the confirmation.
 */
export function AnotarSheet({ open, prefill, userId, onClose, onSaved, onAddAccount }: {
  open: boolean;
  prefill?: AnotarPrefill | null;
  userId: string;
  onClose: () => void;
  onSaved: (saved: AnotarSaved) => void;
  onAddAccount: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<LoadedAnotar | null>(null);
  const [kind, setKind] = useState<Kind>("gasto");
  const [incomeKind, setIncomeKind] = useState<IncomeKind>("extra");
  const [amountText, setAmountText] = useState("");
  const [what, setWhat] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(toColombiaDateString());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Dictar: what's being heard, while listening.
  const [heard, setHeard] = useState<string | null>(null);
  const dataRef = useRef<LoadedAnotar | null>(null);
  dataRef.current = data;

  // Fresh every time it opens: today's date, the last account used.
  useEffect(() => {
    if (!open) return;
    setKind(prefill?.kind ?? "gasto");
    setIncomeKind("extra");
    setAmountText("");
    setWhat("");
    setToAccountId(prefill?.toAccountId ?? null);
    setDate(toColombiaDateString());
    setError(null);
    setSaving(false);
    loadAnotar(userId).then((d) => {
      setData(d);
      const counted = d.accounts.find((a) => !isDebtAccountType(a.accountType));
      setAccountId(d.lastAccountId ?? counted?.id ?? d.accounts[0]?.id ?? null);
      if (prefill?.dictar && d.accounts.length > 0) void listen();
    }).catch((e) => {
      console.warn("[v2 anotar] load failed", e);
      setError("No pudimos cargar tus cuentas. Intenta de nuevo.");
    });
  }, [open, userId, prefill]);

  // ── Dictar (S8-9): on-device speech → v1's offline parser → the fields ──
  useSpeechRecognitionEvent("result", (e) => {
    const said = e.results[0]?.transcript ?? "";
    setHeard(said);
    if (e.isFinal) fill(said);
  });
  useSpeechRecognitionEvent("end", () => setHeard(null));
  useSpeechRecognitionEvent("error", (e) => {
    setHeard(null);
    if (e.error !== "no-speech" && e.error !== "aborted") setError(e.error === "not-allowed" ? "Zeta no tiene permiso para el micrófono." : "No pude escucharte. Intenta de nuevo.");
  });
  const fill = (said: string) => {
    const d = dictado(said, dataRef.current?.accounts ?? [], new Date(), kind);
    // Only a spoken income switches a Gasto to Ingreso; never the other way.
    if (kind === "gasto" && d.kind === "ingreso") setKind("ingreso");
    if (d.amount) setAmountText(amountTyping(String(d.amount).replace(".", ",")));
    if (d.what) setWhat(d.what);
    if (d.accountId) setAccountId(d.accountId);
  };
  async function listen() {
    setError(null);
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permiso de micrófono", "Actívalo en los Ajustes del teléfono para dictar.");
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return setError("Dictar no está disponible en este teléfono.");
    // On-device only (privacy labels): audio never leaves the phone.
    if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      return setError("Este teléfono no puede dictar sin enviar tu voz a internet. Escribe el monto.");
    }
    ExpoSpeechRecognitionModule.start({ lang: await spanishLocale(), interimResults: true, continuous: false, requiresOnDeviceRecognition: true, addsPunctuation: false });
    setHeard("");
  }
  const stopListening = () => { try { ExpoSpeechRecognitionModule.stop(); } catch { /* already stopped */ } };
  // Closing drops what was being heard (abort: no final result lands in a closed sheet).
  useEffect(() => {
    if (!open) {
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* not listening */ }
      setHeard(null);
    }
  }, [open]);

  const amount = parseAmount(amountText) ?? 0;
  const accounts = data?.accounts ?? [];
  // Money comes in to (and moves out of) accounts you have, not cards.
  const fromChoices = kind === "gasto" ? accounts : accounts.filter((a) => !isDebtAccountType(a.accountType));
  const from = fromChoices.find((a) => a.id === accountId) ?? null;
  const toChoices = accounts.filter((a) => a.id !== from?.id);
  const preview = useMemo(() => (data && from
    ? anotarPreview({ ...data.input, today: data.input.today }, { kind, amount, accountId: from.id, toAccountId, date })
    : null), [data, from, kind, amount, toAccountId, date]);

  // "Mi sueldo" keeps a fixed description (Inicio recognizes the salary by it); its "De qué" goes to the note.
  const salary = kind === "ingreso" && incomeKind === "sueldo";
  const description = salary
    ? MANUAL_SALARY_DESCRIPTION
    : kind === "ingreso"
      ? what.trim() || INCOME_KINDS.find((k) => k.key === incomeKind)!.label
      : what.trim() || "Gasto";
  const ready = amount > 0 && !!from && (kind !== "entre" || !!toAccountId);
  // Paying a card or loan: offer what's owed.
  const payTo = kind === "entre" ? accounts.find((a) => a.id === toAccountId && isDebtAccountType(a.accountType)) ?? null : null;

  const save = async () => {
    if (!ready || !from) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === "entre") {
        const to = accounts.find((a) => a.id === toAccountId)!;
        const ids = { transferGroupId: uuid(), fromTransactionId: uuid(), toTransactionId: uuid() };
        const { result } = await runLocalCommand({
          type: "captureTransfer", userId,
          payload: { ...ids, fromAccountId: from.id, toAccountId: to.id, amount, currencyCode: "COP", date },
        });
        if (result.status === "rejected") return setError(result.error ?? "No se pudo anotar.");
        finish(`${from.name || "Cuenta"} → ${to.name || "cuenta"} · ${formatPesos(amount)}`, ids.fromTransactionId);
      } else {
        const transactionId = uuid();
        const income = kind === "ingreso";
        const { result } = await runLocalCommand({
          type: "captureManualTransaction", userId,
          payload: {
            transactionId, accountId: from.id, amount, direction: income ? "INFLOW" : "OUTFLOW",
            currencyCode: "COP", date, description, flowClass: income ? "INCOME" : "SPEND",
            ...(salary && what.trim() ? { notes: what.trim() } : {}),
          },
        });
        if (result.status === "rejected") return setError(result.error ?? "No se pudo anotar.");
        finish(`${description} ${income ? "+" : "−"}${formatPesos(amount)}`, transactionId);
      }
    } catch (e) {
      console.warn("[v2 anotar] save failed", e);
      setError("No se pudo anotar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const finish = (what: string, transactionId: string) => {
    void rememberAnotarAccount(userId, from!.id);
    notifyV2Change();
    onSaved({
      message: `Anotado · ${what}`,
      undo: async () => {
        // Deleting one leg of a transfer removes both (deleteTransaction).
        const { result } = await runLocalCommand({ type: "deleteTransaction", userId, payload: { transactionId } });
        notifyV2Change();
        if (result.status === "rejected") throw new Error(result.error ?? "rejected");
      },
    });
    onClose();
  };

  const label = (s: string) => <Text style={[styles.label, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>{s}</Text>;
  const accountChips = (list: typeof accounts, value: string | null, set: (id: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
      {list.map((a) => <Chip key={a.id} label={a.name?.trim() || "Cuenta"} on={a.id === value} onPress={() => set(a.id)} />)}
    </ScrollView>
  );
  const today = toColombiaDateString();

  return (
    <Sheet open={open} onClose={onClose} style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      {data && accounts.length === 0 ? (
        <View style={styles.none}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Primero, una cuenta</Text>
          <Text style={{ fontSize: 15, lineHeight: 22, textAlign: "center", color: t.colors.muted, fontFamily: t.fonts.ui }}>
            Para anotar necesitas al menos una cuenta o tu efectivo. Así Zeta sabe de dónde sale y qué cuenta para tu número.
          </Text>
          <Button label="Agregar cuenta" onPress={() => { onClose(); onAddAccount(); }} />
        </View>
      ) : (
        <>
          <Segmented options={KINDS} value={kind} onChange={(k) => { setKind(k); setError(null); }} />
          <View style={styles.amountRow}>
          <View style={styles.micSlot} />
          <TextInput
            value={amountText}
            onChangeText={(v) => { setAmountText(amountTyping(v)); setError(null); }}
            placeholder="$0"
            placeholderTextColor={t.colors.control}
            keyboardType="decimal-pad"
            autoFocus
            accessibilityLabel="Monto"
            style={[styles.amount, { color: t.colors.ink, fontFamily: t.fonts.numberSemibold }]}
          />
          <View style={styles.micSlot}>
            <IconButton
              label={heard != null ? "Terminar de dictar" : "Dictar"}
              round
              onPress={heard != null ? stopListening : () => void listen()}
              icon={heard != null ? <Square size={14} color={t.colors.ink} fill={t.colors.ink} /> : <Mic size={17} color={t.colors.ink} />}
            />
          </View>
          </View>
          {kind === "entre" && payTo && payTo.currentBalance > 0 && (
            <View style={styles.centerChips}>
              <Chip label={`Todo lo que debes · ${formatPesos(payTo.currentBalance)}`} on={amount === payTo.currentBalance} onPress={() => setAmountText(amountTyping(String(payTo.currentBalance).replace(".", ",")))} />
            </View>
          )}
          <Text accessibilityLiveRegion="polite" style={[styles.preview, { color: heard == null && preview?.tone === "bad" ? t.colors.bad.text : t.colors.muted, fontFamily: t.fonts.uiMedium }]}>
            {heard != null ? (heard ? `«${heard}»` : "Di algo como «almuerzo 45 mil en efectivo»") : preview?.line ?? " "}
          </Text>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {kind === "ingreso" && (
              <View style={styles.centerChips}>
                {INCOME_KINDS.map((k) => <Chip key={k.key} label={k.label} on={incomeKind === k.key} onPress={() => setIncomeKind(k.key)} />)}
              </View>
            )}
            {kind !== "entre" && (
              <TextInput
                value={what}
                onChangeText={setWhat}
                placeholder={kind === "gasto" ? "En qué · almuerzo, taxi…" : "De qué · freelance, bono…"}
                placeholderTextColor={t.colors.control}
                maxLength={200}
                returnKeyType="done"
                accessibilityLabel={kind === "gasto" ? "En qué" : "De qué"}
                style={[styles.input, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
              />
            )}
            {label(kind === "entre" ? "De" : "Cuenta")}
            {accountChips(fromChoices, from?.id ?? null, (id) => { setAccountId(id); if (id === toAccountId) setToAccountId(null); })}
            {kind === "entre" && (
              <>
                {label("A")}
                {accountChips(toChoices, toAccountId, setToAccountId)}
              </>
            )}
            {label("Fecha")}
            <View style={styles.chips}>
              <Chip label="Hoy" on={date === today} onPress={() => setDate(today)} />
              <Chip label="Ayer" on={date === yesterday(today)} onPress={() => setDate(yesterday(today))} />
            </View>
            {error && <Text accessibilityRole="alert" style={{ color: t.colors.bad.text, fontFamily: t.fonts.uiMedium, fontSize: 14 }}>{error}</Text>}
          </ScrollView>
          <Button label="Guardar" onPress={save} loading={saving} disabled={!ready} />
        </>
      )}
    </Sheet>
  );
}

const uuid = () => Crypto.randomUUID().toLowerCase();

/** es-CO when the phone has it on-device, else another installed Spanish (es-US, es-MX, es-ES…). */
async function spanishLocale(): Promise<string> {
  try {
    const { locales, installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    const pool = installedLocales?.length ? installedLocales : locales;
    const es = pool.filter((l) => /^es[-_]/i.test(l));
    return es.find((l) => /co$/i.test(l)) ?? es.find((l) => /(us|mx|419)$/i.test(l)) ?? es[0] ?? "es-CO";
  } catch {
    return "es-CO";
  }
}

const styles = StyleSheet.create({
  sheet: { maxHeight: "94%", paddingTop: 8, paddingHorizontal: 20, gap: 10 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  title: { fontSize: 19, textAlign: "center" },
  none: { gap: 16, paddingVertical: 12 },
  amountRow: { flexDirection: "row", alignItems: "center" },
  micSlot: { width: 44, alignItems: "center" },
  amount: { flex: 1, fontSize: 40, textAlign: "center", fontVariant: ["tabular-nums"], paddingVertical: 4 },
  preview: { fontSize: 13.5, textAlign: "center", minHeight: 20 },
  body: { flexShrink: 1 },
  bodyContent: { gap: 10, paddingBottom: 4 },
  label: { fontSize: 13 },
  chips: { flexDirection: "row", gap: 6 },
  centerChips: { flexDirection: "row", justifyContent: "center", gap: 6, flexWrap: "wrap" },
  input: { height: 46, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 12, fontSize: 16 },
});
