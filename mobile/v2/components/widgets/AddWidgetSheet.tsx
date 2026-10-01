import { memo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChartPie, DollarSign, Gauge, Landmark, Plane, Plus, Store, Wallet, X, type LucideIcon } from "lucide-react-native";
import type { InicioWidget } from "@zeta/shared";
import { useV2Theme } from "../../theme/ThemeProvider";
import { WIDGET_ICONS } from "./WidgetCard";

/** The question each widget answers (13 §Widget catalog). */
const QUESTION: Record<string, string> = {
  flujo: "¿Me alcanza hasta el próximo sueldo?",
  hoy: "¿Cuánto llevo hoy?",
  pago: "¿Qué tengo que pagar y cuándo?",
  teDeben: "¿Quién me debe y a quién le debo?",
  tarjeta: "¿Cuánto va mi próxima factura?",
  ultimos: "¿Qué pasó recién?",
};

/** Widgets of the catalog that aren't built yet (M4 and later). */
const COMING: { title: string; question: string; icon: LucideIcon; plus?: boolean }[] = [
  { title: "Deudas", question: "¿Cuánto debo en total?", icon: Landmark },
  { title: "Límites", question: "¿Me estoy pasando en algo?", icon: Gauge },
  { title: "Mis cuentas", question: "¿Dónde está mi plata?", icon: Wallet },
  { title: "¿En qué se me fue?", question: "¿En qué gasté este ciclo?", icon: ChartPie },
  { title: "Tus comercios", question: "¿Dónde compro más?", icon: Store },
  { title: "Dólar hoy", question: "¿Cuánto vale mi deuda en dólares?", icon: DollarSign },
  { title: "Viaje", question: "¿Cómo voy con el viaje?", icon: Plane, plus: true },
];

/** "Agregar widget" (Claude Design "Z Inicio", agregar): removed widgets come back; the rest of the catalog is on its way. */
export const AddWidgetSheet = memo(function AddWidgetSheet({
  visible,
  hidden,
  onAdd,
  onClose,
}: {
  visible: boolean;
  hidden: InicioWidget[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: t.colors.scrim }]} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { backgroundColor: t.colors.card, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.handle, { backgroundColor: t.colors.control }]} />
        <View style={styles.head}>
          <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} accessibilityRole="header">Agregar widget</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={8} style={[styles.close, { borderColor: t.colors.control }]}>
            <X size={14} color={t.colors.ink} strokeWidth={2.2} />
          </Pressable>
        </View>
        <Text style={[styles.sub, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Cada widget responde una pregunta.</Text>
        <ScrollView style={styles.list}>
          {hidden.map((w) => {
            const Icon = WIDGET_ICONS[w.key];
            return (
              <Row key={w.id} icon={Icon} title={w.title} question={QUESTION[w.key] ?? ""}>
                <Pressable
                  onPress={() => onAdd(w.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Agregar ${w.title}`}
                  style={[styles.add, { backgroundColor: t.colors.button }]}
                >
                  <Plus size={16} color={t.colors.onButton} />
                </Pressable>
              </Row>
            );
          })}
          {COMING.map((c) => (
            <Row key={c.title} icon={c.icon} title={c.title} question={c.question} muted>
              <View style={[styles.soon, { backgroundColor: t.colors.sunk }]}>
                <Text style={{ color: t.colors.muted, fontFamily: t.fonts.uiSemibold, fontSize: 11 }}>{c.plus ? "Plus · pronto" : "Pronto"}</Text>
              </View>
            </Row>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
});

function Row({ icon: Icon, title, question, muted, children }: {
  icon: LucideIcon; title: string; question: string; muted?: boolean; children: React.ReactNode;
}) {
  const t = useV2Theme();
  return (
    <View style={[styles.row, { borderBottomColor: t.colors.line, opacity: muted ? 0.7 : 1 }]} accessible={muted} accessibilityLabel={muted ? `${title}. ${question}. Pronto.` : undefined}>
      <View style={[styles.icon, { backgroundColor: t.colors.sunk }]}>
        <Icon size={18} color={t.colors.ink} />
      </View>
      <View style={styles.text}>
        <Text style={{ color: t.colors.ink, fontFamily: t.fonts.uiSemibold, fontSize: 15 }}>{title}</Text>
        <Text style={{ color: t.colors.muted, fontFamily: t.fonts.ui, fontSize: 13 }}>{question}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 8, maxHeight: "80%" },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center" },
  title: { flex: 1, fontSize: 20 },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  sub: { fontSize: 13, marginTop: 4, marginBottom: 6 },
  list: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
  add: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  soon: { height: 22, paddingHorizontal: 8, borderRadius: 99, justifyContent: "center" },
});
