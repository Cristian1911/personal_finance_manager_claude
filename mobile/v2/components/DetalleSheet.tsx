import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Eye, EyeOff, Split, Users, type LucideIcon } from "lucide-react-native";
import type { DetalleView } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";

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
  useEffect(() => setEditing(false), [detalle?.id]);

  const d = detalle;
  const saveNote = () => {
    setEditing(false);
    const next = draft.trim() || null;
    if (d && next !== d.note) onNote(next);
  };

  return (
    <Modal visible={!!d} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: t.colors.scrim }]} onPress={onClose} accessible={false} />
      {d && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.anchor} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: t.colors.card, paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal>
            <View style={[styles.handle, { backgroundColor: t.colors.control }]} />
            <View style={styles.head} accessible accessibilityLabel={`${d.title}, ${d.amount.replace(/−/g, "menos ").replace(/^\+/, "más ")}, ${d.subtitle}`}>
              <View style={[styles.avatar, { backgroundColor: t.colors.sunk }]}>
                <Text style={{ fontSize: 14, color: t.colors.muted, fontFamily: t.fonts.uiSemibold }}>{d.initial}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 18, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }} numberOfLines={1} accessibilityRole="header">{d.title}</Text>
                <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.ui }}>{d.subtitle}</Text>
              </View>
              <Text style={{ fontSize: 22, color: t.colors.ink, fontFamily: t.fonts.numberSemibold, fontVariant: ["tabular-nums"] }}>{d.amount}</Text>
            </View>

            <View>
              <Pressable
                disabled={!d.counts.accountToggle}
                onPress={() => onAccountCounts(d.counts.accountId, d.counts.accountToggle !== "on")}
                accessibilityRole={d.counts.accountToggle ? "button" : undefined}
                accessibilityLabel={`Cuenta para Disponible: ${d.counts.value}`}
                accessibilityHint={d.counts.accountToggle ? "Cambia si esta cuenta cuenta para Disponible" : undefined}
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
                    onPress={() => { setDraft(d.note ?? ""); setEditing(true); }}
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

            <Pressable onPress={onClose} accessibilityRole="button" style={[styles.done, { backgroundColor: t.colors.button }]}>
              <Text style={{ fontSize: 15, color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }}>Listo</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
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
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, borderTopWidth: 1 },
  rowLabel: { flex: 1, fontSize: 14 },
  rowValue: { fontSize: 14 },
  underline: { textDecorationLine: "underline" },
  noteValue: { maxWidth: "60%" },
  noteInput: { flex: 1.4, height: 36, borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 10, fontSize: 14 },
  source: { fontSize: 12, lineHeight: 17, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, overflow: "hidden" },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1, height: 62, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 4 },
  done: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
