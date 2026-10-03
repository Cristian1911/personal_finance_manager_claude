import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { X } from "lucide-react-native";
import { SETUP_WEIGHTS, firstPagoDate, formatPesos, parseAmount, setupProgress, type CommandType } from "@zeta/shared";
import { toColombiaDateString } from "../../../lib/utils/date";
import { useV2Theme } from "../../theme/ThemeProvider";
import { Button, IconButton } from "../Button";
import { Chip } from "../Chip";
import { PAY_CHOICES, type PayChoice } from "../FirstRunQuestions";
import { Card, ErrorLine, Field, GainChip, Hint, StepLabel, Title } from "./parts";
import { ProgressBar } from "./ProgressBar";

const uuid = () => Crypto.randomUUID().toLowerCase();
const isZero = (s: string) => /^[$\s0.,]*$/.test(s);
/** "" → null (not told); "$0" → 0. */
const money = (s: string): number | null => (!s.trim() ? null : isZero(s) ? 0 : parseAmount(s));
const dayOf = (s: string): number | null => (s.trim() ? Number(s) : null);

const BILL_SUGGESTIONS = ["Arriendo", "Servicios", "Internet", "Celular", "Administración", "Suscripciones"];

interface AccountRow { key: string; name: string; cash: boolean; balance: string }
interface BillRow { key: string; name: string; amount: string; day: string }
interface CardRow { key: string; name: string; limit: string; owed: string; day: string; usd: boolean }
interface LoanRow { key: string; name: string; balance: string; cuota: string; day: string }
type BlockId = "cuentas" | "pagos" | "tarjetas" | "creditos";

export interface ManualResult {
  commands: [CommandType, unknown][];
  pendingBills: string[];
}

/**
 * "Lo digo yo" (S10-3): the basics, then optional blocks for what the user
 * has at hand. Nothing beyond the basics is required; a fixed payment without
 * amount or day becomes a task on Hoy (S10-4). The bar on top moves with
 * every data point.
 */
