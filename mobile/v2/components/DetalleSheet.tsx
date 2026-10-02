import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toColombiaDateString } from "../../lib/utils/date";
import { ChevronRight, FileText, Image as ImageIcon, Mail, Pencil, Smartphone, type LucideIcon } from "lucide-react-native";
import { parseAmount, type DetalleSource, type DetalleView } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";
import { Button } from "./Button";
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
  onFix: (fix: { amount?: number; date?: string; description?: string; time?: string }) => void;
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
  const amountStart = useRef("");
  const [dateDraft, setDateDraft] = useState<Date>(new Date());
  const [nameDraft, setNameDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState<Date>(new Date());
  const [pickingTime, setPickingTime] = useState(false);
  // Android's picker is a dialog: mount it only while it's asked for (else it reopens on every render).
  const [pickingDate, setPickingDate] = useState(false);
  useEffect(() => {
    setNoteOpen(false); noteOpenRef.current = false; setFixing(false); setPickingDate(false);
  }, [detalle?.id]);

  const saveNote = () => {
    if (!noteOpenRef.current || !d) return;
    noteOpenRef.current = false;
    setNoteOpen(false);
    const next = noteDraft.trim() || null;
    if (next !== d.note) onNote(next);
  };
  const startFix = () => {
    if (!d?.manual) return;
    amountStart.current = String(d.raw.amount);
    setAmountDraft(amountStart.current);
    setDateDraft(new Date(`${d.raw.date}T12:00:00`));
    setNameDraft(d.raw.description);
    setTimeDraft(atTime(d.raw.time));
    setFixing(true);
  };
  const saveFix = () => {
    if (!d || !fixing) return;
    const fix: { amount?: number; date?: string; description?: string; time?: string } = {};
    // Only what the person changed: an untouched amount is never re-parsed.
    if (amountDraft !== amountStart.current) {
      const amount = parseAmount(amountDraft);
      if (amount !== null && Math.abs(amount - d.raw.amount) > 0.001) fix.amount = amount;
    }
    const date = toIso(dateDraft);
    if (date !== d.raw.date) fix.date = date;
    const name = nameDraft.trim();
    if (name && name !== d.raw.description) fix.description = name;
    const time = hhmm(timeDraft);
    if (time !== d.raw.time) fix.time = time;
    setFixing(false);
    setPickingDate(false);
    setPickingTime(false);
    if (Object.keys(fix).length) onFix(fix);
  };
  // Closing keeps what was typed, the note and the fix alike.
  const close = () => { saveNote(); saveFix(); onClose(); };

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
              accessibilityLabel={`${d.title}, ${d.amount.replace(/−/g, "menos ").replace(/^\+/, "más ")}, ${d.facts}${d.status ? `, ${d.status}` : ""}`}
              accessibilityHint={d.manual ? "Corrige el nombre, el monto, la fecha o la hora" : undefined}
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
                <Text style={[styles.fixLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Nombre</Text>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  maxLength={200}
                  returnKeyType="done"
                  accessibilityLabel="Nombre"
                  style={[styles.fixInput, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
                />
                <Text style={[styles.fixLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Monto</Text>
                <TextInput
                  value={amountDraft}
                  onChangeText={setAmountDraft}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  accessibilityLabel="Monto"
                  style={[styles.fixInput, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.numberSemibold }]}
                />
                <Text style={[styles.fixLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Fecha y hora</Text>
                {Platform.OS === "ios" ? (
                  <View style={[styles.dateRow, { flexDirection: "row", gap: 8 }]}>
                    <DateTimePicker
                      value={dateDraft}
                      mode="date"
                      display="compact"
                      locale="es-CO"
                      themeVariant={t.mode}
                      accentColor={t.colors.button}
                      maximumDate={new Date(`${toColombiaDateString()}T12:00:00`)}
                      onChange={(_e, v) => v && setDateDraft(v)}
                    />
                    <DateTimePicker
                      value={timeDraft}
                      mode="time"
                      display="compact"
                      locale="es-CO"
                      themeVariant={t.mode}
                      accentColor={t.colors.button}
                      onChange={(_e, v) => v && setTimeDraft(v)}
                      accessibilityLabel="Hora"
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setPickingDate(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Fecha: ${toIso(dateDraft)}. Cambiar`}
                    style={[styles.fixInput, styles.dateButton, { borderColor: t.colors.control }]}
                  >
                    <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{toIso(dateDraft)}</Text>
                  </Pressable>
                )}
                {Platform.OS !== "ios" && (
                  <Pressable
                    onPress={() => setPickingTime(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Hora: ${hhmm(timeDraft)}. Cambiar`}
                    style={[styles.fixInput, styles.dateButton, { borderColor: t.colors.control }]}
                  >
                    <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{hhmm(timeDraft)}</Text>
                  </Pressable>
                )}
                {Platform.OS !== "ios" && pickingTime && (
                  <DateTimePicker
                    value={timeDraft}
                    mode="time"
                    onChange={(_e, v) => { setPickingTime(false); if (v) setTimeDraft(v); }}
                  />
                )}
                {Platform.OS !== "ios" && pickingDate && (
                  <DateTimePicker
                    value={dateDraft}
                    mode="date"
                    maximumDate={new Date(`${toColombiaDateString()}T12:00:00`)}
                    onChange={(_e, v) => { setPickingDate(false); if (v) setDateDraft(v); }}
                  />
                )}
                <Button label="Guardar cambios" variant="secondary" size="M" onPress={saveFix} style={{ marginTop: 4 }} />
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

          <Button
            label={d.excluded ? "Contar de nuevo" : "No es un movimiento"}
            variant="text"
            onPress={d.excluded ? onCountAgain : onNotAMovement}
            accessibilityHint={d.excluded ? "Vuelve a contar este movimiento" : d.manual ? "Lo borra; puedes deshacerlo" : "Deja de contar; puedes deshacerlo"}
            style={{ alignSelf: "center" }}
          />
          <Button label="Listo" onPress={close} />
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
  dateRow: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center" },
  dateButton: { justifyContent: "center" },
  list: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, paddingHorizontal: 14 },
  rowKey: { flex: 1, fontSize: 14 },
  rowValue: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "65%", minHeight: 44 },
  noteInput: { flex: 1.4, height: 44, borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 10, fontSize: 14 },
});

/** "07:45" from a picked time (the phone's clock is Colombia's). */
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
/** A Date at "HH:mm" today, for the time picker; now when unknown. */
function atTime(time: string | null): Date {
  const d = new Date();
  if (time) d.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
  return d;
}
