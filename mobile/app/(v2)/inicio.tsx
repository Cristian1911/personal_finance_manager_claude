import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  LinearTransition, scrollTo, useAnimatedReaction, useAnimatedRef, useSharedValue, withTiming,
} from "react-native-reanimated";
import { Lock, Plus } from "lucide-react-native";
import {
  applyInicioLayout, headerDate, layoutOf, WIDGET_SIZES,
  setupLevelLabel,
  type DetailPartKey, type InicioLayout, type InicioState, type InicioWidgetKey, type CommandType, type SetupProgress, type SetupTaskId, type WidgetActionId,
} from "@zeta/shared";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { declineSetupTask, loadInicio, markHoyGuideSeen, saveInicioLayout } from "../../lib/v2/inicio/load";
import { useV2UserId } from "../../lib/v2/user";
import { useAuth } from "../../lib/auth";
import { openAnotar } from "../../lib/v2/anotar/open";
import { FAB_OVERHANG } from "../../v2/components/TabBar";
import { toColombiaDateString } from "../../lib/utils/date";
import { DisponibleBlock } from "../../v2/components/DisponibleBlock";
import { DisponibleDetail } from "../../v2/components/DisponibleDetail";
import { COLLAPSE_EASING, Collapse, useMotionMs } from "../../v2/components/Collapse";
import { Dim } from "../../v2/components/Dim";
import { Onboarding } from "../../v2/components/Onboarding";
import { PrecisionSheet, SetupCard } from "../../v2/components/SetupCard";
import { InicioHeader } from "../../v2/components/InicioHeader";
import { AddWidgetSheet } from "../../v2/components/widgets/AddWidgetSheet";
import { InicioWidgetGrid, type GridEditing } from "../../v2/components/widgets/InicioWidgetGrid";
import { useV2Theme } from "../../v2/theme/ThemeProvider";
import { notifyV2Change, useV2Changes } from "../../lib/v2/changes";

/**
 * Where a widget action goes. "pronto": no v2 screen yet (Te deben) — v1's
 * screens write v1's data, so they're never opened from v2.
 */
