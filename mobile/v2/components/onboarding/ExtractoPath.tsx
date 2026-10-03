import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import { formatPesos, pagosFijosSugeridos, parseAmount, readInicioData, type CommandType, type PagoFijoSugerido } from "@zeta/shared";
import { toColombiaDateString } from "../../../lib/utils/date";
import { getV2Database } from "../../../lib/v2/engine/database";
import { useV2Theme } from "../../theme/ThemeProvider";
import { Button } from "../Button";
import { Chip } from "../Chip";
import { ExtractoSheet } from "../ExtractoSheet";
import { PAY_CHOICES, type PayChoice } from "../FirstRunQuestions";
import { Card, ErrorLine, Field, Hint, StepLabel, Title } from "./parts";

/**
 * Per-bank steps to download a statement. OWNER TO VERIFY each text against
 * the bank's current app before release (S10-5).
 */
const BANK_STEPS: Record<string, string[]> = {
  Bancolombia: ["Abre la app Bancolombia y entra a tu cuenta o tarjeta", "Busca “Extractos” y elige el mes", "Descarga el PDF y vuelve a Zeta"],
  Nu: ["Abre la app Nu y toca tu tarjeta", "Entra a “Facturas” y elige el mes", "Descarga el PDF y vuelve a Zeta"],
  Davivienda: ["Abre la app Davivienda", "Busca “Extractos” en tu producto", "Descarga el PDF y vuelve a Zeta"],
  "Otro / correo": ["Revisa tu correo: muchos bancos envían el extracto cada mes", "Abre el correo y descarga el PDF adjunto", "Vuelve a Zeta y súbelo aquí"],
};
/** Statements bring ~3 months: look back far enough to see a bill twice. */
const SINCE_DAYS = 120;
const daysBefore = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

interface Found {
  accounts: number;
  cards: number;
  counted: number;
  suggestions: PagoFijoSugerido[];
}

export interface ExtractoResult {
  commands: [CommandType, unknown][];
  dismissed: string[];
}

/**
 * "Tengo mis extractos" (S10-5/S10-6): a per-bank guide so leaving the app
 * isn't scary, the existing statement import, then "Esto encontré": the
 * fixed payments Zeta saw repeat (Sí/No) and the one question a statement
 * can't answer — when you get paid.
 */
