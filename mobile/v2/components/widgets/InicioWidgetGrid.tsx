import { Fragment, memo, useCallback, useMemo, useRef, useState } from "react";
import { Animated as RNAnimated, PanResponder, Pressable, StyleSheet, Text, View, type LayoutRectangle } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { Collapse, useMotionMs } from "../Collapse";
import { Grip, X } from "lucide-react-native";
import { WIDGET_SIZES, type InicioWidget, type InicioWidgetKey, type InicioWidgetSize, type WidgetActionId } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";
import { WidgetCard, WidgetPanel } from "./WidgetCard";

/** Full widgets take a row; half widgets pair up in layout order (13 §Layout). */
function packRows(widgets: InicioWidget[]): InicioWidget[][] {
  const rows: InicioWidget[][] = [];
  let pending: InicioWidget | null = null;
  for (const w of widgets) {
    if (w.size === "full") {
      if (pending) rows.push([pending]);
      pending = null;
      rows.push([w]);
    } else if (pending) {
      rows.push([pending, w]);
      pending = null;
    } else {
      pending = w;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}

export interface GridEditing {
  /** Move `id` to where `targetId` is. */
  onMove: (id: string, targetId: string) => void;
  onResize: (id: string, size: InicioWidgetSize) => void;
  onRemove: (id: string) => void;
  /** True while a widget is being dragged (the screen stops scrolling). */
  onDragging: (active: boolean) => void;
}

/**
 * Inicio's 2-column widget grid. One widget open at a time (the screen holds
 * which): a half widget opens a full-width panel under its row, a full widget
 * opens in place; everything else fades so the open one has the focus, and
 * `onReveal` reports where the open block sits so the screen can scroll it
 * into view. With `editing` (Organizar) each widget shows a drag handle, its
 * size and a remove button instead of opening.
 */
export const InicioWidgetGrid = memo(function InicioWidgetGrid({
  widgets,
  open,
  onOpenChange,
  onReveal,
  dimAll = false,
  onAction,
  editing,
}: {
  widgets: InicioWidget[];
  open: string | null;
  onOpenChange: (id: string | null) => void;
  /** Top and bottom (grid coordinates) of the open widget plus its panel. */
  onReveal?: (top: number, bottom: number) => void;
  /** Something outside the grid is open: fade every widget. */
  dimAll?: boolean;
  onAction?: (id: WidgetActionId) => void;
  editing?: GridEditing | null;
}) {
  const motionMs = useMotionMs();
  // Read through a ref so `toggle` stays the same function and memoized cards don't redraw.
  const openRef = useRef(open);
  openRef.current = open;
  const toggle = useCallback((id: string) => onOpenChange(openRef.current === id ? null : id), [onOpenChange]);
  const close = useCallback(() => onOpenChange(null), [onOpenChange]);
  const rows = useMemo(() => packRows(widgets), [widgets]);

  // Where each widget sits in the grid, for dropping a dragged one and revealing the open one.
  const rowY = useRef(new Map<string, number>());
  const rowBox = useRef(new Map<string, { y: number; height: number }>());
  /** Each widget's closed height, to know where an opening one will end. */
  const closedH = useRef(new Map<string, number>());
  const cells = useRef(new Map<string, LayoutRectangle>());
  const [dragging, setDragging] = useState<string | null>(null);
  const ids = useRef<string[]>([]);
  ids.current = widgets.map((w) => w.id);
  const dropTarget = useCallback((id: string, dx: number, dy: number): string | null => {
    const from = cells.current.get(id);
    // Barely moved: stay put.
    if (!from || Math.hypot(dx, dy) < 24) return null;
    const cx = from.x + from.width / 2 + dx;
    const cy = from.y + from.height / 2 + dy;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const [other, r] of cells.current) {
      if (other === id || !ids.current.includes(other)) continue;
      const inside = cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height;
      const dist = inside ? -1 : Math.hypot(cx - (r.x + r.width / 2), cy - (r.y + r.height / 2));
      if (dist < bestDist) { bestDist = dist; best = other; }
    }
    return best;
  }, []);

  const openWidget = open ? widgets.find((w) => w.id === open) ?? null : null;

  return (
    <View style={styles.grid}>
      {rows.map((row) => {
        const rowKey = row.map((w) => w.id).join("+");
        const openHalf = !editing ? row.find((w) => w.size === "half" && w.id === open) ?? null : null;
        const openFull = !editing && row.length === 1 && row[0].size === "full" && row[0].id === open;
        return (
          <Fragment key={rowKey}>
            <Animated.View
              layout={editing && motionMs ? LinearTransition.duration(240) : undefined}
              style={[styles.row, row.some((w) => w.id === dragging) && styles.lifted]}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                for (const w of row) {
                  rowY.current.set(w.id, y);
                  const c = cells.current.get(w.id);
                  if (c) cells.current.set(w.id, { ...c, y });
                }
                rowBox.current.set(rowKey, { y, height });
                if (!openFull) for (const w of row) closedH.current.set(w.id, height);
              }}
            >
              {row.map((w) => (
                <View
                  key={w.id}
                  style={styles.cell}
                  onLayout={(e) => {
                    const l = e.nativeEvent.layout;
                    cells.current.set(w.id, { ...l, y: rowY.current.get(w.id) ?? 0 });
                  }}
                >
                  {editing ? (
                    <EditableCell
                      widget={w}
                      editing={editing}
                      onDrag={setDragging}
                      dropTarget={dropTarget}
                      prevId={ids.current[ids.current.indexOf(w.id) - 1] ?? null}
                      nextId={ids.current[ids.current.indexOf(w.id) + 1] ?? null}
                    />
                  ) : (
                    <WidgetCard
                      widget={w}
                      open={open === w.id}
                      dim={dimAll || (!!openWidget && open !== w.id)}
                      onToggle={toggle}
                      onAction={onAction}
                      onBodyHeight={(h) => {
                        const y = rowBox.current.get(rowKey)?.y ?? 0;
                        if (open === w.id) onReveal?.(y, y + (closedH.current.get(w.id) ?? 0) + h);
                      }}
                    />
                  )}
                </View>
              ))}
              {row.length === 1 && row[0].size === "half" && <View style={styles.cell} />}
            </Animated.View>
            {row.some((w) => w.size === "half") && (
              <HalfPanel
                widget={openHalf}
                onClose={close}
                onAction={onAction}
                onHeight={(top, h) => onReveal?.(rowBox.current.get(rowKey)?.y ?? top, top + h)}
              />
            )}
          </Fragment>
        );
      })}
    </View>
  );
});

