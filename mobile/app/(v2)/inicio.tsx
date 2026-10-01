import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Lock, Plus } from "lucide-react-native";
import {
  applyInicioLayout, headerDate, layoutOf, WIDGET_SIZES,
  type DetailPartKey, type InicioLayout, type InicioState, type InicioWidgetKey, type SetCycleSettingsPayload, type WidgetActionId,
} from "@zeta/shared";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { loadInicio, saveInicioLayout } from "../../lib/v2/inicio/load";
import { useV2UserId } from "../../lib/v2/user";
import { useAppStore } from "../../lib/store";
import { toColombiaDateString } from "../../lib/utils/date";
import { DisponibleBlock } from "../../v2/components/DisponibleBlock";
import { DisponibleDetail } from "../../v2/components/DisponibleDetail";
import { FirstRunQuestions } from "../../v2/components/FirstRunQuestions";
import { InicioHeader } from "../../v2/components/InicioHeader";
import { AddWidgetSheet } from "../../v2/components/widgets/AddWidgetSheet";
import { InicioWidgetGrid, type GridEditing } from "../../v2/components/widgets/InicioWidgetGrid";
import { useV2Theme } from "../../v2/theme/ThemeProvider";

/**
 * Where a widget action goes. Until the v2 screens exist, the v1 ones
 * (they write to the v1 data, which reaches v2 with M2's sync).
 */
const ACTION_ROUTES: Record<WidgetActionId, string> = {
  capture: "/capture",
  add_bill: "/recurrentes/new",
  import_statement: "/import",
  split_purchase: "/personas",
  lend: "/personas",
  add_card: "/account/create",
  see_movements: "/transactions",
  see_bills: "/recurrentes",
  see_people: "/personas",
  see_accounts: "/accounts-list",
};
const DETAIL_ROUTES: Partial<Record<DetailPartKey, string>> = { porPagar: "/recurrentes", gastado: "/transactions" };

/**
 * v2 Inicio (M1, Claude Design "Z Inicio"): greeting, the Disponible block
 * (tap: how it comes out), the widget grid with its alerts and Organizar.
 * The first-run questions until they're answered. Reloads whenever the
 * screen comes back into focus, so a movement captured elsewhere shows at once.
 */
