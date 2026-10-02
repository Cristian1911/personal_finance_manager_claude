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
  categoryById,
  patternFrom,
} from "@zeta/shared";
import * as Crypto from "expo-crypto";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { loadMovimientos, type LoadedMovimientos } from "../../lib/v2/movimientos/load";
import { useV2UserId } from "../../lib/v2/user";
import { Collapse } from "../../v2/components/Collapse";
import { Button, IconButton } from "../../v2/components/Button";
import { Chip } from "../../v2/components/Chip";
import { CategorySheet, DestinatarioSheet } from "../../v2/components/LabelSheets";
import { Avatar } from "../../v2/components/Avatar";
import { EmptyState } from "../../v2/components/EmptyState";
import { DetalleSheet } from "../../v2/components/DetalleSheet";
import { Dim } from "../../v2/components/Dim";
import { Toast } from "../../v2/components/Toast";
import { useV2Theme } from "../../v2/theme/ThemeProvider";
import { useV2Changes } from "../../lib/v2/changes";

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
  const params = useLocalSearchParams<{ id?: string; account?: string }>();
  const [data, setData] = useState<LoadedMovimientos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState<MovimientosFilter>("todos");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(params.id ?? null);
  const [needsFirstRun, setNeedsFirstRun] = useState(false);

  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const loaded = await loadMovimientos(userId);
      if (id !== request.current) return;
      setNeedsFirstRun(!loaded); // the first-run questions live on Inicio
      if (loaded) setData(loaded);
      setError(null);
    } catch (e) {
      if (id !== request.current) return;
      console.warn("[v2 movimientos] load failed", e);
      setError("No pudimos cargar tus movimientos. Intenta de nuevo.");
    }
  }, [userId]);
  // Anotar and Deshacer change the data without moving focus.
  useV2Changes(() => void reload());
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  // Typing stays at full speed; the list catches up a frame later.
  const search = useDeferredValue(query);
  const view = useMemo(
    () => data && movimientosView({ today: data.today, transactions: data.transactions, accounts: data.accounts, cycles: data.cycles, index, filter, query: search, accountId: params.account ?? null, destinatarios: data.destinatarios }),
    [data, index, filter, search, params.account],
  );
  const detalle = useMemo(() => {
    const tx = openId && data?.transactions.find((x) => x.id === openId);
    return tx && data ? detalleView({ today: data.today, transaction: tx, accounts: data.accounts }) : null;
  }, [openId, data]);

  /** Runs a command and reloads; true when it was applied. */
  const run = useCallback(async (type: CommandType, payload: unknown): Promise<boolean> => {
    let applied = false;
    try {
      const { result } = await runLocalCommand({ type, userId, payload });
      if (result.status === "rejected") Alert.alert("No se pudo guardar", result.error ?? "Intenta de nuevo.");
      applied = result.status === "applied";
    } catch (e) {
      console.warn("[v2 movimientos] command failed", e);
      Alert.alert("No se pudo guardar", "Intenta de nuevo.");
    }
    await reload();
    return applied;
  }, [userId, reload]);

  // One row open at a time; a new cycle, filter or search closes it.
  const [openRow, setOpenRow] = useState<string | null>(null);
  // A new movement (Anotar, a sync) closes the open row, or it'd arrive dimmed.
  const seen = useRef(0);
  useEffect(() => {
    const n = data?.transactions.length ?? 0;
    if (n > seen.current && seen.current > 0) setOpenRow(null);
    seen.current = n;
  }, [data]);
  const [toast, setToast] = useState<{ message: string; undo?: () => void; action?: { label: string; onPress: () => void } } | null>(null);
  const [labeling, setLabeling] = useState<{ row: MovimientoRow; what: "category" | "destinatario" } | null>(null);

  // Categoría · Destinatario (S8-3), from the open row.
  const onCategory = useCallback((r: MovimientoRow) => setLabeling({ row: r, what: "category" }), []);
  const onDestinatario = useCallback((r: MovimientoRow) => setLabeling({ row: r, what: "destinatario" }), []);
  const pickCategory = useCallback(async (r: MovimientoRow, categoryId: string | null) => {
    setLabeling(null);
    if (!(await run("setTransactionCategory", { transactionId: r.id, categoryId }))) return;
    const d = r.destinatario && data?.destinatarios.find((x) => x.id === r.destinatario!.id);
    const cat = categoryById(categoryId);
    if (!d || !cat || d.defaultCategoryId === cat.id) return;
    if (!d.defaultCategoryId) {
      // The first time: learn it without asking (a toast that vanishes would lose the rule).
      // applyToPast only fills movements without a hand-picked category.
      if (!(await run("setDestinatarioCategory", { destinatarioId: d.id, categoryId: cat.id, applyToPast: true }))) return;
      setToast({
        message: `Desde ahora, ${d.name} es ${cat.name}`,
        undo: () => void run("setDestinatarioCategory", { destinatarioId: d.id, categoryId: null }),
      });
    } else {
      // It already had another one: this may be a one-off, so ask.
      setToast({
        message: `¿Siempre ${cat.name} para ${d.name}?`,
        action: { label: "Sí", onPress: () => void run("setDestinatarioCategory", { destinatarioId: d.id, categoryId: cat.id, applyToPast: true }) },
      });
    }
  }, [run, data]);
  const pickDestinatario = useCallback(async (r: MovimientoRow, id: string) => {
    setLabeling(null);
    await run("setTransactionDestinatario", { transactionId: r.id, destinatarioId: id, remember: true });
  }, [run]);
  const createDestinatario = useCallback(async (r: MovimientoRow, name: string, kind: "merchant" | "person") => {
    setLabeling(null);
    const destinatarioId = Crypto.randomUUID().toLowerCase();
    const pattern = r.description ? patternFrom(r.description) : null;
    if (!(await run("createDestinatario", { destinatarioId, name, kind, pattern }))) return;
    await run("setTransactionDestinatario", { transactionId: r.id, destinatarioId, remember: false });
  }, [run]);

  // "No es un movimiento": a manual entry is deleted, a bank one ignored — both with Deshacer.
  const notAMovement = useCallback(async () => {
    const tx = openId ? data?.transactions.find((x) => x.id === openId) : undefined;
    if (!tx || !detalle) return;
    setOpenId(null);
    setOpenRow(null); // the row may be gone: nothing stays open (or dims the rest)
    if (detalle.manual) {
      if (!(await run("deleteTransaction", { transactionId: tx.id } satisfies DeleteTransactionPayload))) return;
      // A clock that moved back since the capture must not make Deshacer fail.
      const capturedAt = tx.createdAt && tx.createdAt < new Date().toISOString() ? tx.createdAt : undefined;
      setToast({
        message: `Borrado · ${detalle.title} ${detalle.amount}`,
        undo: () => void run("captureManualTransaction", {
          transactionId: tx.id, accountId: tx.accountId, amount: tx.amount, direction: tx.direction,
          currencyCode: tx.currencyCode, date: tx.date, description: tx.description?.trim() || detalle.title,
          notes: tx.notes ?? null, ...(capturedAt ? { capturedAt } : {}),
        } satisfies CaptureManualTransactionPayload),
      });
    } else {
      if (!(await run("setTransactionExcluded", { transactionId: tx.id, excluded: true } satisfies SetTransactionExcludedPayload))) return;
      setToast({
        message: `Ignorado · ${detalle.title}`,
        undo: () => void run("setTransactionExcluded", { transactionId: tx.id, excluded: false } satisfies SetTransactionExcludedPayload),
      });
    }
  }, [openId, data, detalle, run]);

  const onRow = useCallback((id: string) => setOpenId(id), []);
  const onToggle = useCallback((id: string) => setOpenRow((o) => (o === id ? null : id)), []);
  useEffect(() => setOpenRow(null), [index, filter, search]);
  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/inicio" as never)), [router]);
  const tone = useMemo(() => toneColors(t), [t]);

  if (needsFirstRun) {
    return (
      <EmptyState title="Movimientos" message="Responde las tres preguntas de Inicio y aquí vas a ver lo que gastas y lo que te entra.">
        <Button label="Ir a Inicio" variant="secondary" size="M" onPress={() => router.navigate("/inicio" as never)} />
      </EmptyState>
    );
  }

  if (!view) {
    return (
      <View style={[styles.center, { backgroundColor: t.colors.bg, paddingTop: insets.top + 24 }]}>
        {error ? (
          <>
            <Text style={{ color: t.colors.bad.text, fontFamily: t.fonts.uiMedium, textAlign: "center" }} accessibilityRole="alert">{error}</Text>
            <Button label="Volver" variant="secondary" size="M" onPress={back} />
          </>
        ) : <ActivityIndicator color={t.colors.ink} accessibilityLabel="Cargando" />}
      </View>
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} accessibilityRole="header">Movimientos</Text>
        <IconButton
          onPress={() => { setSearching((s) => !s); setQuery(""); }}
          label={searching ? "Cerrar búsqueda" : "Buscar"}
          icon={searching ? <X size={16} color={t.colors.ink} strokeWidth={2.2} /> : <Search size={17} color={t.colors.ink} strokeWidth={2} />}
        />
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
        {view.account && (
          <Chip label={`${view.account.label}  ✕`} on onPress={() => router.setParams({ account: undefined })} accessibilityLabel={`Solo ${view.account.label}. Quitar filtro`} />
        )}
        {view.filters.map((f) => <Chip key={f.key} label={f.label} on={f.on} onPress={() => setFilter(f.key)} />)}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <FlatList
        data={view.groups}
        keyExtractor={(g) => g.date}
        renderItem={({ item }) => <DayGroup group={item} tone={tone} openRow={openRow} onToggle={onToggle} onMore={onRow} onCategory={onCategory} onDestinatario={onDestinatario} />}
        extraData={openRow}
        ListHeaderComponent={header}
        ListEmptyComponent={view.empty ? <Text style={[styles.empty, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>{view.empty}</Text> : null}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40, paddingHorizontal: 16, gap: 14 }}
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
        action={toast?.action ?? (toast?.undo ? { label: "Deshacer", onPress: toast.undo } : undefined)}
        onHide={() => setToast(null)}
      />
      <CategorySheet
        open={labeling?.what === "category"}
        direction={labeling?.row.direction ?? "OUTFLOW"}
        current={labeling?.row.categoryId ?? null}
        onPick={(id) => labeling && void pickCategory(labeling.row, id)}
        onClose={() => setLabeling(null)}
      />
      <DestinatarioSheet
        open={labeling?.what === "destinatario"}
        options={data?.destinatarios ?? []}
        suggestedKind={labeling?.row.destinatario?.kind ?? (/transf|nequi|daviplata|bre-?b/i.test(labeling?.row.description ?? "") ? "person" : "merchant")}
        text={labeling?.row.description ? patternFrom(labeling.row.description) : ""}
        current={labeling?.row.destinatario?.id ?? null}
        onPick={(id) => labeling && void pickDestinatario(labeling.row, id)}
        onCreate={(name, kind) => labeling && void createDestinatario(labeling.row, name, kind)}
        onClose={() => setLabeling(null)}
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
  && a.status === b.status && a.time === b.time && a.account === b.account
  && a.categoryId === b.categoryId && a.destinatario?.id === b.destinatario?.id;

type LabelHandler = (r: MovimientoRow) => void;
const DayGroup = memo(function DayGroup({ group, tone, openRow, onToggle, onMore, onCategory, onDestinatario }: {
  group: MovimientosGroup; tone: ToneColors; openRow: string | null; onToggle: (id: string) => void; onMore: (id: string) => void;
  onCategory: LabelHandler; onDestinatario: LabelHandler;
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
            onToggle={onToggle} onMore={onMore} onCategory={onCategory} onDestinatario={onDestinatario}
          />
        ))}
      </View>
    </View>
  );
}, (p, n) => p.tone === n.tone && p.openRow === n.openRow && p.onToggle === n.onToggle && p.onMore === n.onMore
  && p.onCategory === n.onCategory && p.onDestinatario === n.onDestinatario && p.group.label === n.group.label && p.group.total === n.group.total
  && p.group.rows.length === n.group.rows.length && p.group.rows.every((r, i) => sameRow(r, n.group.rows[i])));

