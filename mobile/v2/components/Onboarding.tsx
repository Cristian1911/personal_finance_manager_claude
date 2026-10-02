import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Crypto from "expo-crypto";
import { amountTyping, formatPesos, parseAmount, type CommandType } from "@zeta/shared";
import { toColombiaDateString } from "../../lib/utils/date";
import { useV2Theme } from "../theme/ThemeProvider";
import { Button, IconButton } from "./Button";
import { Chip } from "./Chip";
import { PAY_CHOICES, type PayChoice } from "./FirstRunQuestions";
import { X } from "lucide-react-native";

type Step = 1 | 2 | 3;
interface AccountDraft { key: string; name: string; type: "CASH" | "SAVINGS"; balance: string }
interface BillDraft { key: string; name: string; amount: string; day: string }

const BILL_SUGGESTIONS = ["Arriendo", "Servicios", "Internet", "Celular", "Administración", "Suscripciones"];
const uuid = () => Crypto.randomUUID().toLowerCase();
const zero = (s: string) => /^[$\s0.,]*$/.test(s);
const money = (s: string) => (zero(s) ? 0 : parseAmount(s));

/** Run one command; a Spanish problem or null. */
export type RunCommand = (type: CommandType, payload: unknown) => Promise<string | null>;

/**
 * The first run (launch plan §2): when you get paid, where your money is
 * (Efectivo + accounts with today's balance — their sum is the starting
 * balance, so Mis cuentas and Inicio agree), and the fixed payments before
 * your next pay. Saved at the end as ordinary commands (they sync).
 */
