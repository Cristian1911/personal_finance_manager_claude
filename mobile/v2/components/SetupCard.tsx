import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, ChevronRight, ChevronUp } from "lucide-react-native";
import { setupLevelLabel, type SetupProgress, type SetupTask, type SetupTaskId } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";
import { Button } from "./Button";
import { Collapse } from "./Collapse";
import { Sheet } from "./Sheet";

/**
 * "Completa tus datos" (S10-4, was "Afina tu número"): what's left for a real
 * Disponible, on top of Hoy until it's all done. Collapsed by default to one
 * line — title, count, a thin bar and the next step — so it's always there
 * without taking the screen; the user's choice is remembered. Each task says
 * what it adds; cards and fixed payments can be closed with "No tengo" (or,
 * for names left pending, "Ya no los pago").
 */
export const SetupCard = memo(function SetupCard({ setup, open, onToggle, onTask, onDecline }: {
  setup: SetupProgress;
  open: boolean;
  onToggle: () => void;
  onTask: (id: SetupTaskId) => void;
  onDecline: (id: SetupTaskId) => void;
}) {
  const t = useV2Theme();
  const c = t.colors;
  const tasks = setup.tasks.filter((x) => x.id !== "basics");
  const done = tasks.filter((x) => x.done).length;
  const next = tasks.find((x) => !x.done) ?? null;
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={[styles.card, { backgroundColor: c.card }, t.shadow]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Completa tus datos. ${done} de ${tasks.length} listos. Tu número está en ${setup.percent} por ciento`}
        accessibilityHint={open ? "Oculta los pasos" : "Muestra los pasos"}
        style={styles.head}
      >
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 16, color: c.ink, fontFamily: t.fonts.uiSemibold }}>Completa tus datos</Text>
        <Text style={{ fontSize: 12, color: c.muted, fontFamily: t.fonts.mono }}>{done} de {tasks.length}</Text>
        <Chevron size={18} color={c.ink} strokeWidth={2.2} />
      </Pressable>
      <View style={[styles.track, { backgroundColor: c.sunk }]} accessible={false}>
        <View style={[styles.fill, { width: `${Math.max(setup.percent, 2)}%`, backgroundColor: c.ink }]} />
      </View>
      {!open && next && <TaskRow task={next} compact onPress={() => onTask(next.id)} onDecline={() => onDecline(next.id)} />}
      <Collapse open={open}>
        <View style={{ gap: 10, paddingTop: 2 }}>
          <Text style={{ fontSize: 13, lineHeight: 18, color: c.muted, fontFamily: t.fonts.ui }}>
            Se queda aquí hasta que termines. Cada paso hace tu número más real.
          </Text>
          {tasks.map((task) => <TaskRow key={task.id} task={task} onPress={() => onTask(task.id)} onDecline={() => onDecline(task.id)} />)}
        </View>
      </Collapse>
    </View>
  );
});

function TaskRow({ task, onPress, onDecline, compact }: { task: SetupTask; onPress: () => void; onDecline: () => void; compact?: boolean }) {
  const t = useV2Theme();
  const c = t.colors;
  return (
    <View style={[styles.task, { backgroundColor: task.done ? c.sunk : c.card, borderColor: task.done ? c.sunk : c.line }]}>
      <Pressable
        onPress={onPress}
        disabled={task.done}
        accessibilityRole="button"
        accessibilityState={{ disabled: task.done, checked: task.done }}
        accessibilityLabel={`${task.title}. ${task.done ? "Listo" : `${task.detail}. Suma ${task.weight} por ciento`}`}
        style={styles.taskMain}
      >
        <View style={[styles.check, task.done ? { backgroundColor: c.ok.solid } : { borderWidth: 1.5, borderColor: c.control }]}>
          {task.done && <Check size={14} color={c.ok.onSolid} strokeWidth={3} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, color: task.done ? c.muted : c.ink, fontFamily: t.fonts.uiSemibold, textDecorationLine: task.done ? "line-through" : "none" }}>
            {task.title}
          </Text>
          {!task.done && !compact && <Text style={{ fontSize: 12, lineHeight: 16, color: c.muted, fontFamily: t.fonts.ui }}>{task.detail}</Text>}
        </View>
        <View style={[styles.gain, { backgroundColor: c.ok.tint }]}>
          <Text style={{ fontSize: 12, color: c.ok.text, fontFamily: t.fonts.uiSemibold }}>{task.done ? "Listo" : `+${task.weight}%`}</Text>
        </View>
        {!task.done && <ChevronRight size={16} color={c.muted} />}
      </Pressable>
      {!task.done && !compact && task.canDecline && (
        <Button
          label={task.declineLabel} variant="text" size="S" onPress={onDecline} style={{ alignSelf: "flex-start", marginLeft: 34 }}
          accessibilityLabel={task.declineLabel === "No tengo" ? `No tengo ${task.id === "cards" ? "tarjetas de crédito" : "pagos fijos"}` : `${task.declineLabel}: quitar los pagos sin monto`}
        />
      )}
    </View>
  );
}

/** What each open task means, as "Le falta: …" reads it. */
const MISSING: Record<SetupTaskId, string> = {
  basics: "cuándo te pagan y cuánto tienes",
  statement: "tus extractos",
  bills: "tus pagos fijos",
  cards: "tus tarjetas",
};

/** "¿Qué tan real es tu número?": the levels and what's missing. */
export function PrecisionSheet({ setup, open, onClose }: { setup: SetupProgress; open: boolean; onClose: () => void }) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const missing = setup.tasks.filter((x) => !x.done).map((x) => MISSING[x.id]);
  return (
    <Sheet open={open} onClose={onClose} style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16, gap: 12 }}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={{ fontSize: 18, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>¿Qué tan real es tu número?</Text>
      <Text style={{ fontSize: 15, lineHeight: 21, color: t.colors.muted, fontFamily: t.fonts.ui }}>
        {setup.level === "real"
          ? missing.length ? `Ya es real. Para afinarlo del todo: ${missing.join(", ")}.` : "Ya incluye tus extractos, tus pagos fijos y tus tarjetas."
          : `Zeta lo calcula con lo que sabe; por eso lleva ≈. Le falta: ${missing.join(", ")}.`}
      </Text>
      <View style={styles.levels}>
        {(["borrador", "aproximado", "real"] as const).map((l) => {
          const on = l === setup.level;
          return (
            <View key={l} style={[styles.level, { backgroundColor: on ? t.colors.button : t.colors.sunk }]} accessibilityState={{ selected: on }}>
              <Text style={{ fontSize: 13, color: on ? t.colors.onButton : t.colors.muted, fontFamily: t.fonts.uiSemibold }}>{setupLevelLabel(l)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui }}>Borrador: menos de 40% · Aproximado: 40 a 79% · Real: 80% o más.</Text>
      <Button label="Entendido" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 16, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: -4 },
  fill: { height: 6, borderRadius: 3 },
  task: { borderRadius: 14, borderWidth: 1.5, paddingVertical: 8, paddingHorizontal: 10 },
  taskMain: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  gain: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2 },
  levels: { flexDirection: "row", gap: 6 },
  level: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
