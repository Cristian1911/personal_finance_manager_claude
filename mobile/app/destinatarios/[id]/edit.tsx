import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { COLORS } from "../../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  FORM_INPUT_CLASS,
  PANEL_INSET_CLASS,
} from "../../../lib/constants/styles";
import { MobileHeader } from "../../../components/ui/MobileHeader";
import {
  getDestinatarioById,
  updateDestinatario,
} from "../../../lib/repositories/destinatarios";
import {
  getAllCategories,
  type CategoryRow,
} from "../../../lib/repositories/categories";
import {
  CategoryZonePickerSheet,
  type CategoryRow as PickerCategoryRow,
} from "../../../components/transactions/CategoryZonePickerSheet";

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="mb-1.5 text-[13px] font-inter-semibold text-foreground">
      {children}
    </Text>
  );
}

export default function EditDestinatarioScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [dest, cats] = await Promise.all([
        getDestinatarioById(id),
        getAllCategories(),
      ]);
      setCategories(cats);
      if (!dest) {
        Alert.alert("Error", "No se encontró el destinatario.");
        router.back();
        return;
      }
      setName(dest.name);
      setCategoryId(dest.default_category_id);
      setCategoryName(dest.category_name);
      setNotes(dest.notes ?? "");
      setIsActive(!!dest.is_active);
    } catch (error) {
      console.error("Failed to load destinatario:", error);
      Alert.alert("Error", "No se pudo cargar el destinatario.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // useEffect (not useFocusEffect): load once / on id change. Reloading on
  // refocus would silently clobber the user's unsaved edits.
  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!id) return;
    if (!name.trim()) {
      Alert.alert("Error", "El nombre es requerido.");
      return;
    }
    if (name.trim().length > 100) {
      Alert.alert("Error", "El nombre no puede superar 100 caracteres.");
      return;
    }
    if (notes.trim().length > 500) {
      Alert.alert("Error", "Las notas no pueden superar 500 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await updateDestinatario(id, {
        name: name.trim(),
        default_category_id: categoryId,
        notes: notes.trim() || null,
        is_active: isActive,
      });
      router.back();
    } catch (error) {
      console.error("Failed to update destinatario:", error);
      Alert.alert("Error", "No se pudo guardar el destinatario.");
      setSaving(false);
    }
  }, [id, name, categoryId, notes, isActive, router]);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Editar destinatario" />
      {loading ? (
        <View
          className="flex-1 items-center justify-center"
          accessibilityLabel="Cargando destinatario"
        >
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-4">
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              accessibilityLabel="Nombre del destinatario"
              value={name}
              onChangeText={setName}
              placeholder="Nombre del destinatario"
              placeholderTextColor={COLORS.sageDark}
              className={FORM_INPUT_CLASS}
            />
          </View>

          <View className="mb-4">
            <FieldLabel>Categoría por defecto</FieldLabel>
            <Pressable
              onPress={() => setShowCategoryPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Elegir categoría por defecto"
              className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
            >
              <Text
                className={`text-sm font-inter-medium ${categoryName ? "text-foreground" : "text-muted-foreground"}`}
              >
                {categoryName ?? "Sin categoría"}
              </Text>
              <ChevronRight size={16} color={COLORS.sageDark} />
            </Pressable>
          </View>

          <View className="mb-4">
            <FieldLabel>Estado</FieldLabel>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Estado"
              className={`${PANEL_INSET_CLASS} flex-row gap-1 p-1`}
            >
              {[
                { v: true, label: "Activo" },
                { v: false, label: "Archivado" },
              ].map((opt) => {
                const sel = opt.v === isActive;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => setIsActive(opt.v)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    className={`flex-1 items-center rounded-lg py-2 ${sel ? "bg-z-surface-2-80" : ""}`}
                  >
                    <Text
                      className={`text-[13px] font-inter-semibold ${sel ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mb-5">
            <FieldLabel>Notas</FieldLabel>
            <TextInput
              accessibilityLabel="Notas del destinatario (opcional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Nota opcional"
              placeholderTextColor={COLORS.sageDark}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className={FORM_INPUT_CLASS}
            />
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            className={`${BRASS_BUTTON_CLASS} items-center rounded-xl py-3.5 active:opacity-80`}
            style={saving ? { opacity: 0.6 } : undefined}
          >
            <Text className="text-sm font-inter-bold text-z-ink">
              {saving ? "Guardando..." : "Guardar"}
            </Text>
          </Pressable>
        </ScrollView>
      )}

      <CategoryZonePickerSheet
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        selectedId={categoryId}
        categories={categories as PickerCategoryRow[]}
        onSelect={(cid, cname) => {
          setCategoryId(cid);
          setCategoryName(cname);
        }}
      />
    </View>
  );
}
