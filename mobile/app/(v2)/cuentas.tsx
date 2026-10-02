import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import type { CuentaRow } from "@zeta/shared";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { loadCuentas, type LoadedCuentas } from "../../lib/v2/cuentas/load";
import { useV2UserId } from "../../lib/v2/user";
import { AccountSheet, type AccountForm, type AddKind } from "../../v2/components/AccountSheet";
import { Avatar } from "../../v2/components/Avatar";
import { Button, IconButton } from "../../v2/components/Button";
import { ConfirmSheet } from "../../v2/components/ConfirmSheet";
import { useV2Theme } from "../../v2/theme/ThemeProvider";

const ADD_KINDS: AddKind[] = ["cuenta", "efectivo", "tarjeta", "credito"];

/**
 * Mis cuentas (S8-4, cuentas.html §1): what counts for Disponible on top,
 * money you have apart from money you owe, a switch per account that asks
 * first, and Agregar. `?add=tarjeta` opens Agregar on that kind.
 */
export default function CuentasScreen() {
  const t = useV2Theme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useV2UserId();
  const params = useLocalSearchParams<{ add?: string }>();
  const [data, setData] = useState<LoadedCuentas | null>(null);
  const [adding, setAdding] = useState<{ kind: AddKind | null } | null>(null);
  const [toggle, setToggle] = useState<CuentaRow | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await loadCuentas(userId));
    } catch (e) {
      console.warn("[v2 cuentas] load failed", e);
      Alert.alert("No pudimos cargar tus cuentas", "Intenta de nuevo.");
    }
  }, [userId]);
  useFocusEffect(useCallback(() => {
    void reload();
    const k = params.add as AddKind | undefined;
    if (k && ADD_KINDS.includes(k)) {
      setAdding({ kind: k });
      router.setParams({ add: undefined });
    }
  }, [reload, params.add, router]));

  const add = useCallback(async (f: AccountForm): Promise<string | null> => {
    // A throw here reaches AccountSheet's save, which shows "No se pudo guardar".
    const { result } = await runLocalCommand({
      type: "createAccount",
      userId,
      payload: {
        accountId: Crypto.randomUUID().toLowerCase(),
        accountType: f.accountType, name: f.name, institutionName: f.institutionName, mask: f.mask,
        currencyCode: "COP", balance: f.balance ?? 0,
        creditLimit: f.creditLimit, cutoffDay: f.cutoffDay, paymentDay: f.paymentDay, monthlyPayment: f.monthlyPayment,
      },
    });
    if (result.status === "rejected") return result.error ?? "No se pudo agregar.";
    setAdding(null);
    await reload();
    return null;
  }, [userId, reload]);

  const setCounts = useCallback(async (row: CuentaRow) => {
    setToggle(null);
    try {
      const { result } = await runLocalCommand({ type: "setAccountCountsInDisponible", userId, payload: { accountId: row.id, counts: !row.counts } });
      if (result.status === "rejected") Alert.alert("No se pudo cambiar", result.error ?? "");
    } catch (e) {
      console.warn("[v2 cuentas] switch failed", e);
      Alert.alert("No se pudo cambiar", "Intenta de nuevo.");
    }
    await reload();
  }, [userId, reload]);

  const back = () => (router.canGoBack() ? router.back() : router.navigate("/inicio" as never));
  const v = data?.view;
  const empty = v && v.cuentas.length === 0 && v.deudas.length === 0;

  const rows = (list: CuentaRow[]) => (
    <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
      {list.map((r, i) => (
        <View key={r.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.line }]}>
          <Pressable
            onPress={() => router.push({ pathname: "/cuenta", params: { id: r.id } } as never)}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}, ${r.sub}, ${r.isDebt ? "debes" : "saldo"} ${r.amount}`}
            style={styles.rowMain}
          >
            <Avatar name={r.title} kind="none" />
            <View style={styles.rowBody}>
              <Text numberOfLines={1} style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{r.title}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12.5, color: t.colors.muted, fontFamily: t.fonts.ui }}>{r.sub}</Text>
            </View>
            <Text style={[styles.amount, { color: t.colors.ink, fontFamily: t.fonts.numberSemibold }]}>{r.amount}</Text>
          </Pressable>
          {r.canCount ? (
            <Switch
              value={r.counts}
              onValueChange={() => setToggle(r)}
              accessibilityLabel={`${r.title} cuenta para tu Disponible`}
              trackColor={{ true: t.colors.ok.solid, false: t.colors.sunk }}
              thumbColor={t.colors.card}
              ios_backgroundColor={t.colors.sunk}
            />
          ) : (
            <ChevronRight size={16} color={t.colors.control} />
          )}
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.titleRow}>
          <IconButton label="Volver" onPress={back} icon={<ChevronLeft size={18} color={t.colors.ink} strokeWidth={2.2} />} />
          <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Mis cuentas</Text>
          <IconButton label="Agregar cuenta" onPress={() => setAdding({ kind: null })} icon={<Plus size={18} color={t.colors.ink} strokeWidth={2.2} />} />
        </View>

        {(v?.counted || v?.apart || v?.owed) && (
          <View style={[styles.summary, { backgroundColor: t.colors.card }, t.shadow]}>
            <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>Cuentan para tu Disponible</Text>
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 28, color: t.colors.ink, fontFamily: t.fonts.numberSemibold, fontVariant: ["tabular-nums"] }}>{v.counted ?? "$0"}</Text>
            {(v.apart || v.owed) && (
              <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui }}>
                {[v.apart && `Aparte ${v.apart}`, v.owed && `Debes ${v.owed}`].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>
        )}

        {empty && (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 15, lineHeight: 22, textAlign: "center", color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>
              Agrega tus cuentas, tu efectivo y tus tarjetas para anotar en cada una y saber de dónde sale tu número.
            </Text>
            <Button label="Agregar cuenta" onPress={() => setAdding({ kind: null })} />
          </View>
        )}

        {v && v.cuentas.length > 0 && (
          <>
            <Text style={[styles.section, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>CUENTAS</Text>
            {rows(v.cuentas)}
          </>
        )}
        {v && v.deudas.length > 0 && (
          <>
            <Text style={[styles.section, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>TARJETAS Y CRÉDITOS</Text>
            {rows(v.deudas)}
          </>
        )}
        {!empty && v && <Button label="Agregar" variant="secondary" onPress={() => setAdding({ kind: null })} icon={<Plus size={16} color={t.colors.ink} />} />}
      </ScrollView>

      <AccountSheet open={!!adding} mode="add" initialKind={adding?.kind ?? null} onSave={add} onClose={() => setAdding(null)} />
      <ConfirmSheet
        open={!!toggle}
        title={toggle?.counts ? `¿Dejar de contar ${toggle?.title}?` : `¿Contar ${toggle?.title}?`}
        consequence={toggle?.counts
          ? `Su saldo de ${toggle?.amount} sale de tu Disponible y sus gastos dejan de restarlo. Sus movimientos siguen en Movimientos.`
          : `Su saldo de ${toggle?.amount} entra a tu Disponible y sus gastos lo restan.`}
        confirmLabel={toggle?.counts ? "Dejar de contarla" : "Contarla"}
        onConfirm={() => toggle && void setCounts(toggle)}
        onCancel={() => setToggle(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  title: { flex: 1, fontSize: 26, letterSpacing: -0.5 },
  summary: { borderRadius: 18, padding: 16, gap: 4, alignItems: "center" },
  section: { fontSize: 11, letterSpacing: 0.6, paddingHorizontal: 4, marginTop: 6 },
  card: { borderRadius: 18, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 64 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  amount: { fontSize: 15, fontVariant: ["tabular-nums"] },
  emptyBox: { gap: 16, paddingVertical: 32, paddingHorizontal: 12 },
});