/**
 * The panel under a row of half widgets. It keeps showing the last widget
 * while it closes, so the close animates a real height instead of vanishing.
 */
function HalfPanel({
  widget,
  onClose,
  onAction,
  onHeight,
}: {
  widget: InicioWidget | null;
  onClose: () => void;
  onAction?: (id: WidgetActionId) => void;
  onHeight: (top: number, height: number) => void;
}) {
  const last = useRef<InicioWidget | null>(widget);
  if (widget) last.current = widget;
  const top = useRef(0);
  const shown = widget ?? last.current;
  return (
    // The grid's gap lives inside the panel, so a closed panel takes no room at all.
    <View style={styles.panelSlot} onLayout={(e) => { top.current = e.nativeEvent.layout.y; }}>
      <Collapse open={!!widget} onHeight={(h) => { if (widget) onHeight(top.current, h); }}>
        <View style={styles.panelGap}>{shown && <WidgetPanel widget={shown} onClose={onClose} onAction={onAction} />}</View>
      </Collapse>
    </View>
  );
}

const keyOf = (id: string) => id.split(":")[0] as InicioWidgetKey;
const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

const EditableCell = memo(function EditableCell({
  widget: w,
  editing,
  onDrag,
  dropTarget,
  prevId,
  nextId,
}: {
  widget: InicioWidget;
  editing: GridEditing;
  onDrag: (id: string | null) => void;
  dropTarget: (id: string, dx: number, dy: number) => string | null;
  /** Neighbours in order, for moving with a screen reader. */
  prevId: string | null;
  nextId: string | null;
}) {
  const t = useV2Theme();
  const pan = useRef(new RNAnimated.ValueXY()).current;
  const [active, setActive] = useState(false);
  // The responder is created once; it reads the latest callbacks from here.
  const latest = useRef({ editing, onDrag, dropTarget });
  latest.current = { editing, onDrag, dropTarget };

  const responder = useMemo(() => {
    const end = (target: string | null) => {
      // ponytail: snaps to its old slot, then the reorder animates it; a full widget's
      // row keeps its key, so skipping this would leave it offset. Reanimated layout
      // transitions would fix the snap if it bothers on device.
      pan.setValue({ x: 0, y: 0 });
      setActive(false);
      latest.current.onDrag(null);
      latest.current.editing.onDragging(false);
      if (target) latest.current.editing.onMove(w.id, target);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setActive(true);
        latest.current.onDrag(w.id);
        latest.current.editing.onDragging(true);
      },
      onPanResponderMove: RNAnimated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => end(latest.current.dropTarget(w.id, g.dx, g.dy)),
      onPanResponderTerminate: () => end(null),
    });
  }, [pan, w.id]);

  const sizes = WIDGET_SIZES[keyOf(w.id)];
  const nextSize = sizes[(sizes.indexOf(w.size) + 1) % sizes.length];
  const sizeLabel = w.size === "full" ? "Completo" : "½ ancho";

  return (
    <RNAnimated.View style={[styles.editCell, { transform: pan.getTranslateTransform() }, active && styles.dragged]}>
      <View pointerEvents="none" style={styles.editCell} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <WidgetCard widget={w} open={false} dim={false} onToggle={noop} editInset />
      </View>
      <View pointerEvents="none" style={[FILL, styles.dashed, { borderColor: t.colors.control }]} />
      <View
        {...responder.panHandlers}
        style={styles.grip}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Mover ${w.title}`}
        accessibilityActions={[{ name: "decrement", label: "Mover antes" }, { name: "increment", label: "Mover después" }]}
        onAccessibilityAction={(e) => {
          const target = e.nativeEvent.actionName === "decrement" ? prevId : nextId;
          if (target) editing.onMove(w.id, target);
        }}
      >
        <Grip size={18} color={t.colors.muted} />
      </View>
      <View style={styles.editTools}>
        <Pressable
          onPress={() => editing.onResize(w.id, nextSize)}
          disabled={sizes.length < 2}
          accessibilityRole="button"
          accessibilityLabel={`Tamaño de ${w.title}: ${sizeLabel}${sizes.length < 2 ? "" : ". Toca para cambiar"}`}
          hitSlop={10}
          style={[styles.sizeChip, { backgroundColor: t.colors.button, opacity: sizes.length < 2 ? 0.55 : 1 }]}
        >
          <Text style={[styles.sizeText, { color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }]}>{sizeLabel}</Text>
        </Pressable>
        <Pressable
          onPress={() => editing.onRemove(w.id)}
          accessibilityRole="button"
          accessibilityLabel={`Quitar ${w.title}`}
          hitSlop={10}
          style={[styles.remove, { borderColor: t.colors.control, backgroundColor: t.colors.card }]}
        >
          <X size={12} color={t.colors.ink} strokeWidth={2.2} />
        </Pressable>
      </View>
    </RNAnimated.View>
  );
});

const noop = () => undefined;

const styles = StyleSheet.create({
  grid: { gap: 10 },
  panelSlot: { marginTop: -10 },
  panelGap: { paddingTop: 10 },
  row: { flexDirection: "row", gap: 10 },
  lifted: { zIndex: 10, elevation: 10 },
  cell: { flex: 1 },
  editCell: { flex: 1 },
  dragged: { zIndex: 20, elevation: 12, opacity: 0.92 },
  dashed: { borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed" },
  grip: { position: "absolute", top: 0, left: 0, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  editTools: { position: "absolute", top: 7, right: 7, flexDirection: "row", gap: 5 },
  sizeChip: { height: 24, paddingHorizontal: 8, borderRadius: 7, justifyContent: "center" },
  sizeText: { fontSize: 11 },
  remove: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