export function ExtractoPath({ userId, onFinish, onManual }: {
  userId: string;
  onFinish: (r: ExtractoResult) => Promise<string | null>;
  onManual: () => void;
}) {
  const t = useV2Theme();
  const [bank, setBank] = useState("Bancolombia");
  const [pdf, setPdf] = useState<{ uri: string; name: string } | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [choice, setChoice] = useState<PayChoice | null>(null);
  const [income, setIncome] = useState("");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const varia = choice === "varia";

  const pick = async () => {
    setError(null);
    const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    const f = r.canceled ? null : r.assets[0];
    if (f) setPdf({ uri: f.uri, name: f.name });
  };

  // After each import: what the phone now has.
  const look = async () => {
    setLoading(true);
    try {
      const { driver } = await getV2Database();
      const today = toColombiaDateString();
      const data = await readInicioData(driver, userId, daysBefore(today, SINCE_DAYS));
      if (data.accounts.length === 0) {
        setFound(null);
        setError("Todavía no se importó ningún extracto. Prueba de nuevo o sigue con “Lo digo yo”.");
        return;
      }
      const liquid = data.accounts.filter((a) => ["CASH", "SAVINGS", "CHECKING"].includes(a.accountType) && a.countsInDisponible !== false);
      const counted = liquid.reduce((s, a) => s + a.currentBalance, 0);
      const suggestions = pagosFijosSugeridos({
        transactions: data.transactions, templates: data.templates, occurrences: data.occurrences,
        destinatarios: data.destinatarios, dismissed: [], today,
      });
      setFound({ accounts: liquid.length, cards: data.accounts.filter((a) => a.accountType === "CREDIT_CARD").length, counted, suggestions });
      setAnswers((a) => Object.fromEntries(suggestions.map((s) => [s.key, a[s.key] ?? true])));
      if (!balance) setBalance(liquid.length ? formatPesos(Math.round(counted)) : "");
    } catch (e) {
      console.warn("[v2 onboarding] read after import failed", e);
      setError("No pudimos leer lo importado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const finish = async () => {
    if (!choice) return setError("Elige cuándo te pagan.");
    if (!varia && !parseAmount(income)) return setError("Escribe cuánto te llega cada vez (aproximado sirve).");
    const anchor = /^[$\s0.,]*$/.test(balance) ? 0 : parseAmount(balance);
    if (anchor == null) return setError("Revisa cuánto tienes hoy: escríbelo como 1.200.000.");
    setError(null);
    const picked = PAY_CHOICES.find((c) => c.key === choice)!;
    const yes = (found?.suggestions ?? []).filter((s) => answers[s.key]);
    const commands: [CommandType, unknown][] = [
      ["setCycleSettings", { schedule: picked.schedule, incomePerCycle: varia ? null : parseAmount(income) }],
      ["setCycleSettings", { balanceAnchor: anchor }],
      ...yes.map((s): [CommandType, unknown] => ["createPagoFijo", {
        templateId: Crypto.randomUUID().toLowerCase(), name: s.name, amount: s.amount, dayOfMonth: s.dayOfMonth, startDate: s.startDate,
      }]),
    ];
    setSaving(true);
    try {
      const problem = await onFinish({ commands, dismissed: (found?.suggestions ?? []).filter((s) => !answers[s.key]).map((s) => s.key) });
      if (problem) setError(problem);
    } finally {
      setSaving(false);
    }
  };

  if (found) {
    return (
      <View style={{ gap: 12 }}>
        <Title>Esto encontré</Title>
        <View style={styles.stats}>
          {[["Cuentas", String(found.accounts)], ["Tarjetas", String(found.cards)], ["Tienes hoy", formatPesos(Math.round(found.counted))]].map(([k, v]) => (
            <View key={k} style={[styles.stat, { backgroundColor: t.colors.sunk }]}>
              <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>{k}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.numberSemibold }}>{v}</Text>
            </View>
          ))}
        </View>
        <Button label="Subir otro extracto" variant="secondary" size="M" onPress={pick} />

        {found.suggestions.length > 0 && (
          <>
            <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>¿Estos son pagos fijos tuyos?</Text>
            <Card outlined="soft" style={{ gap: 0, paddingVertical: 4 }}>
              {found.suggestions.map((s, i) => {
                const on = !!answers[s.key];
                return (
                  <View key={s.key} style={[styles.sugg, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.line }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{s.name}</Text>
                      <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.ui }}>{formatPesos(s.amount)} · día {s.dayOfMonth} · visto {s.seen}</Text>
                    </View>
                    <Pressable
                      onPress={() => setAnswers((a) => ({ ...a, [s.key]: !on }))}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${s.name} es un pago fijo`}
                      style={[styles.yes, on ? { backgroundColor: t.colors.ok.tint, borderColor: t.colors.ok.solid } : { borderColor: t.colors.control }]}
                    >
                      <Text style={{ fontSize: 14, color: on ? t.colors.ok.text : t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{on ? "Sí" : "No"}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>¿Cuándo te pagan?</Text>
        <View style={styles.chips}>
          {PAY_CHOICES.map((c) => <Chip key={c.key} label={c.label} on={choice === c.key} onPress={() => { setChoice(c.key); setError(null); }} />)}
        </View>
        {!varia && <Field label="¿Cuánto te llega cada vez? Aproximado sirve" value={income} onChange={setIncome} placeholder="Ej: $2.400.000" money flex={0} />}
        <Field label="Lo que tienes hoy en tus cuentas (corrígelo si cambió)" value={balance} onChange={setBalance} placeholder="$0" money flex={0} />
        <ErrorLine text={error} />
        <Button label="Ver mi número" onPress={finish} loading={saving} />
        <ExtractoSheet file={pdf} userId={userId} onClose={() => { setPdf(null); void look(); }} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <StepLabel>TENGO MIS EXTRACTOS</StepLabel>
      <Title>Trae tus extractos</Title>
      <Hint>Vas a salir un momento a la app de tu banco. Cuando vuelvas, Zeta te espera aquí. Los últimos 3 meses son gratis.</Hint>
      <View style={styles.chips}>
        {Object.keys(BANK_STEPS).map((b) => <Chip key={b} label={b} on={bank === b} onPress={() => setBank(b)} />)}
      </View>
      <Card>
        {BANK_STEPS[bank].map((s, i) => (
          <View key={s} style={styles.step}>
            <View style={[styles.num, { backgroundColor: t.colors.sunk }]}>
              <Text style={{ fontSize: 13, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{i + 1}</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: t.colors.ink, fontFamily: t.fonts.ui }}>{s}</Text>
          </View>
        ))}
        <Hint>La clave del PDF suele ser tu cédula. Zeta puede recordarla.</Hint>
      </Card>
      {loading && <ActivityIndicator color={t.colors.ink} accessibilityLabel="Leyendo lo importado" />}
      <ErrorLine text={error} />
      <Button label="Ya los tengo, subir PDF" onPress={pick} />
      <Button label="Lo hago después" variant="text" onPress={onManual} style={{ alignSelf: "center" }} accessibilityHint="Sigue con Lo digo yo; el extracto te queda como tarea en Hoy" />
      <ExtractoSheet file={pdf} userId={userId} onClose={() => { setPdf(null); void look(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", gap: 3 },
  sugg: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  yes: { minWidth: 60, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
});
