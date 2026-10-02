import { useCallback, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { Banknote, CalendarClock, CreditCard, Plus } from "lucide-react-native";
import { amountTyping, formatPesos, parseAmount, type CommandType, type PagoRow, type PagosView } from "@zeta/shared";
import { openAnotar } from "../../lib/v2/anotar/open";
import { notifyV2Change, useV2Changes } from "../../lib/v2/changes";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { loadPagos, type LoadedPagos } from "../../lib/v2/pagos/load";
import { useV2UserId } from "../../lib/v2/user";
import { toColombiaDateString } from "../../lib/utils/date";
import { Button, IconButton } from "../../v2/components/Button";
import { Chip } from "../../v2/components/Chip";
import { EmptyState } from "../../v2/components/EmptyState";
import { Sheet } from "../../v2/components/Sheet";
import { Tap } from "../../v2/components/Tap";
import { useV2Theme } from "../../v2/theme/ThemeProvider";

const KIND_ICON = { fijo: CalendarClock, card: CreditCard, loan: Banknote } as const;

/**
 * Pagos (S8-1): what has to be paid this cycle — fixed payments, card bills
 * and loan cuotas — the same list Inicio subtracts from Disponible. Tap a
 * row: Pagar (Anotar prefilled), Ya lo pagué, Este mes no. `?add=1` opens
 * Agregar pago fijo.
 */
export default function PagosScreen() {
  const t = useV2Theme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useV2UserId();
  const params = useLocalSearchParams<{ add?: string }>();
  const [data, setData] = useState<LoadedPagos | null | undefined>(undefined);
  const [open, setOpen] = useState<PagoRow | null>(null);
  const [adding, setAdding] = useState(false);
  const afterClose = useRef<(() => void) | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await loadPagos(userId));
    } catch (e) {
      console.warn("[v2 pagos] load failed", e);
      Alert.alert("No pudimos cargar tus pagos", "Intenta de nuevo.");
    }
  }, [userId]);
  useV2Changes(() => void reload());
  useFocusEffect(useCallback(() => {
    void reload();
    if (params.add) {
      setAdding(true);
      router.setParams({ add: undefined });
    }
  }, [reload, params.add, router]));

  const run = useCallback(async (type: CommandType, payload: unknown): Promise<string | null> => {
    try {
      const { result } = await runLocalCommand({ type, userId, payload });
      if (result.status === "rejected") return result.error ?? "No se pudo guardar.";
      notifyV2Change();
      return null;
    } catch (e) {
      console.warn("[v2 pagos] command failed", e);
      return "No se pudo guardar. Intenta de nuevo.";
    }
  }, [userId]);

  const setStatus = useCallback(async (row: PagoRow, status: "pending" | "paid" | "skipped") => {
    setOpen(null);
    const problem = await run("setOccurrenceStatus", { templateId: row.item.templateId, date: row.item.dueDate, status });
    if (problem) Alert.alert("No se pudo guardar", problem);
  }, [run]);

  const pay = useCallback((row: PagoRow) => {
    setOpen(null);
    const owed = Math.round((row.item.amount - row.item.paid) * 100) / 100;
    // iOS can't present Anotar's modal while this sheet's is still closing: open it once it's gone.
    afterClose.current = () => {
      if (row.kind === "fijo") openAnotar({ kind: "gasto", amount: owed, what: row.title });
      else openAnotar({ kind: "entre", toAccountId: row.item.accountId, amount: owed });
    };
  }, []);

  if (data === null) {
    return <EmptyState title="Pagos" message="Responde las tres preguntas de Inicio y aquí vas a ver lo que tienes que pagar antes de tu próximo pago." />;
  }

  const list = (v: PagosView, muted = false) => (
    <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
      {v.rows.map((r, i) => {
        const Icon = KIND_ICON[r.kind];
        const subColor = r.tone === "warn" ? t.colors.warn.text : r.tone === "ok" ? t.colors.ok.text : t.colors.muted;
        return (
          <Tap
            key={r.id}
            onPress={() => setOpen(r)}
            disabled={muted}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}, ${r.amount}, ${r.sub}`}
            style={(pressed) => [styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.line }, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.icon, { backgroundColor: t.colors.sunk }]}><Icon size={18} color={t.colors.ink} strokeWidth={2} /></View>
            <View style={styles.rowBody}>
              <Text numberOfLines={1} style={{ fontSize: 15, color: muted ? t.colors.muted : t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{r.title}</Text>
              <Text style={{ fontSize: 12.5, color: subColor, fontFamily: t.fonts.uiMedium }}>{r.sub}</Text>
            </View>
            <Text style={[styles.amount, {
              color: r.status === "pending" && !muted ? t.colors.ink : t.colors.muted, fontFamily: t.fonts.numberSemibold,
              textDecorationLine: r.status === "skipped" ? "line-through" : "none",
            }]}>{r.amount}</Text>
          </Tap>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Pagos</Text>
          <IconButton label="Agregar pago fijo" onPress={() => setAdding(true)} icon={<Plus size={18} color={t.colors.ink} strokeWidth={2.2} />} />
        </View>

        {data && (data.now.rows.length > 0 || data.next.rows.length > 0) && (
          <View style={[styles.summary, { backgroundColor: t.colors.card }, t.shadow]}>
            <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>
              {data.now.left ? "Te falta pagar este ciclo" : "Este ciclo"}
            </Text>
            <Text style={{ fontSize: 28, color: t.colors.ink, fontFamily: t.fonts.numberSemibold, fontVariant: ["tabular-nums"] }}>
              {data.now.left ?? "Todo al día"}
            </Text>
            <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui, textAlign: "center" }}>
              Ya está restado de tu Disponible.
            </Text>
          </View>
        )}

        {data && data.now.rows.length === 0 && data.next.rows.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 15, lineHeight: 22, textAlign: "center", color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>
              Agrega lo que pagas cada mes (arriendo, servicios, suscripciones) y Zeta lo aparta de tu Disponible antes de que llegue. Tus tarjetas y créditos aparecen aquí solos cuando tienen día de pago.
            </Text>
            <Button label="Agregar pago fijo" onPress={() => setAdding(true)} />
          </View>
        )}

        {data && data.now.rows.length > 0 && (
          <>
            <Text style={[styles.section, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>ESTE CICLO</Text>
            {list(data.now)}
          </>
        )}
        {data && data.next.rows.length > 0 && (
          <>
            <Text style={[styles.section, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>PRÓXIMO CICLO</Text>
            {list(data.next, true)}
          </>
        )}
      </ScrollView>

      <PagoSheet row={open} onClose={() => setOpen(null)} onPay={pay} onStatus={setStatus}
        onClosed={() => { const next = afterClose.current; afterClose.current = null; next?.(); }}
        onArchive={async (row) => {
          setOpen(null);
          const problem = await run("archivePagoFijo", { templateId: row.item.templateId, archived: true });
          if (problem) Alert.alert("No se pudo guardar", problem);
        }}
      />
      <AddPagoFijoSheet open={adding} accounts={data?.accounts ?? []} onClose={() => setAdding(false)}
        onSave={async (p) => {
          const problem = await run("createPagoFijo", { templateId: Crypto.randomUUID().toLowerCase(), ...p });
          if (!problem) setAdding(false);
          return problem;
        }}
      />
    </View>
  );
}

/** One bill's actions. Pagar opens Anotar prefilled; the detection then marks it paid. */
function PagoSheet({ row, onClose, onClosed, onPay, onStatus, onArchive }: {
  row: PagoRow | null;
  onClose: () => void;
  onClosed: () => void;
  onPay: (r: PagoRow) => void;
  onStatus: (r: PagoRow, s: "pending" | "paid" | "skipped") => void;
  onArchive: (r: PagoRow) => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [last, setLast] = useState<PagoRow | null>(null);
  if (row && row !== last) setLast(row);
  const r = row ?? last;
  const fijo = r?.kind === "fijo";
  return (
    <Sheet open={!!row} onClose={onClose} onClosed={onClosed} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      {r && (
        <>
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{r.title}</Text>
          <Text style={{ fontSize: 15, textAlign: "center", color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>{r.amount} · {r.sub}</Text>
          {r.item.estimated && r.status === "pending" && (
            <Text style={{ fontSize: 13, lineHeight: 19, textAlign: "center", color: t.colors.muted, fontFamily: t.fonts.ui }}>
              Es lo que debías al corte. Cuando llegue el extracto, Zeta usa el valor exacto.
            </Text>
          )}
          <View style={{ gap: 4, marginTop: 8 }}>
            {r.status === "pending" && <Button label="Pagar" onPress={() => onPay(r)} />}
            {r.status === "pending" && fijo && <Button label="Ya lo pagué" variant="secondary" onPress={() => onStatus(r, "paid")} accessibilityHint="Lo marca como pagado sin anotar un movimiento" />}
            {r.status === "pending" && fijo && <Button label="Este mes no" variant="text" onPress={() => onStatus(r, "skipped")} accessibilityHint="Deja de apartarlo este mes" />}
            {r.status !== "pending" && fijo && <Button label="Volver a pendiente" variant="secondary" onPress={() => onStatus(r, "pending")} />}
            {fijo && <Button label="Ya no lo pago" variant="text" onPress={() => onArchive(r)} accessibilityHint="Deja de aparecer en los próximos ciclos" />}
            {!fijo && r.status !== "pending" && (
              <Text style={{ fontSize: 13, textAlign: "center", color: t.colors.muted, fontFamily: t.fonts.ui }}>Se marca solo con los pagos a la cuenta.</Text>
            )}
          </View>
        </>
      )}
    </Sheet>
  );
}

/** Agregar pago fijo: what, how much, which day (1–28, owner note D12), from which account (optional). */
function AddPagoFijoSheet({ open, accounts, onClose, onSave }: {
  open: boolean;
  accounts: LoadedPagos["accounts"];
  onClose: () => void;
  onSave: (p: { name: string; amount: number; dayOfMonth: number; startDate: string; accountId: string | null }) => Promise<string | null>;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setName(""); setAmount(""); setDay(""); setAccountId(null); setError(null); setSaving(false);
  }
  if (!open && wasOpen) setWasOpen(false);

  const save = async () => {
    const n = parseAmount(amount);
    const d = Number(day);
    if (!name.trim()) return setError("Escribe qué pagas.");
    if (!n) return setError("Escribe el monto, por ejemplo 1.200.000.");
    if (!Number.isInteger(d) || d < 1 || d > 28) return setError("El día va del 1 al 28.");
    // It starts this month: if its day already passed, a payment already made is found and linked.
    const today = toColombiaDateString();
    const startDate = `${today.slice(0, 8)}${String(d).padStart(2, "0")}`;
    setSaving(true);
    const problem = await onSave({ name: name.trim(), amount: n, dayOfMonth: d, startDate, accountId });
    setSaving(false);
    if (problem) setError(problem);
  };

  const input = (label: string, value: string, set: (v: string) => void, o: { placeholder: string; keyboard?: "default" | "decimal-pad" | "number-pad"; maxLength?: number }) => (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => { set(o.keyboard === "decimal-pad" ? amountTyping(v) : v); setError(null); }}
        placeholder={o.placeholder}
        placeholderTextColor={t.colors.control}
        keyboardType={o.keyboard ?? "default"}
        maxLength={o.maxLength}
        accessibilityLabel={label}
        style={[styles.input, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
      />
    </View>
  );

  return (
    <Sheet open={open} onClose={onClose} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={[styles.sheetTitle, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Agregar pago fijo</Text>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
        {input("Qué pagas", name, setName, { placeholder: "Ej: Arriendo, Netflix, Internet", maxLength: 60 })}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1.4 }}>{input("Cuánto", amount, setAmount, { placeholder: "$0", keyboard: "decimal-pad" })}</View>
          <View style={{ flex: 1 }}>{input("Día del mes", day, setDay, { placeholder: "Ej: 5", keyboard: "number-pad", maxLength: 2 })}</View>
        </View>
        {accounts.filter((a) => a.accountType !== "LOAN").length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>De qué cuenta sale (opcional)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {accounts.filter((a) => a.accountType !== "LOAN").map((a) => (
                <Chip key={a.id} label={a.name?.trim() || "Cuenta"} on={accountId === a.id} onPress={() => setAccountId(accountId === a.id ? null : a.id)} />
              ))}
            </View>
          </View>
        )}
        {amount && parseAmount(amount) ? (
          <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui }}>
            Zeta aparta {formatPesos(parseAmount(amount)!)} de tu Disponible antes de cada fecha y lo marca pagado cuando ve el pago.
          </Text>
        ) : null}
        {error && <Text accessibilityRole="alert" style={{ color: t.colors.bad.text, fontFamily: t.fonts.uiMedium, fontSize: 14 }}>{error}</Text>}
      </ScrollView>
      <Button label="Agregar" onPress={save} loading={saving} disabled={!name.trim() || !amount || !day} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  title: { flex: 1, fontSize: 26, letterSpacing: -0.5 },
  summary: { borderRadius: 18, padding: 16, gap: 4, alignItems: "center" },
  section: { fontSize: 11, letterSpacing: 0.6, paddingHorizontal: 4, marginTop: 6 },
  card: { borderRadius: 18, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10 },
  icon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  amount: { fontSize: 15, fontVariant: ["tabular-nums"] },
  emptyBox: { gap: 16, paddingVertical: 24, paddingHorizontal: 12 },
  sheet: { maxHeight: "90%", paddingTop: 8, paddingHorizontal: 20, gap: 10 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  sheetTitle: { fontSize: 19, textAlign: "center" },
  input: { height: 46, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 12, fontSize: 16 },
});