export function Onboarding({ run, onDone }: { run: RunCommand; onDone: () => void }) {
  const t = useV2Theme();
  const [step, setStep] = useState<Step>(1);
  const [choice, setChoice] = useState<PayChoice | null>(null);
  const [income, setIncome] = useState("");
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { key: "cash", name: "Efectivo", type: "CASH", balance: "" },
    { key: "bank", name: "", type: "SAVINGS", balance: "" },
  ]);
  const [bills, setBills] = useState<BillDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const varia = choice === "varia";

  const next1 = () => {
    if (!choice) return setError("Elige cuándo te pagan.");
    if (!varia && !parseAmount(income)) return setError("Escribe cuánto te llega cada vez.");
    setError(null);
    setStep(2);
  };
  const filled = accounts.filter((a) => a.name.trim() && (a.type === "CASH" || a.balance.trim()));
  const total = filled.reduce((s, a) => s + (money(a.balance) ?? 0), 0);
  const next2 = () => {
    const bad = filled.find((a) => money(a.balance) == null);
    if (bad) return setError(`Revisa el saldo de ${bad.name}: escríbelo como 1.200.000.`);
    if (filled.filter((a) => a.type !== "CASH" || (money(a.balance) ?? 0) > 0).length === 0) {
      return setError("Escribe cuánto tienes en al menos una cuenta o en efectivo.");
    }
    setError(null);
    setStep(3);
  };

  const finish = async () => {
    for (const b of bills) {
      const d = Number(b.day);
      if (!b.name.trim() || !parseAmount(b.amount) || !Number.isInteger(d) || d < 1 || d > 28) {
        return setError(`Completa ${b.name.trim() || "el pago"}: monto y día del 1 al 28.`);
      }
    }
    setError(null);
    setSaving(true);
    try {
      const picked = PAY_CHOICES.find((c) => c.key === choice)!;
      const today = toColombiaDateString();
      const steps: [CommandType, unknown][] = [
        ["setCycleSettings", { schedule: picked.schedule, incomePerCycle: varia ? null : parseAmount(income) }],
        ...filled.map((a): [CommandType, unknown] => ["createAccount", {
          accountId: uuid(), accountType: a.type, name: a.name.trim(), currencyCode: "COP", balance: money(a.balance) ?? 0,
        }]),
        // What you have today, as the accounts add up (owner note D1: Mis cuentas and Inicio agree).
        ["setCycleSettings", { balanceAnchor: total }],
        ...bills.map((b): [CommandType, unknown] => {
          const d = Number(b.day);
          // A day already past this month was most likely paid and is inside today's balance: start next month.
          const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
          const [sy, sm] = d >= Number(today.slice(8, 10)) ? [y, m] : m === 12 ? [y + 1, 1] : [y, m + 1];
          return ["createPagoFijo", {
            templateId: uuid(), name: b.name.trim(), amount: parseAmount(b.amount), dayOfMonth: d,
            startDate: `${sy}-${String(sm).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
          }];
        }),
      ];
      for (const [type, payload] of steps) {
        const problem = await run(type, payload);
        if (problem) return setError(problem);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const title = (s: string) => <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{s}</Text>;
  const hint = (s: string) => <Text style={[styles.hint, { color: t.colors.muted, fontFamily: t.fonts.ui }]}>{s}</Text>;
  const input = (value: string, set: (v: string) => void, o: { label: string; placeholder: string; money?: boolean; numeric?: boolean; flex?: number }) => (
    <TextInput
      value={value}
      onChangeText={(v) => { set(o.money ? amountTyping(v) : v); setError(null); }}
      placeholder={o.placeholder}
      placeholderTextColor={t.colors.control}
      keyboardType={o.money ? "decimal-pad" : o.numeric ? "number-pad" : "default"}
      maxLength={o.numeric ? 2 : 60}
      accessibilityLabel={o.label}
      style={[styles.input, { flex: o.flex ?? 1, color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
    />
  );

  return (
    <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
      <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.mono, letterSpacing: 0.5 }}>{step} DE 3</Text>

      {step === 1 && (
        <>
          {title("¿Cuándo te pagan?")}
          <View style={styles.chips}>
            {PAY_CHOICES.map((c) => <Chip key={c.key} label={c.label} on={choice === c.key} onPress={() => { setChoice(c.key); setError(null); }} />)}
          </View>
          {choice && !varia && (
            <>
              {hint("¿Cuánto te llega cada vez? Neto, lo que ves en tu cuenta.")}
              {input(income, setIncome, { label: "Cuánto te llega cada vez", placeholder: "$0", money: true })}
            </>
          )}
          {varia && hint("Zeta va contando lo que te entra; tu número sale de lo que tienes.")}
        </>
      )}

      {step === 2 && (
        <>
          {title("¿Dónde tienes tu plata hoy?")}
          {hint("Tus cuentas y tu efectivo, con lo que tienen hoy. Las tarjetas de crédito las agregas después en Mis cuentas.")}
          {accounts.map((a, i) => (
            <View key={a.key} style={styles.line}>
              {a.type === "CASH"
                ? <Text style={{ flex: 1.2, fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>Efectivo</Text>
                : input(a.name, (v) => setAccounts((xs) => xs.map((x, j) => (j === i ? { ...x, name: v } : x))), { label: `Nombre de la cuenta ${i}`, placeholder: "Ej: Bancolombia", flex: 1.2 })}
              {input(a.balance, (v) => setAccounts((xs) => xs.map((x, j) => (j === i ? { ...x, balance: v } : x))), { label: `Saldo de ${a.name || "la cuenta"}`, placeholder: "$0", money: true })}
              {i > 1 && <IconButton label="Quitar" round size={32} onPress={() => setAccounts((xs) => xs.filter((_, j) => j !== i))} icon={<X size={14} color={t.colors.ink} />} />}
            </View>
          ))}
          <Button label="Otra cuenta" variant="text" onPress={() => setAccounts((xs) => [...xs, { key: uuid(), name: "", type: "SAVINGS", balance: "" }])} style={{ alignSelf: "flex-start" }} />
          <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>Hoy tienes {formatPesos(total)}</Text>
        </>
      )}

      {step === 3 && (
        <>
          {title("¿Qué pagas cada mes?")}
          {hint("Zeta lo aparta de tu número antes de que llegue la fecha, y lo marca pagado cuando lo ve. Puedes saltar esto.")}
          <View style={styles.chips}>
            {BILL_SUGGESTIONS.filter((n) => !bills.some((b) => b.name === n)).map((n) => (
              <Chip key={n} label={`+ ${n}`} on={false} onPress={() => setBills((xs) => [...xs, { key: uuid(), name: n, amount: "", day: "" }])} />
            ))}
            <Chip label="+ Otro" on={false} onPress={() => setBills((xs) => [...xs, { key: uuid(), name: "", amount: "", day: "" }])} />
          </View>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {bills.map((b, i) => (
              <View key={b.key} style={[styles.bill, { borderColor: t.colors.line }]}>
                <View style={styles.line}>
                  {input(b.name, (v) => setBills((xs) => xs.map((x, j) => (j === i ? { ...x, name: v } : x))), { label: `Qué pagas ${i + 1}`, placeholder: "Qué pagas" })}
                  <IconButton label={`Quitar ${b.name || "el pago"}`} round size={32} onPress={() => setBills((xs) => xs.filter((_, j) => j !== i))} icon={<X size={14} color={t.colors.ink} />} />
                </View>
                <View style={styles.line}>
                  {input(b.amount, (v) => setBills((xs) => xs.map((x, j) => (j === i ? { ...x, amount: v } : x))), { label: `Monto de ${b.name || "el pago"}`, placeholder: "$0", money: true, flex: 1.6 })}
                  {input(b.day, (v) => setBills((xs) => xs.map((x, j) => (j === i ? { ...x, day: v } : x))), { label: `Día de ${b.name || "el pago"}`, placeholder: "Día (1–28)", numeric: true })}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: t.colors.bad.text, fontFamily: t.fonts.uiMedium, fontSize: 14 }}>{error}</Text>}

      <View style={styles.actions}>
        {step === 1 && <Button label="Seguir" onPress={next1} />}
        {step === 2 && <Button label="Seguir" onPress={next2} />}
        {step === 3 && <Button label={bills.length ? "Ver mi número" : "Saltar y ver mi número"} onPress={finish} loading={saving} />}
        {step > 1 && !saving && <Button label="Atrás" variant="text" onPress={() => { setError(null); setStep((s) => (s - 1) as Step); }} style={{ alignSelf: "center" }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 18, gap: 10 },
  title: { fontSize: 20, letterSpacing: -0.3 },
  hint: { fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  bill: { gap: 8, borderWidth: 1, borderRadius: 14, padding: 10 },
  input: { minWidth: 0, height: 46, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 10, fontSize: 15 },
  actions: { gap: 4, marginTop: 6 },
});
