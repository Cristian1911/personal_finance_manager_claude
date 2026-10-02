import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { SetCycleSettingsPayload, StoredPaySchedule } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";

export type PayChoice = "15y30" | "30" | "15" | "varia";
type Choice = PayChoice;

/** When you get paid, as the first run and Ajustes › Cuándo me pagan offer it. */
export const PAY_CHOICES: { key: Choice; label: string; schedule: StoredPaySchedule }[] = [
  { key: "15y30", label: "El 15 y el 30", schedule: { kind: "semimonthly", paydays: [15, 30] } },
  { key: "30", label: "Cada 30", schedule: { kind: "monthly", paydays: [30] } },
  { key: "15", label: "Cada 15", schedule: { kind: "monthly", paydays: [15] } },
  { key: "varia", label: "Varía (independiente)", schedule: { kind: "irregular" } },
];

/** Digits only → pesos; "" stays empty (not zero). */
const parsePesos = (text: string): number | null => {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : null;
};
const showPesos = (n: number | null) => (n == null ? "" : `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`);

/**
 * Inicio's first run (docs/mlp/03-experience-proposal.md steps 2–3): when you
 * get paid, how much, and how much you have today. The answers go out as one
 * setCycleSettings command; the balance becomes the first cycle's anchor.
 */
export function FirstRunQuestions({ onSubmit }: { onSubmit: (payload: SetCycleSettingsPayload) => Promise<string | null> }) {
  const t = useV2Theme();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [income, setIncome] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const varia = choice === "varia";

  const submit = async () => {
    const picked = PAY_CHOICES.find((c) => c.key === choice);
    if (!picked) return setError("Elige cuándo te pagan.");
    if (!varia && !income) return setError("Escribe cuánto te llega cada vez.");
    if (balance == null) return setError("Escribe cuánto tienes hoy.");
    setError(null);
    setSaving(true);
    try {
      setError(await onSubmit({ schedule: picked.schedule, incomePerCycle: income, balanceAnchor: balance }));
    } finally {
      setSaving(false);
    }
  };

  const label = [styles.label, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }];
  const hint = [styles.hint, { color: t.colors.muted, fontFamily: t.fonts.ui }];
  const input = [styles.input, { color: t.colors.ink, backgroundColor: t.colors.sunk, borderColor: t.colors.line, fontFamily: t.fonts.uiMedium }];

  return (
    <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
      <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Tres preguntas para sacar tu número</Text>

      <Text style={label}>¿Cuándo te pagan?</Text>
      <View style={styles.chips}>
        {PAY_CHOICES.map((c) => {
          const on = c.key === choice;
          return (
            <Pressable
              key={c.key}
              onPress={() => setChoice(c.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { borderColor: on ? t.colors.button : t.colors.line, backgroundColor: on ? t.colors.button : t.colors.card }]}
            >
              <Text style={{ color: on ? t.colors.onButton : t.colors.ink, fontFamily: t.fonts.uiMedium, fontSize: 15 }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={label}>{varia ? "¿Cuánto te entra en un mes normal?" : "¿Cuánto te llega cada vez?"}</Text>
      <Text style={hint}>{varia ? "Lo usamos solo como referencia." : "Neto, lo que ves en tu cuenta."}</Text>
      <TextInput
        value={showPesos(income)}
        onChangeText={(v) => setIncome(parsePesos(v))}
        keyboardType="number-pad"
        placeholder="$0"
        placeholderTextColor={t.colors.muted}
        accessibilityLabel={varia ? "Ingreso de un mes normal" : "Ingreso de cada pago"}
        accessibilityHint={varia ? "Lo usamos solo como referencia." : "Neto, lo que ves en tu cuenta."}
        style={input}
      />

      <Text style={label}>¿Cuánto tienes hoy en tus cuentas?</Text>
      <Text style={hint}>Suma lo de todos tus bancos. No cuentes tarjetas de crédito.</Text>
      <TextInput
        value={showPesos(balance)}
        onChangeText={(v) => setBalance(parsePesos(v))}
        keyboardType="number-pad"
        placeholder="$0"
        placeholderTextColor={t.colors.muted}
        accessibilityLabel="Saldo de hoy"
        accessibilityHint="Suma lo de todos tus bancos. No cuentes tarjetas de crédito."
        style={input}
      />

      {error && (
        <Text
          style={[styles.error, { color: t.colors.bad.text, fontFamily: t.fonts.uiMedium }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}

      <Pressable
        onPress={submit}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        style={[styles.button, { backgroundColor: t.colors.button, opacity: saving ? 0.6 : 1 }]}
      >
        {saving ? (
          <ActivityIndicator color={t.colors.onButton} accessibilityLabel="Guardando" />
        ) : (
          <Text style={{ color: t.colors.onButton, fontFamily: t.fonts.uiSemibold, fontSize: 16 }}>Ver mi número</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 18, gap: 8 },
  title: { fontSize: 18, marginBottom: 6 },
  label: { fontSize: 16, marginTop: 10 },
  hint: { fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, minHeight: 44, justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, marginTop: 4 },
  error: { fontSize: 14, marginTop: 8 },
  button: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 14, minHeight: 50, justifyContent: "center" },
});
