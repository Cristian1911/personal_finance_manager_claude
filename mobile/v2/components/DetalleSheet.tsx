import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Eye, EyeOff, Split, Users, type LucideIcon } from "lucide-react-native";
import type { DetalleView } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";
import { Sheet } from "./Sheet";

/**
 * Detalle (Claude Design "Z Cuentas", detalle): the same sheet for every
 * movement — "Toda fila abre la misma hoja de detalle. Sin swipes ni modos de
 * edición." The note, Ignorar and whether the account counts work today;
 * Dividir and Es préstamo come with people (M4); the category with M3.
 */
export function DetalleSheet({
  detalle,
  onClose,
  onNote,
  onExcluded,
  onAccountCounts,
  onSoon,
}: {
  detalle: DetalleView | null;
  onClose: () => void;
  onNote: (notes: string | null) => void;
  onExcluded: (excluded: boolean) => void;
  /** Asks first: it changes every movement of that account. */
  onAccountCounts: (accountId: string, counts: boolean) => void;
  onSoon: (what: string) => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // The note saves once: submit, blur or closing the sheet, whichever comes first.
  const editingRef = useRef(false);
  // The last movement shown stays drawn while the sheet slides away.
  const last = useRef<DetalleView | null>(null);
  if (detalle) last.current = detalle;
  const d = detalle ?? last.current;
  useEffect(() => { setEditing(false); editingRef.current = false; setDraft(""); }, [detalle?.id]);

  const saveNote = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    const next = draft.trim() || null;
    if (d && next !== d.note) onNote(next);
  };
  const close = () => { saveNote(); onClose(); };

  return (
    <Sheet open={!!detalle} onClose={close} style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
      {d && (
          <>
            <View style={[styles.handle, { backgroundColor: t.colors.control }]} />
            <View style={styles.head} accessible accessibilityRole="header" accessibilityLabel={`${d.title}, ${d.amount.replace(/−/g, "menos ").replace(/^\+/, "más ")}, ${d.subtitle}`}>
              <View style={[styles.avatar, { backgroundColor: t.colors.sunk }]}>
                <Text style={{ fontSize: 14, color: t.colors.muted, fontFamily: t.fonts.uiSemibold }}>{d.initial}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 18, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }} numberOfLines={1}>{d.title}</Text>
                <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui }}>{d.subtitle}</Text>
              </View>
              <Text style={{ fontSize: 22, color: t.colors.ink, fontFamily: t.fonts.numberSemibold, fontVariant: ["tabular-nums"] }}>{d.amount}</Text>
            </View>

            <ScrollView style={styles.middle} contentContainerStyle={styles.middleContent} keyboardShouldPersistTaps="handled" bounces={false}>
            <View>
              <Pressable
                disabled={!d.counts.accountToggle}
                onPress={() => onAccountCounts(d.counts.accountId, d.counts.accountToggle !== "on")}
                accessibilityRole={d.counts.accountToggle ? "switch" : undefined}
                accessibilityState={d.counts.accountToggle ? { checked: d.counts.accountToggle === "on" } : undefined}
                accessibilityLabel={`Cuenta para Disponible: ${d.counts.value}`}
                accessibilityHint={d.counts.accountToggle ? "Cambia si esta cuenta suma a tu Disponible" : undefined}
                style={[styles.row, { borderTopColor: t.colors.line }]}
              >
                <Text style={[styles.rowLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Cuenta para Disponible</Text>
                <Text style={[styles.rowValue, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }, d.counts.accountToggle && styles.underline]}>{d.counts.value}</Text>
              </Pressable>
              <View style={[styles.row, { borderTopColor: t.colors.line }]}>
                <Text style={[styles.rowLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Nota</Text>
                {editing ? (
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={saveNote}
                    onBlur={saveNote}
                    autoFocus
                    maxLength={500}
                    returnKeyType="done"
                    placeholder="Escribe una nota"
                    placeholderTextColor={t.colors.muted}
                    accessibilityLabel="Nota"
                    style={[styles.noteInput, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold, borderColor: t.colors.control }]}
                  />
                ) : (
                  <Pressable
                    onPress={() => { setDraft(d.note ?? ""); editingRef.current = true; setEditing(true); }}
                    accessibilityRole="button"
                    accessibilityLabel={d.note ? `Nota: ${d.note}. Editar` : "Agregar nota"}
                    hitSlop={8}
                    style={styles.noteValue}
                  >
                    <Text style={[styles.rowValue, { color: d.note ? t.colors.ink : t.colors.muted, fontFamily: t.fonts.uiSemibold }, styles.underline]} numberOfLines={1}>
                      {d.note ?? "Agregar"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Text style={[styles.source, { color: t.colors.muted, backgroundColor: t.colors.sunk, fontFamily: t.fonts.mono }]}>{d.source}</Text>

            <View style={styles.actions}>
              <Action icon={Split} label="Dividir" onPress={() => onSoon("Dividir una compra")} />
              <Action icon={Users} label="Es préstamo" onPress={() => onSoon("Marcar un préstamo")} />
              <Action
                icon={d.excluded ? Eye : EyeOff}
                label={d.excluded ? "Contar" : "Ignorar"}
                hint={d.excluded ? "Vuelve a contar este movimiento" : "No es un movimiento: deja de contar"}
                onPress={() => onExcluded(!d.excluded)}
              />
            </View>

            </ScrollView>

            <Pressable onPress={close} accessibilityRole="button" style={[styles.done, { backgroundColor: t.colors.button }]}>
              <Text style={{ fontSize: 15, color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }}>Listo</Text>
            </Pressable>
          </>
      )}
    </Sheet>
  );
}

function Action({ icon: Icon, label, hint, onPress }: { icon: LucideIcon; label: string; hint?: string; onPress: () => void }) {
  const t = useV2Theme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint={hint} style={[styles.action, { borderColor: t.colors.control }]}>
      <Icon size={18} color={t.colors.ink} strokeWidth={2} />
      <Text style={{ fontSize: 12, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: "92%", paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  middle: { flexShrink: 1 },
  middleContent: { gap: 12 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, borderTopWidth: 1 },
  rowLabel: { flex: 1, fontSize: 14 },
  rowValue: { fontSize: 14 },
  underline: { textDecorationLine: "underline" },
  noteValue: { maxWidth: "60%", minHeight: 44, justifyContent: "center" },
  noteInput: { flex: 1.4, height: 44, borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 10, fontSize: 14 },
  source: { fontSize: 12, lineHeight: 17, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, overflow: "hidden" },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1, height: 62, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 4 },
  done: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
