import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banknote, ChevronRight, CreditCard, Landmark, Wallet, type LucideIcon } from "lucide-react-native";
import { parseAmount, type AccountRow } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";
import { Button } from "./Button";
import { Segmented } from "./Chip";
import { Sheet } from "./Sheet";
import { Tap } from "./Tap";

/** The four kinds Agregar offers (cuentas.html §4). */
export type AddKind = "cuenta" | "efectivo" | "tarjeta" | "credito";

const KINDS: { key: AddKind; title: string; sub: string; icon: LucideIcon }[] = [
  { key: "cuenta", title: "Cuenta", sub: "Ahorros, corriente, Nequi, Daviplata", icon: Landmark },
  { key: "efectivo", title: "Efectivo", sub: "Lo que llevas encima", icon: Wallet },
  { key: "tarjeta", title: "Tarjeta de crédito", sub: "Cupo, día de corte y de pago", icon: CreditCard },
  { key: "credito", title: "Crédito o préstamo", sub: "Lo que debes, cuota y día", icon: Banknote },
];

export function kindOf(accountType: string): AddKind {
  return accountType === "CASH" ? "efectivo" : accountType === "CREDIT_CARD" ? "tarjeta" : accountType === "LOAN" ? "credito" : "cuenta";
}

/** What Agregar / Editar sends; the screen turns it into createAccount / editAccount. */
export interface AccountForm {
  accountType: string;
  name: string;
  institutionName: string | null;
  mask: string | null;
  balance: number | null;
  creditLimit: number | null;
  cutoffDay: number | null;
  paymentDay: number | null;
  monthlyPayment: number | null;
}

