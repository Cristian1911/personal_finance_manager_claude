import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, MoreHorizontal, Search, X } from "lucide-react-native";
import {
  detalleView,
  movimientosView,
  type CommandType,
  type MovimientoRow,
  type MovimientoTone,
  type MovimientosFilter,
  type MovimientosGroup,
  type CaptureManualTransactionPayload,
  type DeleteTransactionPayload,
  type EditTransactionPayload,
  type SetTransactionExcludedPayload,
  type SetTransactionNotePayload,
} from "@zeta/shared";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { loadMovimientos, type LoadedMovimientos } from "../../lib/v2/movimientos/load";
import { useV2UserId } from "../../lib/v2/user";
import { Collapse } from "../../v2/components/Collapse";
import { DetalleSheet } from "../../v2/components/DetalleSheet";
import { Dim } from "../../v2/components/Dim";
import { Toast } from "../../v2/components/Toast";
import { useV2Theme } from "../../v2/theme/ThemeProvider";

/**
 * v2 Movimientos (M1, Claude Design "Z Cuentas", movs): one cycle at a time,
 * filters, search, by day; every row opens Detalle. Local only. `?id=` opens
 * that movement's sheet.
 */
export default function MovimientosScreen() {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useV2UserId();
  const params = useLocalSearchParams<{ id?: string }>();
  const [data, setData] = useState<LoadedMovimientos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState<MovimientosFilter>("todos");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(params.id ?? null);

  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const loaded = await loadMovimientos(userId);
      if (id !== request.current) return;
      if (!loaded) return router.back(); // the first-run questions live on Inicio
      setData(loaded);
      setError(null);
    } catch (e) {
      if (id !== request.current) return;
      console.warn("[v2 movimientos] load failed", e);
      setError("No pudimos cargar tus movimientos. Intenta de nuevo.");
    }
  }, [userId, router]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  // Typing stays at full speed; the list catches up a frame later.
  const search = useDeferredValue(query);
  const view = useMemo(
    () => data && movimientosView({ today: data.today, transactions: data.transactions, accounts: data.accounts, cycles: data.cycles, index, filter, query: search }),
    [data, index, filter, search],
  );
  const detalle = useMemo(() => {
    const tx = openId && data?.transactions.find((x) => x.id === openId);
    return tx && data ? detalleView({ today: data.today, transaction: tx, accounts: data.accounts }) : null;
  }, [openId, data]);

  const run = useCallback(async (type: CommandType, payload: unknown) => {
    try {
      const { result } = await runLocalCommand({ type, userId, payload });
      if (result.status === "rejected") Alert.alert("No se pudo guardar", result.error ?? "Intenta de nuevo.");
    } catch (e) {
      console.warn("[v2 movimientos] command failed", e);
      Alert.alert("No se pudo guardar", "Intenta de nuevo.");
    }
    await reload();
  }, [userId, reload]);

  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);

  // "No es un movimiento": a manual entry is deleted, a bank one ignored — both with Deshacer.
  const notAMovement = useCallback(async () => {
    const tx = openId ? data?.transactions.find((x) => x.id === openId) : undefined;
    if (!tx || !detalle) return;
    setOpenId(null);
    if (detalle.manual) {
      await run("deleteTransaction", { transactionId: tx.id } satisfies DeleteTransactionPayload);
      setToast({
        message: `Borrado · ${detalle.title} ${detalle.amount}`,
        undo: () => void run("captureManualTransaction", {
          transactionId: tx.id, accountId: tx.accountId, amount: tx.amount, direction: tx.direction,
          currencyCode: tx.currencyCode, date: tx.date, description: tx.description ?? detalle.title,
          notes: tx.notes ?? null, ...(tx.createdAt ? { capturedAt: tx.createdAt } : {}),
        } satisfies CaptureManualTransactionPayload),
      });
    } else {
      await run("setTransactionExcluded", { transactionId: tx.id, excluded: true } satisfies SetTransactionExcludedPayload);
      setToast({
        message: `Ignorado · ${detalle.title}`,
        undo: () => void run("setTransactionExcluded", { transactionId: tx.id, excluded: false } satisfies SetTransactionExcludedPayload),
      });
    }
  }, [openId, data, detalle, run]);

  const onRow = useCallback((id: string) => setOpenId(id), []);
  // One row open at a time; a new cycle, filter or search closes it.
  const [openRow, setOpenRow] = useState<string | null>(null);
  const onToggle = useCallback((id: string) => setOpenRow((o) => (o === id ? null : id)), []);
  useEffect(() => setOpenRow(null), [index, filter, search]);
  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/inicio" as never)), [router]);
  const tone = useMemo(() => toneColors(t), [t]);

  if (!view) {
    return (
      <View style={[styles.center, { backgroundColor: t.colors.bg, paddingTop: insets.top + 24 }]}>
        {error ? (
          <>
            <Text style={{ color: t.colors.bad.text, fontFamily: t.fonts.uiMedium, textAlign: "center" }} accessibilityRole="alert">{error}</Text>
            <Pressable onPress={back} accessibilityRole="button" style={[styles.ghost, { borderColor: t.colors.control }]}>
              <Text style={{ color: t.colors.ink, fontFamily: t.fonts.uiSemibold, fontSize: 14 }}>Volver</Text>
            </Pressable>
          </>
        ) : <ActivityIndicator color={t.colors.ink} accessibilityLabel="Cargando" />}
      </View>
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={6} style={[styles.square, { borderColor: t.colors.control }]}>
          <ChevronLeft size={18} color={t.colors.ink} strokeWidth={2.2} />
        </Pressable>
        <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} accessibilityRole="header">Movimientos</Text>
        <Pressable
          onPress={() => { setSearching((s) => !s); setQuery(""); }}
          accessibilityRole="button"
          accessibilityLabel={searching ? "Cerrar búsqueda" : "Buscar"}
          hitSlop={6}
          style={[styles.square, { borderColor: t.colors.control }]}
        >
          {searching ? <X size={16} color={t.colors.ink} strokeWidth={2.2} /> : <Search size={17} color={t.colors.ink} strokeWidth={2} />}
        </Pressable>
      </View>

      {searching && (
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          placeholder="Buscar por nombre o nota"
          placeholderTextColor={t.colors.muted}
          returnKeyType="search"
          accessibilityLabel="Buscar movimiento"
          style={[styles.search, { backgroundColor: t.colors.card, color: t.colors.ink, fontFamily: t.fonts.uiMedium }, t.shadow]}
        />
      )}

      <View style={[styles.cycle, { backgroundColor: t.colors.card }, t.shadow]}>
        <Pressable disabled={!view.canOlder} onPress={() => setIndex((i) => i + 1)} accessibilityRole="button" accessibilityLabel="Ciclo anterior" accessibilityState={{ disabled: !view.canOlder }} hitSlop={6} style={styles.chev}>
          <ChevronLeft size={18} color={view.canOlder ? t.colors.ink : t.colors.control} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ fontSize: 14, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }} accessibilityLiveRegion="polite">{view.cycle}</Text>
        <Pressable disabled={!view.canNewer} onPress={() => setIndex((i) => i - 1)} accessibilityRole="button" accessibilityLabel="Ciclo siguiente" accessibilityState={{ disabled: !view.canNewer }} hitSlop={6} style={styles.chev}>
          <ChevronRight size={18} color={view.canNewer ? t.colors.ink : t.colors.control} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {view.filters.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: f.on }}
            hitSlop={{ top: 6, bottom: 6 }}
            style={[styles.filter, f.on ? { backgroundColor: t.colors.button } : { borderWidth: 1.5, borderColor: t.colors.control }]}
          >
            <Text style={{ fontSize: 13, color: f.on ? t.colors.onButton : t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <FlatList
        data={view.groups}
        keyExtractor={(g) => g.date}
        renderItem={({ item }) => <DayGroup group={item} tone={tone} openRow={openRow} onToggle={onToggle} onMore={onRow} />}
        extraData={openRow}
        ListHeaderComponent={header}
        ListEmptyComponent={view.empty ? <Text style={[styles.empty, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>{view.empty}</Text> : null}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
      />
      <DetalleSheet
        detalle={detalle}
        onClose={() => setOpenId(null)}
        onNote={(notes) => detalle && void run("setTransactionNote", { transactionId: detalle.id, notes } satisfies SetTransactionNotePayload)}
        onNotAMovement={() => void notAMovement()}
        onCountAgain={() => detalle && void run("setTransactionExcluded", { transactionId: detalle.id, excluded: false } satisfies SetTransactionExcludedPayload)}
        onFix={(fix) => detalle && void run("editTransaction", { transactionId: detalle.id, ...fix } satisfies EditTransactionPayload)}
      />
      <Toast
        message={toast?.message ?? null}
        action={toast?.undo ? { label: "Deshacer", onPress: toast.undo } : undefined}
        onHide={() => setToast(null)}
      />
    </View>
  );
}

type ToneColors = Record<MovimientoTone, string>;
const toneColors = (t: ReturnType<typeof useV2Theme>): ToneColors => ({
  out: t.colors.bad.text, in: t.colors.ok.text, card: t.colors.muted, neutral: t.colors.muted,
});

// The view is rebuilt on every keystroke and after every edit, so memo compares content:
// only the rows (and day totals) that changed redraw.
const sameRow = (a: MovimientoRow, b: MovimientoRow) =>
  a.id === b.id && a.title === b.title && a.amount === b.amount && a.tone === b.tone
  && a.status === b.status && a.time === b.time && a.account === b.account;

const DayGroup = memo(function DayGroup({ group, tone, openRow, onToggle, onMore }: {
  group: MovimientosGroup; tone: ToneColors; openRow: string | null; onToggle: (id: string) => void; onMore: (id: string) => void;
}) {
  const t = useV2Theme();
  return (
    <View>
      <View style={styles.dayHead} accessible accessibilityRole="header" accessibilityLabel={`${group.label}, ${group.total.replace(/−/g, "menos ").replace(/^\+/, "más ")}`}>
        <Text style={[styles.dayText, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>{group.label}</Text>
        <Text style={[styles.dayText, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>{group.total}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
        {group.rows.map((r, k) => (
          <Row
            key={r.id} row={r} color={tone[r.tone]} last={k === group.rows.length - 1}
            open={openRow === r.id} dimmed={openRow !== null && openRow !== r.id}
            onToggle={onToggle} onMore={onMore}
          />
        ))}
      </View>
    </View>
  );
}, (p, n) => p.tone === n.tone && p.openRow === n.openRow && p.onToggle === n.onToggle && p.onMore === n.onMore && p.group.label === n.group.label && p.group.total === n.group.total
  && p.group.rows.length === n.group.rows.length && p.group.rows.every((r, i) => sameRow(r, n.group.rows[i])));

/**
 * A movement. A tap opens it in place (S8-3): in M1 only ⋯ (Detalle), already in
 * its final spot on the right; Categoría and Destinatario join it in M3.
 */
const Row = memo(function Row({ row: r, color, last, open, dimmed, onToggle, onMore }: {
  row: MovimientoRow; color: string; last: boolean; open: boolean; dimmed: boolean;
  onToggle: (id: string) => void; onMore: (id: string) => void;
}) {
  const t = useV2Theme();
  return (
    <Dim on={dimmed} style={!last && { borderBottomWidth: 1, borderBottomColor: t.colors.line }}>
    <Pressable
      onPress={() => onToggle(r.id)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={r.spoken}
      accessibilityHint={open ? "Cierra" : "Muestra las acciones"}
      style={styles.row}
    >
      <View style={[styles.avatar, { backgroundColor: t.colors.sunk }]}>
        <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiSemibold }}>{r.initial}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: t.colors.ink, fontFamily: t.fonts.uiMedium }]} numberOfLines={1}>{r.title}</Text>
          <Text style={[styles.rowAmount, { color, fontFamily: t.fonts.numberSemibold }]}>{r.amount}</Text>
        </View>
        <View style={styles.rowMeta}>
          {r.status && (
            <View style={[styles.status, { borderColor: t.colors.control }]}>
              <Text style={{ fontSize: 12, color: t.colors.ink, fontFamily: t.fonts.uiMedium }} numberOfLines={1}>{r.status}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {r.time && (
            <View style={[styles.tag, { backgroundColor: t.colors.sunk }]}>
              <Text style={[styles.tagText, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>{r.time}</Text>
            </View>
          )}
          <View style={[styles.tag, { backgroundColor: t.colors.sunk }]}>
            <View style={[styles.dot, { backgroundColor: t.colors.muted }]} />
            <Text style={[styles.tagText, { color: t.colors.muted, fontFamily: t.fonts.mono }]} numberOfLines={1}>{r.account}</Text>
          </View>
        </View>
      </View>
    </Pressable>
    <Collapse open={open}>
      <View style={styles.actions}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => onMore(r.id)}
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${r.title}`}
          style={[styles.more, { borderColor: t.colors.control }]}
        >
          <MoreHorizontal size={20} color={t.colors.ink} />
        </Pressable>
      </View>
    </Collapse>
    </Dim>
  );
}, (p, n) => sameRow(p.row, n.row) && p.color === n.color && p.last === n.last && p.open === n.open
  && p.dimmed === n.dimmed && p.onToggle === n.onToggle && p.onMore === n.onMore);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  ghost: { height: 42, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1.5, justifyContent: "center" },
  headerBlock: { gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  title: { flex: 1, fontSize: 26, letterSpacing: -0.5 },
  square: { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  search: { height: 46, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  cycle: { height: 46, borderRadius: 14, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chev: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  filters: { gap: 6 },
  filter: { height: 32, paddingHorizontal: 12, borderRadius: 9, justifyContent: "center" },
  empty: { fontSize: 14, textAlign: "center", paddingVertical: 24 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6 },
  dayText: { fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase" },
  card: { borderRadius: 18, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  actions: { flexDirection: "row", paddingBottom: 12 },
  more: { width: 44, height: 44, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  avatar: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, minWidth: 0, gap: 6 },
  rowTop: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 15 },
  rowAmount: { flexShrink: 0, fontSize: 15, fontVariant: ["tabular-nums"] },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  status: { flexShrink: 1, height: 22, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, justifyContent: "center" },
  tag: { flexShrink: 1, height: 22, paddingHorizontal: 7, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 5 },
  tagText: { fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