const ACTION_ROUTES: Record<WidgetActionId, string> = {
  capture: "anotar",
  add_bill: "/pagos?add=1",
  import_statement: "/cuentas?add=extracto",
  split_purchase: "pronto",
  lend: "pronto",
  add_card: "/cuentas?add=tarjeta",
  see_movements: "/movimientos",
  see_bills: "/pagos",
  see_people: "pronto",
  see_accounts: "/cuentas",
  see_flow: "/flujo",
};
const DETAIL_ROUTES: Partial<Record<DetailPartKey, string>> = { porPagar: "/pagos", gastado: "/movimientos" };
/** Where each "Afina tu número" task is done (S10-4). */
const SETUP_ROUTES: Record<SetupTaskId, string> = {
  basics: "/ajustes",
  statement: "/cuentas?add=extracto",
  bills: "/pagos?add=1",
  cards: "/cuentas?add=tarjeta",
  capture: "/correos",
};

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
  // The sign-in provider's name (Google/Apple fill it; email sign-ups have none yet).
  const meta = useAuth().session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const fullName = meta?.full_name ?? meta?.name ?? null;
  const [state, setState] = useState<InicioState | null>(null);
  /** The one view open on Inicio: a widget's id, or the Disponible detail. */
  const [openWidget, setOpenWidget] = useState<string | null>(null);
  const [layout, setLayout] = useState<InicioLayout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [setup, setSetup] = useState<SetupProgress | null>(null);
  const [pendingBills, setPendingBills] = useState<string[]>([]);
  const [guideSeen, setGuideSeen] = useState(true);
  const [tourSeen, setTourSeen] = useState(false);
  const [precisionOpen, setPrecisionOpen] = useState(false);
  // Leaving the tab closes what was open: coming back shows Inicio as it is, not a half-open card.
  useFocusEffect(useCallback(() => () => { setOpenWidget(null); setDetailOpen(false); }, []));
  const [draft, setDraft] = useState<InicioLayout | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const editing = draft !== null;

  // Scroll an opened view into sight, in step with its height animation (same
  // duration and easing as Collapse), so it slides into place instead of jumping.
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useRef(0);
  const gridY = useRef(0);
  const detailY = useRef(0);
  const blockY = useRef(0);
  const scrollFrom = useSharedValue(0);
  const scrollTarget = useSharedValue(0);
  const scrollStep = useSharedValue(1);
  useAnimatedReaction(
    () => scrollStep.value,
    (p, prev) => {
      if (prev !== null && p !== prev) scrollTo(scroll, 0, scrollFrom.value + (scrollTarget.value - scrollFrom.value) * p, false);
    },
  );
  // The scroll view's own height: it ends at the tab bar, not the screen's bottom.
  const viewH = useRef(0);
  const motionMs = useMotionMs();
  const reveal = useCallback((top: number, bottom: number) => {
    const margin = 16;
    const viewTop = scrollY.current + insets.top;
    const viewBottom = scrollY.current + viewH.current - FAB_OVERHANG;
    let to: number | null = null;
    // Too low: lift it so it ends on screen, never past its own top.
    if (bottom > viewBottom - margin) to = Math.min(top - insets.top - margin, bottom - viewH.current + FAB_OVERHANG + margin);
    // Too high (scrolled past it): bring its top down.
    else if (top < viewTop + margin) to = top - insets.top - margin;
    if (to === null) return;
    scrollFrom.value = scrollY.current;
    scrollTarget.value = Math.max(0, to);
    scrollStep.value = 0;
    scrollStep.value = withTiming(1, { duration: motionMs, easing: COLLAPSE_EASING });
  }, [insets.top, scrollFrom, scrollTarget, scrollStep, motionMs]);
  // A widget opening while the detail closes: everything below moves up by the
  // detail's height during the same animation, so aim where it will end.
  const detailH = useRef(0);
  const closingShift = useRef(0);
  const revealInGrid = useCallback((top: number, bottom: number) => {
    const shift = closingShift.current;
    closingShift.current = 0;
    reveal(gridY.current + top - shift, gridY.current + bottom - shift);
  }, [reveal]);

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
      setSetup((prev) => (JSON.stringify(prev) === JSON.stringify(loaded.setup) ? prev : loaded.setup));
      setPendingBills((prev) => (prev.join("\n") === loaded.pendingBills.join("\n") ? prev : loaded.pendingBills));
      setGuideSeen(loaded.guideSeen);
      setTourSeen(loaded.tourSeen);
      if (loaded.autoOpen) setOpenWidget(loaded.autoOpen);
      setError(null);
    } catch (e) {
      if (id !== request.current) return;
      console.warn("[v2 inicio] load failed", e);
      setError("No pudimos cargar tu número. Intenta de nuevo.");
    }
  }, [userId]);

  // Anotar and Deshacer change the data without moving focus.
  useV2Changes(() => void reload());
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const runFirst = useCallback(async (type: CommandType, payload: unknown) => {
    try {
      const { result } = await runLocalCommand({ type, userId, payload });
      return result.status === "rejected" ? result.error ?? "No se pudo guardar." : null;
    } catch (e) {
      console.warn("[v2 inicio] first run failed", e);
      return "No se pudo guardar. Intenta de nuevo.";
    }
  }, [userId]);

  const ready = state?.status === "ready" ? state : null;
  const widgets = useMemo(
    () => (ready ? applyInicioLayout(ready.widgets, draft ?? layout) : []),
    [ready, draft, layout],
  );
  const hiddenWidgets = useMemo(() => {
    const hidden = new Set((draft ?? layout)?.hidden ?? []);
    return ready ? ready.widgets.filter((w) => hidden.has(w.id)) : [];
  }, [ready, draft, layout]);

  const onAction = useCallback((id: WidgetActionId) => {
    const route = ACTION_ROUTES[id];
    if (route === "anotar") openAnotar();
    else if (route === "pronto") Alert.alert("Muy pronto", "Te deben y dividir compras llegan en la próxima versión de Zeta.");
    else router.push(route as never);
  }, [router]);
  const onSeeAll = useCallback((key: DetailPartKey) => {
    const route = DETAIL_ROUTES[key];
    if (route) router.push(route as never);
  }, [router]);
  // One open view at a time: tapping the number while a widget is open just closes it.
  const toggleDetail = useCallback(() => {
    if (openWidget) setOpenWidget(null);
    else setDetailOpen((o) => !o);
  }, [openWidget]);
  const onOpenWidget = useCallback((id: string | null) => {
    setOpenWidget(id);
    if (id && detailOpen) {
      closingShift.current = detailH.current;
      setDetailOpen(false);
    }
  }, [detailOpen]);
  const onSetupTask = useCallback((id: SetupTaskId) => {
    // A fixed payment left without amount comes back with its name already written.
    const route = id === "bills" && pendingBills[0] ? `/pagos?add=1&name=${encodeURIComponent(pendingBills[0])}` : SETUP_ROUTES[id];
    router.push(route as never);
  }, [router, pendingBills]);
  const onSetupDecline = useCallback((id: SetupTaskId) => {
    if (id !== "cards" && id !== "bills") return;
    void declineSetupTask(userId, id).then(reload).catch((e) => console.warn("[v2 inicio] decline not saved", e));
  }, [userId, reload]);
  const closeGuide = useCallback(() => {
    setGuideSeen(true);
    void markHoyGuideSeen(userId).catch((e) => console.warn("[v2 inicio] guide not saved", e));
  }, [userId]);
  const precision = useMemo(
    () => (setup && setup.percent < 100 ? { label: setupLevelLabel(setup.level), percent: setup.percent, real: setup.level === "real" } : null),
    [setup],
  );
  const openPrecision = useCallback(() => setPrecisionOpen(true), []);

  // The Inicio mic leads to Anotar › Dictar (S8-1).
  const voice = useCallback(() => openAnotar({ dictar: true }), []);

  // ── Organizar ──
  const startOrganizing = useCallback(() => {
    setDetailOpen(false);
    setOpenWidget(null);
    setDraft(layoutOf(widgets, layout?.hidden ?? []));
  }, [widgets, layout]);
  const finishOrganizing = useCallback(() => {
    // A load already in flight read the old layout: let it go.
    request.current++;
    if (draft) {
      setLayout(draft);
      void saveInicioLayout(userId, draft).catch((e) => console.warn("[v2 inicio] layout not saved", e));
    }
    setDraft(null);
    setAdding(false);
  }, [draft, userId]);
  const editingHandlers = useMemo<GridEditing | null>(() => {
    if (!draft) return null;
    return {
      onMove: (id, targetId) => {
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
        setDraft((d) => d && { ...d, items: d.items.map((x) => (x.id === id ? { ...x, size } : x)) });
      },
      onRemove: (id) => {
        setDraft((d) => d && { items: d.items.filter((x) => x.id !== id), hidden: [...d.hidden, id] });
      },
      onDragging: setDragging,
    };
  }, [draft]);
  const addWidget = useCallback((id: string) => {
    const key = id.split(":")[0] as InicioWidgetKey;
    setDraft((d) => d && { items: [...d.items, { id, size: WIDGET_SIZES[key][0] }], hidden: d.hidden.filter((h) => h !== id) });
  }, []);

  const firstName = fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <Animated.ScrollView
        ref={scroll}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; }}
        scrollEventThrottle={16}
        scrollEnabled={!dragging}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40, paddingHorizontal: 16, gap: 12 }}
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
          onProfile={() => router.push("/ajustes" as never)}
          initials={(fullName ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("")}
        />

        {error && (
          <Text style={[styles.error, { color: t.colors.bad.text, fontFamily: t.fonts.uiMedium }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        {!state && !error && <ActivityIndicator color={t.colors.ink} accessibilityLabel="Cargando" />}
        {state?.status === "needs_setup" && (
          <Onboarding run={runFirst} userId={userId} tourSeen={tourSeen} onDone={() => { notifyV2Change(); void reload(); }} />
        )}
        {ready && (
          <>
            {!guideSeen && !editing && (
              <View style={[styles.guide, { backgroundColor: t.colors.button }]} accessibilityRole="summary">
                <Text style={{ fontSize: 11, letterSpacing: 0.5, color: t.colors.onButton, opacity: 0.8, fontFamily: t.fonts.mono }}>PRIMERA VEZ EN HOY</Text>
                <Text style={{ fontSize: 17, color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }}>Este es tu Disponible</Text>
                <Text style={{ fontSize: 14, lineHeight: 20, color: t.colors.onButton, opacity: 0.9, fontFamily: t.fonts.ui }}>
                  Lo que puedes gastar hasta tu próximo sueldo. El ≈ y los puntos dicen qué tan exacto es; “Afina tu número” lo vuelve real.
                </Text>
                <Pressable onPress={closeGuide} accessibilityRole="button" style={[styles.guideButton, { backgroundColor: t.colors.card }]}>
                  <Text style={{ fontSize: 14, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>Entendido</Text>
                </Pressable>
              </View>
            )}
            {/* The number and how it comes out: one block, so a closed detail leaves no gap. */}
            <View onLayout={(e) => { blockY.current = e.nativeEvent.layout.y; }}>
              <Dim on={!!openWidget && !editing}>
                <DisponibleBlock
                  view={ready.view} open={detailOpen} onToggle={editing ? undefined : toggleDetail} dimmed={editing}
                  precision={precision} onPrecision={editing ? undefined : openPrecision}
                />
                {editing && (
                  <View style={[styles.fixed, { backgroundColor: t.colors.card }]} accessible accessibilityLabel="Fijo">
                    <Lock size={12} color={t.colors.muted} />
                    <Text style={{ color: t.colors.muted, fontFamily: t.fonts.uiSemibold, fontSize: 11 }}>Fijo</Text>
                  </View>
                )}
              </Dim>
              <View onLayout={(e) => { detailY.current = e.nativeEvent.layout.y; }}>
                <Collapse
                  open={detailOpen && !editing}
                  onHeight={(h) => {
                    detailH.current = h;
                    const top = blockY.current + detailY.current;
                    reveal(top, top + h);
                  }}
                >
                  <View style={styles.detailGap}>
                    <DisponibleDetail detail={ready.detail} onSeeAll={onSeeAll} />
                  </View>
                </Collapse>
              </View>
            </View>
            {setup && setup.percent < 100 && !editing && (
              <Dim on={(!!openWidget || detailOpen) && !editing}>
                <SetupCard setup={setup} onTask={onSetupTask} onDecline={onSetupDecline} />
              </Dim>
            )}
            <Animated.View layout={editing && motionMs ? LinearTransition.duration(240) : undefined} onLayout={(e) => { gridY.current = e.nativeEvent.layout.y; }}>
              <InicioWidgetGrid
                widgets={widgets}
                open={editing ? null : openWidget}
                onOpenChange={onOpenWidget}
                onReveal={revealInGrid}
                dimAll={detailOpen && !editing}
                onAction={onAction}
                editing={editingHandlers}
              />
            </Animated.View>
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
      </Animated.ScrollView>
      <AddWidgetSheet visible={adding} hidden={hiddenWidgets} onAdd={addWidget} onClose={() => setAdding(false)} />
      {setup && <PrecisionSheet setup={setup} open={precisionOpen} onClose={() => setPrecisionOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 14 },
  detailGap: { paddingTop: 12 },
  fixed: { position: "absolute", top: 12, right: 12, height: 24, paddingHorizontal: 9, borderRadius: 7, flexDirection: "row", alignItems: "center", gap: 4 },
  guide: { borderRadius: 18, padding: 16, gap: 6 },
  guideButton: { alignSelf: "flex-end", height: 40, paddingHorizontal: 16, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 4 },
  addButton: { height: 48, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