export function ManualPath({ onFinish, onBack }: { onFinish: (r: ManualResult) => Promise<string | null>; onBack: () => void }) {
  const t = useV2Theme();
  const [choice, setChoice] = useState<PayChoice | null>(null);
  const [income, setIncome] = useState("");
  const [balance, setBalance] = useState("");
  const [open, setOpen] = useState<BlockId | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const varia = choice === "varia";
  const today = toColombiaDateString();

  const namedAccounts = accounts.filter((a) => (a.cash || a.name.trim()) && a.balance.trim());
  const accountsTotal = namedAccounts.reduce((s, a) => s + (money(a.balance) ?? 0), 0);
  const useAccounts = namedAccounts.length > 0;
  const balanceValue = useAccounts ? accountsTotal : money(balance);
  const basicsOk = !!choice && (varia || !!money(income)) && balanceValue != null;

  const completeBill = (b: BillRow) => {
    const d = dayOf(b.day);
    return !!b.name.trim() && !!money(b.amount) && d != null && Number.isInteger(d) && d >= 1 && d <= 28;
  };
  const namedBills = bills.filter((b) => b.name.trim());
  const namedCards = cards.filter((c) => c.name.trim());
  const namedLoans = loans.filter((l) => l.name.trim());

  // The same score Hoy shows, on the draft.
  const draft = useMemo(() => setupProgress({
    settings: basicsOk ? {
      schedule: PAY_CHOICES.find((c) => c.key === choice)!.schedule,
      incomePerCycle: varia ? null : money(income),
      savingsPerCycle: 0,
      balanceAnchor: { balance: balanceValue ?? 0, at: "" },
      bigPurchaseThreshold: 0,
    } : null,
    accounts: namedCards.map(() => ({ accountType: "CREDIT_CARD" })),
    templates: namedBills.filter(completeBill).map(() => ({ isActive: true })),
    transactions: [],
    hasStatement: false,
    pendingBills: namedBills.filter((b) => !completeBill(b)).map((b) => b.name),
    noCards: false,
    noBills: false,
    today,
  }), [basicsOk, choice, varia, income, balanceValue, namedCards.length, bills, today]);
  // Partial basics still move the bar a little, so every answer is felt.
  const partial = draft.tasks[0].done ? 0 : (choice ? 8 : 0) + (varia || money(income) ? 6 : 0) + (balanceValue != null ? 6 : 0);
  const percent = Math.min(100, draft.percent + partial);

  // What the last change added, for the note under the bar.
  const [lastGain, setLastGain] = useState<{ text: string; n: number } | null>(null);
  const doneIds = draft.tasks.filter((x) => x.done).map((x) => x.id).join(",");
  const prev = useRef({ percent, doneIds });
  useEffect(() => {
    const before = prev.current;
    prev.current = { percent, doneIds };
    if (percent <= before.percent) return;
    const was = new Set(before.doneIds.split(","));
    const added = draft.tasks.filter((x) => x.done && !was.has(x.id)).map((x) => x.title);
    setLastGain((g) => ({ text: `+${percent - before.percent}%${added.length ? ` · ${added.join(", ")}` : ""}`, n: (g?.n ?? 0) + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percent, doneIds]);

  const finish = async () => {
    if (!choice) return setError("Elige cuándo te pagan.");
    if (!varia && !money(income)) return setError("Escribe cuánto te llega cada vez (aproximado sirve).");
    if (balanceValue == null) return setError("Escribe cuánto tienes hoy, más o menos.");
    const badDay = [...namedBills.map((b) => b.day), ...namedCards.map((c) => c.day), ...namedLoans.map((l) => l.day)]
      .map(dayOf).find((d) => d != null && (!Number.isInteger(d) || d < 1 || d > 31));
    if (badDay !== undefined) return setError("Revisa los días: van del 1 al 28 (o 31 en tarjetas y créditos).");
    if (namedBills.some((b) => { const d = dayOf(b.day); return d != null && d > 28; })) {
      return setError("Los pagos fijos van del día 1 al 28. Si es fin de mes, pon 28.");
    }
    setError(null);

    const picked = PAY_CHOICES.find((c) => c.key === choice)!;
    const commands: [CommandType, unknown][] = [
      ["setCycleSettings", { schedule: picked.schedule, incomePerCycle: varia ? null : money(income) }],
      ...namedAccounts.map((a): [CommandType, unknown] => ["createAccount", {
        accountId: uuid(), accountType: a.cash ? "CASH" : "SAVINGS", name: a.cash ? "Efectivo" : a.name.trim(),
        currencyCode: "COP", balance: money(a.balance) ?? 0,
      }]),
      ...namedCards.map((c): [CommandType, unknown] => {
        const owed = money(c.owed);
        return ["createAccount", {
          accountId: uuid(), accountType: "CREDIT_CARD", name: c.name.trim(), currencyCode: c.usd ? "USD" : "COP",
          balance: owed ?? 0, balanceUnknown: owed == null, creditLimit: money(c.limit) ?? undefined, paymentDay: dayOf(c.day) ?? undefined,
        }];
      }),
      ...namedLoans.map((l): [CommandType, unknown] => {
        const owed = money(l.balance);
        return ["createAccount", {
          accountId: uuid(), accountType: "LOAN", name: l.name.trim(), currencyCode: "COP",
          balance: owed ?? 0, balanceUnknown: owed == null, monthlyPayment: money(l.cuota) ?? undefined, paymentDay: dayOf(l.day) ?? undefined,
        }];
      }),
      // What you have today, as the accounts add up when you listed them (Mis cuentas and Hoy agree).
      ["setCycleSettings", { balanceAnchor: balanceValue }],
      ...namedBills.filter(completeBill).map((b): [CommandType, unknown] => {
        const d = Number(b.day);
        return ["createPagoFijo", { templateId: uuid(), name: b.name.trim(), amount: money(b.amount), dayOfMonth: d, startDate: firstPagoDate(d, today) }];
      }),
    ];
    setSaving(true);
    try {
      const problem = await onFinish({ commands, pendingBills: namedBills.filter((b) => !completeBill(b)).map((b) => b.name.trim()) });
      if (problem) setError(problem);
    } finally {
      setSaving(false);
    }
  };

  const update = <R extends { key: string }>(set: (f: (xs: R[]) => R[]) => void, key: string, patch: Partial<R>) => {
    set((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    setError(null);
  };
  const remove = <R extends { key: string }>(set: (f: (xs: R[]) => R[]) => void, key: string) => set((xs) => xs.filter((x) => x.key !== key));
  const rowX = (label: string, onPress: () => void) => (
    <IconButton label={label} round size={32} onPress={onPress} icon={<X size={14} color={t.colors.ink} />} />
  );
  const openBlock = (id: BlockId) => {
    setOpen(id);
    if (id === "cuentas" && accounts.length === 0) setAccounts([{ key: "cash", name: "Efectivo", cash: true, balance: "" }, { key: uuid(), name: "", cash: false, balance: "" }]);
    if (id === "tarjetas" && cards.length === 0) setCards([{ key: uuid(), name: "", limit: "", owed: "", day: "", usd: false }]);
    if (id === "creditos" && loans.length === 0) setLoans([{ key: uuid(), name: "", balance: "", cuota: "", day: "" }]);
  };
  const clearBlock = (id: BlockId) => {
    if (id === "cuentas") setAccounts([]);
    if (id === "pagos") setBills([]);
    if (id === "tarjetas") setCards([]);
    if (id === "creditos") setLoans([]);
    setOpen(null);
  };

  const blocks: { id: BlockId; title: string; sub: string; gain: string | null; filled: number; body: ReactElement }[] = [
    {
      id: "cuentas", title: "Mis cuentas por separado", sub: "Cada cuenta con su saldo; reemplaza el total", gain: null, filled: namedAccounts.length,
      body: (
        <>
          {accounts.map((a) => (
            <View key={a.key} style={styles.line}>
              {a.cash
                ? <Text style={{ flex: 1.2, fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>Efectivo</Text>
                : <Field label="Nombre de la cuenta" hideLabel value={a.name} onChange={(v) => update(setAccounts, a.key, { name: v })} placeholder="Ej: Bancolombia" flex={1.2} />}
              <Field label={`Saldo de ${a.cash ? "Efectivo" : a.name || "la cuenta"}`} hideLabel value={a.balance} onChange={(v) => update(setAccounts, a.key, { balance: v })} placeholder="$0" money />
              {!a.cash && rowX(`Quitar ${a.name || "cuenta"}`, () => remove(setAccounts, a.key))}
            </View>
          ))}
          <Button label="Otra cuenta" variant="text" size="S" onPress={() => setAccounts((xs) => [...xs, { key: uuid(), name: "", cash: false, balance: "" }])} style={{ alignSelf: "flex-start" }} />
          {useAccounts && <Hint>Suman {formatPesos(accountsTotal)}. Las tarjetas van aparte.</Hint>}
        </>
      ),
    },
    {
      id: "pagos", title: "Pagos fijos", sub: "Monto y día si los sabes; si no, te los recordamos", gain: `+${SETUP_WEIGHTS.bills}%`, filled: namedBills.length,
      body: (
        <>
          <View style={styles.chips}>
            {BILL_SUGGESTIONS.filter((n) => !bills.some((b) => b.name === n)).map((n) => (
              <Chip key={n} label={`+ ${n}`} on={false} onPress={() => setBills((xs) => [...xs, { key: uuid(), name: n, amount: "", day: "" }])} />
            ))}
            <Chip label="+ Otro" on={false} onPress={() => setBills((xs) => [...xs, { key: uuid(), name: "", amount: "", day: "" }])} />
          </View>
          {bills.map((b) => (
            <View key={b.key} style={[styles.row, { borderColor: t.colors.line }]}>
              <View style={styles.line}>
                <Field label="Qué pagas" hideLabel value={b.name} onChange={(v) => update(setBills, b.key, { name: v })} placeholder="Qué pagas" />
                {rowX(`Quitar ${b.name || "pago"}`, () => remove(setBills, b.key))}
              </View>
              <View style={styles.line}>
                <Field label={`Monto de ${b.name || "el pago"} (opcional)`} hideLabel value={b.amount} onChange={(v) => update(setBills, b.key, { amount: v })} placeholder="Monto (si lo sabes)" money flex={1.6} />
                <Field label={`Día de ${b.name || "el pago"} (opcional)`} hideLabel value={b.day} onChange={(v) => update(setBills, b.key, { day: v })} placeholder="Día 1–28" day />
              </View>
            </View>
          ))}
          {bills.some((b) => b.name.trim() && !completeBill(b)) && <Hint>Los que queden sin monto o día te esperan en Hoy, en “Afina tu número”.</Hint>}
        </>
      ),
    },
    {
      id: "tarjetas", title: "Tarjetas de crédito", sub: "Su factura cuenta por el pago mínimo", gain: `+${SETUP_WEIGHTS.cards}%`, filled: namedCards.length,
      body: (
        <>
          {cards.map((c) => (
            <View key={c.key} style={[styles.row, { borderColor: t.colors.line }]}>
              <View style={styles.line}>
                <Field label="Nombre de la tarjeta" hideLabel value={c.name} onChange={(v) => update(setCards, c.key, { name: v })} placeholder="Ej: Nu, Visa Bancolombia" />
                {rowX(`Quitar ${c.name || "tarjeta"}`, () => remove(setCards, c.key))}
              </View>
              <View style={styles.line}>
                <Field label="Cupo (opcional)" value={c.limit} onChange={(v) => update(setCards, c.key, { limit: v })} placeholder="$0" money />
                <Field label="Debes hoy (opcional)" value={c.owed} onChange={(v) => update(setCards, c.key, { owed: v })} placeholder="$0" money />
              </View>
              <View style={styles.line}>
                <Field label="Día de pago" value={c.day} onChange={(v) => update(setCards, c.key, { day: v })} placeholder="Ej: 20" day />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>Moneda</Text>
                  <View style={styles.chips}>
                    <Chip label="Pesos" on={!c.usd} onPress={() => update(setCards, c.key, { usd: false })} />
                    <Chip label="Dólares" on={c.usd} onPress={() => update(setCards, c.key, { usd: true })} />
                  </View>
                </View>
              </View>
            </View>
          ))}
          <Button label="Otra tarjeta" variant="text" size="S" onPress={() => setCards((xs) => [...xs, { key: uuid(), name: "", limit: "", owed: "", day: "", usd: false }])} style={{ alignSelf: "flex-start" }} />
        </>
      ),
    },
    {
      id: "creditos", title: "Créditos", sub: "Saldo y cuota: Zeta aparta la cuota cada mes", gain: null, filled: namedLoans.length,
      body: (
        <>
          {loans.map((l) => (
            <View key={l.key} style={[styles.row, { borderColor: t.colors.line }]}>
              <View style={styles.line}>
                <Field label="Nombre del crédito" hideLabel value={l.name} onChange={(v) => update(setLoans, l.key, { name: v })} placeholder="Ej: Libre inversión, carro" />
                {rowX(`Quitar ${l.name || "crédito"}`, () => remove(setLoans, l.key))}
              </View>
              <View style={styles.line}>
                <Field label="Saldo" value={l.balance} onChange={(v) => update(setLoans, l.key, { balance: v })} placeholder="$0" money />
                <Field label="Cuota" value={l.cuota} onChange={(v) => update(setLoans, l.key, { cuota: v })} placeholder="$0" money />
                <Field label="Día" value={l.day} onChange={(v) => update(setLoans, l.key, { day: v })} placeholder="5" day flex={0.6} />
              </View>
            </View>
          ))}
          <Button label="Otro crédito" variant="text" size="S" onPress={() => setLoans((xs) => [...xs, { key: uuid(), name: "", balance: "", cuota: "", day: "" }])} style={{ alignSelf: "flex-start" }} />
        </>
      ),
    },
  ];

  return (
    <View style={{ gap: 14 }}>
      <StepLabel>LO DIGO YO</StepLabel>
      <ProgressBar percent={percent} lastGain={lastGain} />

      <Title>Lo básico</Title>
      <Text style={{ fontSize: 14, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>¿Cuándo te pagan?</Text>
      <View style={styles.chips}>
        {PAY_CHOICES.map((c) => <Chip key={c.key} label={c.label} on={choice === c.key} onPress={() => { setChoice(c.key); setError(null); }} />)}
      </View>
      {!varia && <Field label="¿Cuánto te llega cada vez? Neto, aproximado sirve" value={income} onChange={(v) => { setIncome(v); setError(null); }} placeholder="Ej: $2.400.000" money flex={0} />}
      {varia && <Hint>Zeta va contando lo que te entra; tu número sale de lo que tienes.</Hint>}
      {useAccounts
        ? <Hint>Tienes hoy {formatPesos(accountsTotal)}: la suma de tus cuentas.</Hint>
        : <Field label="¿Cuánto tienes hoy, sumando todo? Redondo sirve" value={balance} onChange={(v) => { setBalance(v); setError(null); }} placeholder="Ej: $1.500.000" money flex={0} />}

      <Title>¿Tienes más a la mano?</Title>
      <Hint>Todo es opcional. Lo que no llenes ahora te queda como tarea en Hoy.</Hint>
      {blocks.map((b) => {
        const isOpen = open === b.id;
        return (
          <Card key={b.id} outlined={b.filled && !isOpen ? "ok" : "soft"}>
            <View style={styles.blockHead}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 16, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{b.title}</Text>
                <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.ui }}>{b.filled && !isOpen ? `Listo · ${b.filled}` : b.sub}</Text>
              </View>
              {b.gain ? <GainChip text={b.gain} /> : <GainChip text="más exacto" muted />}
            </View>
            {isOpen ? (
              <>
                {b.body}
                <View style={styles.line}>
                  <Button label="Ahora no" variant="secondary" size="M" onPress={() => clearBlock(b.id)} style={{ flex: 1 }} />
                  <Button label="Listo" size="M" onPress={() => setOpen(null)} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <Button label={b.filled ? "Editar" : "Agregar"} variant="secondary" size="M" onPress={() => openBlock(b.id)} />
            )}
          </Card>
        );
      })}

      <ErrorLine text={error} />
      <Button label="Ver mi número" onPress={finish} loading={saving} disabled={!basicsOk} />
      {!saving && <Button label="Atrás" variant="text" onPress={onBack} style={{ alignSelf: "center" }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  line: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  row: { gap: 8, borderWidth: 1, borderRadius: 14, padding: 10 },
  blockHead: { flexDirection: "row", alignItems: "center", gap: 10 },
});