const money = (n: number | null | undefined) => (n == null ? "" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
const day = (s: string) => (s.trim() === "" ? null : Number(s));

/**
 * Agregar (pick a kind, then only what that kind needs) and Editar (same
 * fields, no kind and no balance: the balance moves only with movements).
 */
export function AccountSheet({ open, mode, initialKind, account, onSave, onClose }: {
  open: boolean;
  mode: "add" | "edit";
  /** Skip the kind step (e.g. "Agregar tarjeta" from Inicio). */
  initialKind?: AddKind | null;
  /** Editar: the account as it is. */
  account?: AccountRow | null;
  onSave: (form: AccountForm) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<AddKind | null>(null);
  const [savings, setSavings] = useState<"SAVINGS" | "CHECKING">("SAVINGS");
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [mask, setMask] = useState("");
  const [balance, setBalance] = useState("");
  const [limit, setLimit] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [payDay, setPayDay] = useState("");
  const [cuota, setCuota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fresh form every time it opens.
  useEffect(() => {
    if (!open) return;
    const a = account;
    setKind(a ? kindOf(a.accountType) : initialKind ?? null);
    setSavings(a?.accountType === "CHECKING" ? "CHECKING" : "SAVINGS");
    setName(a?.name ?? (initialKind === "efectivo" ? "Efectivo" : ""));
    setBank(a?.institutionName ?? "");
    setMask(a?.mask ?? "");
    setBalance("");
    setLimit(money(a?.creditLimit));
    setCutoff(a?.cutoffDay ? String(a.cutoffDay) : "");
    setPayDay(a?.paymentDay ? String(a.paymentDay) : "");
    setCuota(money(a?.monthlyPayment));
    setError(null);
    setSaving(false);
  }, [open, account, initialKind]);

  const pick = (k: AddKind) => {
    setKind(k);
    if (k === "efectivo" && !name) setName("Efectivo");
  };

  const save = async () => {
    if (!kind) return;
    const accountType = kind === "cuenta" ? savings : kind === "efectivo" ? "CASH" : kind === "tarjeta" ? "CREDIT_CARD" : "LOAN";
    const parsedBalance = balance.trim() === "" ? 0 : parseAmount(balance);
    if (mode === "add" && balance.trim() !== "" && parsedBalance == null && balance.trim() !== "0") {
      return setError("Escribe el saldo en pesos, por ejemplo 1.200.000.");
    }
    const opt = (s: string) => (s.trim() === "" ? null : parseAmount(s));
    setSaving(true);
    const problem = await onSave({
      accountType,
      name: name.trim(),
      institutionName: bank.trim() || null,
      mask: mask.trim() || null,
      balance: mode === "add" ? parsedBalance ?? 0 : null,
      creditLimit: kind === "tarjeta" ? opt(limit) : null,
      cutoffDay: kind === "tarjeta" ? day(cutoff) : null,
      paymentDay: kind === "tarjeta" || kind === "credito" ? day(payDay) : null,
      monthlyPayment: kind === "credito" ? opt(cuota) : null,
    });
    setSaving(false);
    if (problem) setError(problem);
  };

  const field = (label: string, value: string, set: (v: string) => void, o: { placeholder?: string; keyboard?: KeyboardTypeOptions; maxLength?: number; hint?: string } = {}) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => { set(v); setError(null); }}
        placeholder={o.placeholder}
        placeholderTextColor={t.colors.control}
        keyboardType={o.keyboard ?? "default"}
        maxLength={o.maxLength}
        accessibilityLabel={label}
        accessibilityHint={o.hint}
        style={[styles.input, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
      />
    </View>
  );

  const title = mode === "edit" ? "Editar cuenta" : kind ? KINDS.find((k) => k.key === kind)!.title : "Agregar";
  const owe = kind === "tarjeta" || kind === "credito";

  return (
    <Sheet open={open} onClose={onClose} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{title}</Text>

      {!kind ? (
        <View style={[styles.list, { borderColor: t.colors.line }]}>
          {KINDS.map((k, i) => (
            <Tap
              key={k.key}
              onPress={() => pick(k.key)}
              accessibilityRole="button"
              accessibilityLabel={`${k.title}. ${k.sub}`}
              style={(pressed) => [styles.kind, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.line }, pressed && { backgroundColor: t.colors.sunk }]}
            >
              <View style={[styles.kindIcon, { backgroundColor: t.colors.sunk }]}><k.icon size={18} color={t.colors.ink} strokeWidth={2} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{k.title}</Text>
                <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui }}>{k.sub}</Text>
              </View>
              <ChevronRight size={16} color={t.colors.control} />
            </Tap>
          ))}
        </View>
      ) : (
        <>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {kind === "cuenta" && mode === "add" && (
              <Segmented options={[{ key: "SAVINGS", label: "Ahorros" }, { key: "CHECKING", label: "Corriente" }] as const} value={savings} onChange={setSavings} />
            )}
            {field("Nombre", name, setName, { placeholder: kind === "tarjeta" ? "Ej: Tarjeta Nu" : kind === "credito" ? "Ej: Libre inversión" : "Ej: Bancolombia ahorros", maxLength: 60 })}
            {kind !== "efectivo" && field(kind === "credito" ? "Entidad" : "Banco", bank, setBank, { placeholder: "Opcional", maxLength: 60 })}
            {(kind === "cuenta" || kind === "tarjeta") && field("Últimos 4 dígitos", mask, setMask, { placeholder: "Opcional", keyboard: "number-pad", maxLength: 4, hint: "Para reconocer sus movimientos" })}
            {mode === "add" && field(owe ? "Lo que debes hoy" : "Saldo de hoy", balance, setBalance, { placeholder: "$0", keyboard: "decimal-pad" })}
            {kind === "tarjeta" && field("Cupo", limit, setLimit, { placeholder: "Opcional", keyboard: "decimal-pad" })}
            {kind === "tarjeta" && (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>{field("Día de corte", cutoff, setCutoff, { placeholder: "Ej: 27", keyboard: "number-pad", maxLength: 2 })}</View>
                <View style={{ flex: 1 }}>{field("Día de pago", payDay, setPayDay, { placeholder: "Ej: 12", keyboard: "number-pad", maxLength: 2 })}</View>
              </View>
            )}
            {kind === "credito" && (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>{field("Cuota", cuota, setCuota, { placeholder: "$0", keyboard: "decimal-pad" })}</View>
                <View style={{ flex: 1 }}>{field("Día de pago", payDay, setPayDay, { placeholder: "Ej: 5", keyboard: "number-pad", maxLength: 2 })}</View>
              </View>
            )}
            {error && <Text accessibilityRole="alert" style={{ color: t.colors.bad.text, fontFamily: t.fonts.uiMedium, fontSize: 14 }}>{error}</Text>}
          </ScrollView>
          <Button label={mode === "edit" ? "Guardar cambios" : "Agregar"} onPress={save} loading={saving} disabled={name.trim() === ""} />
          {mode === "add" && !initialKind && <Button label="Otro tipo" variant="text" onPress={() => setKind(null)} style={{ alignSelf: "center" }} />}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: "92%", paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  title: { fontSize: 19, textAlign: "center" },
  list: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  kind: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 64 },
  kindIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  body: { flexShrink: 1 },
  bodyContent: { gap: 12, paddingBottom: 4 },
  field: { gap: 6 },
  label: { fontSize: 13 },
  input: { height: 46, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 12, fontSize: 16 },
  row2: { flexDirection: "row", gap: 10 },
});