export default function InicioScreen() {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useV2UserId();
  const fullName = useAppStore((s) => s.profile?.full_name ?? null);
  const [state, setState] = useState<InicioState | null>(null);
  const [autoOpen, setAutoOpen] = useState<string | null>(null);
  const [layout, setLayout] = useState<InicioLayout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [draft, setDraft] = useState<InicioLayout | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const editing = draft !== null;

  // Only the latest load may land (focus, answer and user changes can overlap), and
  // an unchanged result keeps the old objects so memoized widgets don't redraw.
  const request = useRef(0);
  const lastJson = useRef("");
  useEffect(() => () => void request.current++, []);

  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const loaded = await loadInicio(userId);
      if (id !== request.current) return;
      const json = JSON.stringify(loaded.state);
      if (json !== lastJson.current) {
        lastJson.current = json;
        setState(loaded.state);
      }
      setLayout((prev) => (JSON.stringify(prev) === JSON.stringify(loaded.layout) ? prev : loaded.layout));
      if (loaded.autoOpen) setAutoOpen(loaded.autoOpen);
      setError(null);
    } catch (e) {
      if (id !== request.current) return;
      console.warn("[v2 inicio] load failed", e);
      setError("No pudimos cargar tu número. Intenta de nuevo.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const answer = useCallback(
    async (payload: SetCycleSettingsPayload) => {
      const { result } = await runLocalCommand({ type: "setCycleSettings", userId, payload });
      if (result.status === "rejected") return result.error ?? "No se pudo guardar.";
      await reload();
      return null;
    },
    [userId, reload],
  );

  const ready = state?.status === "ready" ? state : null;
  const widgets = useMemo(
    () => (ready ? applyInicioLayout(ready.widgets, draft ?? layout) : []),
    [ready, draft, layout],
  );
  const hiddenWidgets = useMemo(() => {
    const hidden = new Set((draft ?? layout)?.hidden ?? []);
    return ready ? ready.widgets.filter((w) => hidden.has(w.id)) : [];
  }, [ready, draft, layout]);

  const onAction = useCallback((id: WidgetActionId) => router.push(ACTION_ROUTES[id] as never), [router]);
  const onSeeAll = useCallback((key: DetailPartKey) => {
    const route = DETAIL_ROUTES[key];
    if (route) router.push(route as never);
  }, [router]);
  const toggleDetail = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetailOpen((o) => !o);
  }, []);
  const voice = useCallback(() => Alert.alert("Pronto", "Anotar con la voz llega en una próxima versión."), []);

  // ── Organizar ──
  const startOrganizing = useCallback(() => {
    setDetailOpen(false);
    setDraft(layoutOf(widgets, layout?.hidden ?? []));
  }, [widgets, layout]);
  const finishOrganizing = useCallback(() => {
    if (draft) {
      setLayout(draft);
      void saveInicioLayout(userId, draft).catch((e) => console.warn("[v2 inicio] layout not saved", e));
    }
    setDraft(null);
    setAdding(false);
  }, [draft, userId]);
  const editingHandlers = useMemo<GridEditing | null>(() => {
    if (!draft) return null;
    const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    return {
      onMove: (id, targetId) => {
        animate();
        setDraft((d) => {
          if (!d) return d;
          const items = d.items.filter((x) => x.id !== id);
          const moved = d.items.find((x) => x.id === id);
          const at = items.findIndex((x) => x.id === targetId);
          if (!moved || at < 0) return d;
          // Dropped on a later widget: land after it; on an earlier one: before it.
          const from = d.items.findIndex((x) => x.id === id);
          items.splice(from <= at ? at + 1 : at, 0, moved);
          return { ...d, items };
        });
      },
      onResize: (id, size) => {
        animate();
        setDraft((d) => d && { ...d, items: d.items.map((x) => (x.id === id ? { ...x, size } : x)) });
      },
      onRemove: (id) => {
        animate();
        setDraft((d) => d && { items: d.items.filter((x) => x.id !== id), hidden: [...d.hidden, id] });
      },
      onDragging: setDragging,
    };
  }, [draft]);
  const addWidget = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const key = id.split(":")[0] as InicioWidgetKey;
    setDraft((d) => d && { items: [...d.items, { id, size: WIDGET_SIZES[key][0] }], hidden: d.hidden.filter((h) => h !== id) });
  }, []);

  const firstName = fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <InicioHeader
          name={firstName}
          date={headerDate(toColombiaDateString())}
          editing={editing}
          onOrganize={ready ? startOrganizing : undefined}
          onDone={finishOrganizing}
          onVoice={voice}
        />

        {error && (
          <Text style={[styles.error, { color: t.colors.bad.text, fontFamily: t.fonts.uiMedium }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        {!state && !error && <ActivityIndicator color={t.colors.ink} accessibilityLabel="Cargando" />}
        {state?.status === "needs_setup" && <FirstRunQuestions onSubmit={answer} />}
        {ready && (
          <>
            <View>
              <DisponibleBlock view={ready.view} open={detailOpen} onToggle={editing ? undefined : toggleDetail} dimmed={editing} />
              {editing && (
                <View style={[styles.fixed, { backgroundColor: t.colors.card }]} accessibilityLabel="Fijo">
                  <Lock size={12} color={t.colors.muted} />
                  <Text style={{ color: t.colors.muted, fontFamily: t.fonts.uiSemibold, fontSize: 11 }}>Fijo</Text>
                </View>
              )}
            </View>
            {detailOpen && !editing && <DisponibleDetail detail={ready.detail} onSeeAll={onSeeAll} />}
            <InicioWidgetGrid widgets={widgets} autoOpen={editing ? null : autoOpen} onAction={onAction} editing={editingHandlers} />
            {editing && (
              <Pressable
                onPress={() => setAdding(true)}
                accessibilityRole="button"
                style={[styles.addButton, { borderColor: t.colors.control }]}
              >
                <Plus size={18} color={t.colors.ink} />
                <Text style={{ color: t.colors.ink, fontFamily: t.fonts.uiSemibold, fontSize: 15 }}>Agregar widget</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
      <AddWidgetSheet visible={adding} hidden={hiddenWidgets} onAdd={addWidget} onClose={() => setAdding(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 14 },
  fixed: { position: "absolute", top: 12, right: 12, height: 24, paddingHorizontal: 9, borderRadius: 7, flexDirection: "row", alignItems: "center", gap: 4 },
  addButton: { height: 48, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
