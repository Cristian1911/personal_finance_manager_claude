import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, FileText, Image as ImageIcon, Mail, Pencil, Smartphone, type LucideIcon } from "lucide-react-native";
import type { DetalleSource, DetalleView } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";
import { Sheet } from "./Sheet";

const SOURCE_ICON: Record<DetalleSource, LucideIcon> = {
  manual: Pencil, email: Mail, notification: Smartphone, pdf: FileText, screenshot: ImageIcon, other: FileText,
};
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Detalle, design A (spec §3): facts on top (amount, name, source as an icon,
 * status when it doesn't count), then the list (M1: Nota; Categoría,
 * Destinatario and Qué fue arrive in their slot later — no placeholders),
 * then "No es un movimiento" and Listo. A manual entry's amount and date are
 * fixed by tapping them. The account toggle lives in Mis cuentas (S8-4).
 */
export function DetalleSheet({ detalle, onClose, onNote, onNotAMovement, onCountAgain, onFix }: {
  detalle: DetalleView | null;
  onClose: () => void;
  onNote: (notes: string | null) => void;
  onNotAMovement: () => void;
  onCountAgain: () => void;
  onFix: (fix: { amount?: number; date?: string }) => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const last = useRef<DetalleView | null>(null);
  if (detalle) last.current = detalle;
  const d = detalle ?? last.current;

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const noteOpenRef = useRef(false);
  const [fixing, setFixing] = useState(false);
  const [amountDraft, setAmountDraft] = useState("");
  const [dateDraft, setDateDraft] = useState<Date>(new Date());
  useEffect(() => {
    setNoteOpen(false); noteOpenRef.current = false; setFixing(false);
  }, [detalle?.id]);

  const saveNote = () => {
    if (!noteOpenRef.current || !d) return;
    noteOpenRef.current = false;
    setNoteOpen(false);
    const next = noteDraft.trim() || null;
    if (next !== d.note) onNote(next);
  };
  const close = () => { saveNote(); onClose(); };
  const startFix = () => {
    if (!d?.manual) return;
    setAmountDraft(String(d.raw.amount));
    setDateDraft(new Date(`${d.raw.date}T12:00:00`));
    setFixing(true);
  };
  const saveFix = () => {
    if (!d) return;
    const amount = Number(amountDraft.replace(/[^\d]/g, ""));
    const date = toIso(dateDraft);
    const fix: { amount?: number; date?: string } = {};
    if (amount > 0 && amount !== d.raw.amount) fix.amount = amount;
    if (date !== d.raw.date) fix.date = date;
    setFixing(false);
    if (fix.amount !== undefined || fix.date !== undefined) onFix(fix);
  };

  const Icon = d ? SOURCE_ICON[d.source] : Pencil;
  return (
    <Sheet open={!!detalle} onClose={close} style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
      {d && (
        <>
          <View style={[styles.handle, { backgroundColor: t.colors.control }]} />
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" bounces={false}>
            <Pressable
              onPress={startFix}
              disabled={!d.manual}
              accessibilityRole={d.manual ? "button" : undefined}
              accessibilityLabel={`${d.title}, ${d.amount.replace(/−/g, "menos ").replace(/^\+/, "más ")}, ${d.facts}`}
              accessibilityHint={d.manual ? "Corrige el monto o la fecha" : undefined}
              style={styles.hero}
            >
              <Text style={[styles.amount, { color: t.colors.ink, fontFamily: t.fonts.numberSemibold }]}>{d.amount}</Text>
              <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} numberOfLines={1}>{d.title}</Text>
              <View style={styles.facts}>
                <Icon size={14} color={t.colors.muted} strokeWidth={2} />
                <Text style={[styles.factsText, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>{d.facts}</Text>
              </View>
              {d.status && (
                <View style={[styles.pill, { backgroundColor: t.colors.sunk }]}>
                  <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.uiSemibold }}>{d.status}</Text>
                </View>
              )}
            </Pressable>

            {fixing && (
              <View style={[styles.fix, { backgroundColor: t.colors.sunk }]}>
                <Text style={[styles.fixLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Monto</Text>
                <TextInput
                  value={amountDraft}
                  onChangeText={setAmountDraft}
                  keyboardType="number-pad"
                  accessibilityLabel="Monto"
                  style={[styles.fixInput, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.numberSemibold }]}
                />
                <Text style={[styles.fixLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Fecha</Text>
                <DateTimePicker
                  value={dateDraft}
                  mode="date"
                  display={Platform.OS === "ios" ? "compact" : "default"}
                  maximumDate={new Date()}
                  onChange={(_e, v) => v && setDateDraft(v)}
                  accessibilityLabel="Fecha"
                />
                <Pressable onPress={saveFix} accessibilityRole="button" style={[styles.primaryM, { backgroundColor: t.colors.button }]}>
                  <Text style={{ fontSize: 14, color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }}>Guardar cambios</Text>
                </Pressable>
              </View>
            )}

            <View style={[styles.list, { borderColor: t.colors.line }]}>
              <View style={styles.row}>
                <Text style={[styles.rowKey, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Nota</Text>
                {noteOpen ? (
                  <TextInput
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    onSubmitEditing={saveNote}
                    onBlur={saveNote}
                    autoFocus
                    maxLength={500}
                    returnKeyType="done"
                    placeholder="Escribe una nota"
                    placeholderTextColor={t.colors.muted}
                    accessibilityLabel="Nota"
                    style={[styles.noteInput, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
                  />
                ) : (
                  <Pressable
                    onPress={() => { setNoteDraft(d.note ?? ""); noteOpenRef.current = true; setNoteOpen(true); }}
                    accessibilityRole="button"
                    accessibilityLabel={d.note ? `Nota: ${d.note}. Editar` : "Agregar nota"}
                    style={styles.rowValue}
                  >
                    <Text style={{ fontSize: 14, color: d.note ? t.colors.ink : t.colors.muted, fontFamily: t.fonts.uiSemibold }} numberOfLines={1}>{d.note ?? "Agregar"}</Text>
                    <ChevronRight size={16} color={t.colors.control} />
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>

          <Pressable
            onPress={d.excluded ? onCountAgain : onNotAMovement}
            accessibilityRole="button"
            accessibilityHint={d.excluded ? "Vuelve a contar este movimiento" : d.manual ? "Lo borra; puedes deshacerlo" : "Deja de contar; puedes deshacerlo"}
            hitSlop={8}
            style={styles.quiet}
          >
            <Text style={[styles.quietText, { color: t.colors.muted, fontFamily: t.fonts.uiSemibold }]}>
              {d.excluded ? "Contar de nuevo" : "No es un movimiento"}
            </Text>
          </Pressable>
          <Pressable onPress={close} accessibilityRole="button" style={[styles.done, { backgroundColor: t.colors.button }]}>
            <Text style={{ fontSize: 15, color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }}>Listo</Text>
          </Pressable>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: "92%", paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  body: { flexShrink: 1 },
  bodyContent: { gap: 14 },
  hero: { alignItems: "center", gap: 4, paddingTop: 4 },
  amount: { fontSize: 32, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  title: { fontSize: 16 },
  facts: { flexDirection: "row", alignItems: "center", gap: 6 },
  factsText: { fontSize: 12 },
  pill: { marginTop: 6, height: 24, paddingHorizontal: 10, borderRadius: 99, justifyContent: "center" },
  fix: { borderRadius: 14, padding: 12, gap: 8 },
  fixLabel: { fontSize: 12 },
  fixInput: { height: 44, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 18 },
  primaryM: { height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 4 },
  list: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, paddingHorizontal: 14 },
  rowKey: { flex: 1, fontSize: 14 },
  rowValue: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "65%", minHeight: 44 },
  noteInput: { flex: 1.4, height: 44, borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 10, fontSize: 14 },
  quiet: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  quietText: { fontSize: 14, textDecorationLine: "underline" },
  done: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
