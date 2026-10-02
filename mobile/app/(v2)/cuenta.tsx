import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { formatPesos, movimientosView, type AccountRow } from "@zeta/shared";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { loadAccount, loadCuentas, type LoadedCuentas } from "../../lib/v2/cuentas/load";
import { loadMovimientos } from "../../lib/v2/movimientos/load";
import { useV2UserId } from "../../lib/v2/user";
import { openAnotar } from "../../lib/v2/anotar/open";
import { AccountSheet, type AccountForm } from "../../v2/components/AccountSheet";
import { Button, IconButton } from "../../v2/components/Button";
import { ConfirmSheet } from "../../v2/components/ConfirmSheet";
import { EmptyState } from "../../v2/components/EmptyState";
import { useV2Theme } from "../../v2/theme/ThemeProvider";
import { useV2Changes } from "../../lib/v2/changes";

const PREVIEW_ROWS = 3;

/**
 * One account (cuentas.html §2): its balance, whether it counts, this
 * cycle's latest movements and "Ver todos" (Movimientos narrowed to it).
 * Editing and archiving are quiet at the end.
 */
export default function CuentaScreen() {
  const t = useV2Theme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useV2UserId();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [cuentas, setCuentas] = useState<LoadedCuentas | null>(null);
  const [mov, setMov] = useState<Awaited<ReturnType<typeof loadMovimientos>>>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"count" | "archive" | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const [a, c, m] = await Promise.all([loadAccount(userId, id), loadCuentas(userId), loadMovimientos(userId)]);
      setAccount(a);
      setCuentas(c);
      setMov(m);
    } catch (e) {
      console.warn("[v2 cuenta] load failed", e);
      Alert.alert("No pudimos cargar la cuenta", "Intenta de nuevo.");
    }
  }, [userId, id]);
  // Anotar and Deshacer change the data without moving focus.
  useV2Changes(() => void reload());
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const row = cuentas && [...cuentas.view.cuentas, ...cuentas.view.deudas].find((r) => r.id === id);
  const preview = useMemo(() => mov && id
    ? movimientosView({ today: mov.today, transactions: mov.transactions, accounts: mov.accounts, cycles: mov.cycles, index: 0, filter: "todos", query: "", accountId: id })
    : null, [mov, id]);
  const rows = preview?.groups.flatMap((g) => g.rows.map((r) => ({ ...r, day: g.label }))) ?? [];

  /** Runs a command; returns the Spanish problem, or null when it went through. */
  const run = useCallback(async (type: "editAccount" | "archiveAccount" | "setAccountCountsInDisponible", payload: unknown) => {
    let problem: string | null = null;
    try {
      const { result } = await runLocalCommand({ type, userId, payload });
      if (result.status === "rejected") problem = result.error ?? "No se pudo guardar.";
    } catch (e) {
      console.warn("[v2 cuenta] command failed", e);
      problem = "No se pudo guardar. Intenta de nuevo.";
    }
    await reload();
    return problem;
  }, [userId, reload]);
  const runOrAlert = useCallback(async (type: "archiveAccount" | "setAccountCountsInDisponible", payload: unknown) => {
    const problem = await run(type, payload);
    if (problem) Alert.alert("No se pudo guardar", problem);
    return problem;
  }, [run]);

  const save = useCallback(async (f: AccountForm) => {
    if (!account) return null;
    // Only what changed: each field is versioned on its own, so an untouched
    // field must not overwrite an edit made on another device.
    const card = account.accountType === "CREDIT_CARD";
    const loan = account.accountType === "LOAN";
    const next: Record<string, unknown> = { name: f.name, institutionName: f.institutionName, mask: f.mask };
    if (card) Object.assign(next, { creditLimit: f.creditLimit, cutoffDay: f.cutoffDay, paymentDay: f.paymentDay });
    if (loan) Object.assign(next, { monthlyPayment: f.monthlyPayment, paymentDay: f.paymentDay });
    const changed = Object.fromEntries(Object.entries(next).filter(([k, v]) => (account as unknown as Record<string, unknown>)[k] !== v));
    if (Object.keys(changed).length === 0) {
      setEditing(false);
      return null;
    }
    const problem = await run("editAccount", { accountId: account.id, ...changed });
    if (!problem) setEditing(false);
    return problem;
  }, [account, run]);

  const back = () => (router.canGoBack() ? router.back() : router.navigate("/cuentas" as never));
  if (!account || !row) {
    // Still loading, or archived / not on this phone: say so, with a way out.
    return cuentas ? (
      <EmptyState title="Cuenta" message="Esta cuenta ya no está en Mis cuentas.">
        <Button label="Volver" variant="secondary" size="M" onPress={back} />
      </EmptyState>
    ) : <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;
  }
  const debt = row.isDebt;
  const facts = [
    account.accountType === "CREDIT_CARD" && account.creditLimit != null && `Cupo ${formatPesos(account.creditLimit)} · te quedan ${formatPesos(Math.max(0, account.creditLimit - account.currentBalance))}`,
    account.cutoffDay != null && `Corte el ${account.cutoffDay}`,
    account.paymentDay != null && `Pago el ${account.paymentDay}`,
  ].filter(Boolean).join(" · ");

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.titleRow}>
          <IconButton label="Volver" onPress={back} icon={<ChevronLeft size={18} color={t.colors.ink} strokeWidth={2.2} />} />
          <Text numberOfLines={1} accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>{row.title}</Text>
        </View>

        <View style={[styles.card, styles.hero, { backgroundColor: t.colors.card }, t.shadow]}>
          <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>{debt ? "Debes" : "Saldo"}</Text>
          <Text style={{ fontSize: 32, color: t.colors.ink, fontFamily: t.fonts.numberSemibold, fontVariant: ["tabular-nums"] }}>{row.amount}</Text>
          {/* The kind and digits; the cut/pay days go in the facts line below. */}
          <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui }}>{facts ? row.sub.split(" · ")[0] : row.sub}</Text>
          {facts ? <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui, textAlign: "center" }}>{facts}</Text> : null}
        </View>

        {debt && (
          <Button label={account.accountType === "CREDIT_CARD" ? "Pagar tarjeta" : "Pagar cuota"} onPress={() => openAnotar({ kind: "entre", toAccountId: account.id })} />
        )}

        {row.canCount && (
          <View style={[styles.card, styles.switchRow, { backgroundColor: t.colors.card }, t.shadow]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>Cuenta para mi Disponible</Text>
              <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui }}>
                {row.counts ? "Su saldo y sus movimientos mueven tu número" : "Es plata aparte: no mueve tu número"}
              </Text>
            </View>
            <Switch
              value={row.counts}
              onValueChange={() => setConfirm("count")}
              accessibilityLabel="Cuenta para mi Disponible"
              trackColor={{ true: t.colors.ok.solid, false: t.colors.sunk }}
              thumbColor={t.colors.card}
              ios_backgroundColor={t.colors.sunk}
            />
          </View>
        )}

        <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
          <Text style={[styles.section, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>MOVIMIENTOS · ESTE CICLO</Text>
          {rows.length === 0 ? (
            <Text style={{ fontSize: 14, color: t.colors.muted, fontFamily: t.fonts.ui, paddingVertical: 12 }}>Nada en este ciclo todavía.</Text>
          ) : rows.slice(0, PREVIEW_ROWS).map((r, i) => (
            <View key={r.id} accessible accessibilityLabel={r.spoken} style={[styles.mov, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.line }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{r.title}</Text>
                <Text style={{ fontSize: 12.5, color: t.colors.muted, fontFamily: t.fonts.ui }}>{[r.day, r.time].filter(Boolean).join(" · ")}</Text>
              </View>
              <Text style={{ fontSize: 14.5, color: t.colors.ink, fontFamily: t.fonts.numberSemibold, fontVariant: ["tabular-nums"] }}>{r.amount}</Text>
            </View>
          ))}
          <Button
            label={rows.length > PREVIEW_ROWS ? `Ver los ${rows.length}` : "Ver todos sus movimientos"}
            variant="secondary"
            size="M"
            onPress={() => router.navigate({ pathname: "/movimientos", params: { account: account.id } } as never)}
            style={{ marginVertical: 12 }}
          />
        </View>

        <Button label="Editar cuenta" variant="text" onPress={() => setEditing(true)} style={{ alignSelf: "center" }} />
        <Button label="Archivar cuenta" variant="text" onPress={() => setConfirm("archive")} style={{ alignSelf: "center" }} />
      </ScrollView>

      <AccountSheet open={editing} mode="edit" account={account} onSave={save} onClose={() => setEditing(false)} />
      <ConfirmSheet
        open={confirm === "count"}
        title={row.counts ? `¿Dejar de contar ${row.title}?` : `¿Contar ${row.title}?`}
        consequence={row.counts
          ? `Su saldo de ${row.amount} sale de tu Disponible y sus gastos dejan de restarlo. Sus movimientos siguen en Movimientos.`
          : `Su saldo de ${row.amount} entra a tu Disponible y sus gastos lo restan.`}
        confirmLabel={row.counts ? "Dejar de contarla" : "Contarla"}
        onConfirm={() => { setConfirm(null); void runOrAlert("setAccountCountsInDisponible", { accountId: account.id, counts: !row.counts }); }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm === "archive"}
        title={`¿Archivar ${row.title}?`}
        consequence={debt
          ? "Sale de Mis cuentas y de tus pagos. Sus movimientos se quedan."
          : "Sale de Mis cuentas y de tu Disponible, y ya no aparece al anotar. Sus movimientos se quedan."}
        confirmLabel="Archivar"
        destructive
        onConfirm={async () => {
          setConfirm(null);
          if (!(await runOrAlert("archiveAccount", { accountId: account.id, archived: true }))) back();
        }}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  title: { flex: 1, fontSize: 26, letterSpacing: -0.5 },
  card: { borderRadius: 18, paddingHorizontal: 16 },
  hero: { alignItems: "center", gap: 4, paddingVertical: 18 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  section: { fontSize: 11, letterSpacing: 0.6, paddingTop: 14, paddingBottom: 4 },
  mov: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
});