/**
 * A movement. A tap opens it in place (S8-3): in M1 only ⋯ (Detalle), already in
 * its final spot on the right; Categoría and Destinatario join it in M3.
 */
const Row = memo(function Row({ row: r, color, last, open, dimmed, onToggle, onMore, onCategory, onDestinatario }: {
  row: MovimientoRow; color: string; last: boolean; open: boolean; dimmed: boolean;
  onToggle: (id: string) => void; onMore: (id: string) => void; onCategory: LabelHandler; onDestinatario: LabelHandler;
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
      <Avatar name={r.title} kind={r.destinatario ? (r.destinatario.kind === "person" ? "persona" : "comercio") : "none"} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: t.colors.ink, fontFamily: t.fonts.uiMedium }]} numberOfLines={1}>{r.title}</Text>
          <Text style={[styles.rowAmount, { color, fontFamily: t.fonts.numberSemibold }]}>{r.amount}</Text>
        </View>
        <View style={styles.rowMeta}>
          {!r.status && r.category && (
            <View style={[styles.tag, { backgroundColor: t.colors.sunk }]}>
              <Text style={[styles.tagText, { color: t.colors.ink, fontFamily: t.fonts.uiMedium }]} numberOfLines={1}>{r.category}</Text>
            </View>
          )}
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
        <Button size="M" variant="secondary" label={r.category ?? "Categoría"} onPress={() => onCategory(r)}
          accessibilityLabel={r.category ? `Categoría: ${r.category}. Cambiar` : "Elegir categoría"} style={{ flexShrink: 1 }} />
        <Button size="M" variant="secondary" label={r.destinatario?.name ?? "¿Quién?"} onPress={() => onDestinatario(r)}
          accessibilityLabel={r.destinatario ? `Destinatario: ${r.destinatario.name}. Cambiar` : "Elegir destinatario"} style={{ flexShrink: 1 }} />
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
  && p.onCategory === n.onCategory && p.onDestinatario === n.onDestinatario
  && p.dimmed === n.dimmed && p.onToggle === n.onToggle && p.onMore === n.onMore);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  headerBlock: { gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  title: { flex: 1, fontSize: 26, letterSpacing: -0.5 },
  search: { height: 46, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  cycle: { height: 46, borderRadius: 14, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chev: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  filters: { gap: 6 },
  empty: { fontSize: 14, textAlign: "center", paddingVertical: 24 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6 },
  dayText: { fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase" },
  card: { borderRadius: 18, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 12 },
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
