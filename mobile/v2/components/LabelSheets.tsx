import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import { V2_CATEGORIES } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";
import { Avatar } from "./Avatar";
import { Chip, Segmented } from "./Chip";
import { Sheet } from "./Sheet";
import { Tap } from "./Tap";

/** Categoría (S8-3): the 25, by group; only those for the movement's direction. */
export function CategorySheet({ open, direction, current, onPick, onClose, onClosed }: {
  open: boolean;
  onClosed?: () => void;
  direction: "INFLOW" | "OUTFLOW";
  current: string | null;
  onPick: (categoryId: string | null) => void;
  onClose: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const groups = useMemo(() => {
    const out: { group: string; items: typeof V2_CATEGORIES[number][] }[] = [];
    for (const c of V2_CATEGORIES.filter((x) => x.pickable && x.direction === direction)) {
      const g = out.find((x) => x.group === c.group) ?? out[out.push({ group: c.group, items: [] }) - 1];
      g.items.push(c);
    }
    // A group of one ("Salud", "Mascotas") would only repeat its chip: those go together under "Otras".
    const otras = out.filter((g) => g.items.length === 1).flatMap((g) => g.items);
    return [...out.filter((g) => g.items.length > 1), ...(otras.length ? [{ group: "Otras", items: otras }] : [])];
  }, [direction]);
  return (
    <Sheet open={open} onClose={onClose} onClosed={onClosed} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Categoría</Text>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
        {groups.map((g) => (
          <View key={g.group} style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, letterSpacing: 0.6, color: t.colors.muted, fontFamily: t.fonts.mono }}>{g.group.toUpperCase()}</Text>
            <View style={styles.wrap}>
              {g.items.map((c) => <Chip key={c.id} label={c.name} on={c.id === current} onPress={() => onPick(c.id === current ? null : c.id)} />)}
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

export interface DestinatarioOption { id: string; name: string; kind: "merchant" | "person" }

/**
 * Destinatario (S8-2, destinatarios.html): Comercios · Personas, search, and
 * "+ Nuevo «…»" created with the tab's kind (decision: kind is written on
 * create, not only filtered). The movement's text prefills the search.
 */
export function DestinatarioSheet({ open, options, suggestedKind, text, current, onPick, onCreate, onClose, onClosed }: {
  open: boolean;
  onClosed?: () => void;
  options: DestinatarioOption[];
  suggestedKind: "merchant" | "person";
  /** The movement's text, cleaned: the default name for a new one. */
  text: string;
  current: string | null;
  onPick: (id: string) => void;
  onCreate: (name: string, kind: "merchant" | "person") => void;
  onClose: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState(suggestedKind);
  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setKind(suggestedKind);
    setQuery("");
  }
  if (!open && wasOpen) setWasOpen(false);

  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const shown = options.filter((o) => o.kind === kind && (!query.trim() || fold(o.name).includes(fold(query.trim()))));
  const newName = (query.trim() || titleCase(text)).slice(0, 60);
  // One with that exact name already exists: pick it, don't offer a second "Rappi".
  const exists = options.some((o) => o.kind === kind && fold(o.name) === fold(newName));
  return (
    <Sheet open={open} onClose={onClose} onClosed={onClosed} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>¿Quién es?</Text>
      <Segmented options={[{ key: "merchant", label: "Comercios" }, { key: "person", label: "Personas" }] as const} value={kind} onChange={setKind} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={kind === "person" ? "Buscar persona" : "Buscar comercio"}
        placeholderTextColor={t.colors.control}
        accessibilityLabel="Buscar destinatario"
        style={[styles.input, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
      />
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
        {newName && !exists ? (
          <Tap
            onPress={() => onCreate(newName, kind)}
            accessibilityRole="button"
            accessibilityLabel={`${kind === "person" ? "Nueva persona" : "Nuevo comercio"}: ${newName}`}
            style={(pressed) => [styles.row, pressed && { backgroundColor: t.colors.sunk }]}
          >
            <View style={[styles.plus, { borderColor: t.colors.control }]}><Plus size={16} color={t.colors.ink} /></View>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>
              {kind === "person" ? "Nueva persona" : "Nuevo comercio"} «{newName}»
            </Text>
          </Tap>
        ) : null}
        {shown.map((o) => (
          <Tap
            key={o.id}
            onPress={() => onPick(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: o.id === current }}
            accessibilityLabel={o.name}
            style={(pressed) => [styles.row, (pressed || o.id === current) && { backgroundColor: t.colors.sunk }]}
          >
            <Avatar name={o.name} kind={o.kind === "person" ? "persona" : "comercio"} size={34} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiMedium }}>{o.name}</Text>
          </Tap>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

const styles = StyleSheet.create({
  sheet: { maxHeight: "90%", paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  title: { fontSize: 19, textAlign: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  input: { height: 44, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 12, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 6, borderRadius: 12 },
  plus: { width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
});
