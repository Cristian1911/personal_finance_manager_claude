import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  type ViewStyle,
  Alert,
} from "react-native";
import { X, Trash2, ChevronDown } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
} from "../../lib/constants/styles";
import { MobileSheet } from "../ui/MobileSheet";
import type { CategoryRow } from "../../lib/repositories/categories";

/** Preset colors that read well on the dark background */
const COLOR_PRESETS: string[] = [
  "#937844", // brass
  "#5CB88A", // income/green
  "#E8875A", // expense/orange
  "#E05545", // debt/red
  "#D4A843", // alert/gold
  "#7B9EBF", // blue
  "#A87BC5", // purple
  "#6BBFAB", // teal
  "#C5856A", // terracotta
  "#8B8B6B", // olive
];

interface CategoryFormSheetProps {
  visible: boolean;
  category?: CategoryRow;
  parentCategories: CategoryRow[];
  onSave: (data: {
    id?: string;
    name: string;
    nameEs: string;
    color: string;
    parentId: string | null;
  }) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function CategoryFormSheet({
  visible,
  category,
  parentCategories,
  onSave,
  onDelete,
  onClose,
}: CategoryFormSheetProps) {
  const isEditing = !!category;

  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);

  // Reset form when sheet opens/category changes
  useEffect(() => {
    if (visible) {
      setName(category?.name_es ?? category?.name ?? "");
      setColor(category?.color ?? COLOR_PRESETS[0]);
      setParentId(category?.parent_id ?? null);
      setParentPickerOpen(false);
    }
  }, [visible, category]);

  const selectedParent = parentId
    ? parentCategories.find((p) => p.id === parentId)
    : null;

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;

    onSave({
      id: category?.id,
      name: trimmed,
      nameEs: trimmed,
      color,
      parentId,
    });
    onClose();
  }, [name, color, parentId, category, onSave, onClose]);

  const handleDelete = useCallback(() => {
    if (!category || !onDelete) return;
    Alert.alert(
      "Eliminar categoría",
      `Seguro que quieres eliminar "${category.name_es ?? category.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            onDelete(category.id);
            onClose();
          },
        },
      ]
    );
  }, [category, onDelete, onClose]);

  return (
    <MobileSheet visible={visible} onClose={onClose} maxHeightClass="max-h-[80%]" hideHandle>
      <View>
        <View>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-2 pb-2">
            <Text className="text-[15px] font-inter-semibold text-foreground">
              {isEditing ? "Editar categoría" : "Nueva categoría"}
            </Text>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full"
              accessibilityLabel="Cerrar"
            >
              <X size={16} color={COLORS.sageLight} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 16,
              gap: 16,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name field */}
            <View>
              <Text className="text-[11px] font-inter-semibold text-z-sage-dark uppercase tracking-[2px] mb-1.5">
                Nombre
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ej: Mascotas"
                placeholderTextColor={COLORS.sageDark}
                className="rounded-xl border border-white-6 bg-z-surface-2-55 px-3.5 py-2.5 text-[13px] font-inter-medium text-foreground"
                autoFocus={!isEditing}
                returnKeyType="done"
              />
            </View>

            {/* Parent category picker */}
            <View>
              <Text className="text-[11px] font-inter-semibold text-z-sage-dark uppercase tracking-[2px] mb-1.5">
                Categoría padre (opcional)
              </Text>
              <Pressable
                onPress={() => setParentPickerOpen(!parentPickerOpen)}
                className="flex-row items-center justify-between rounded-xl border border-white-6 bg-z-surface-2-55 px-3.5 py-2.5"
              >
                <Text
                  className={`text-[13px] font-inter-medium ${
                    selectedParent
                      ? "text-foreground"
                      : "text-z-sage-dark"
                  }`}
                >
                  {selectedParent
                    ? selectedParent.name_es ?? selectedParent.name
                    : "Sin padre"}
                </Text>
                <ChevronDown size={14} color={COLORS.sageDark} />
              </Pressable>

              {parentPickerOpen && (
                <View className="mt-1.5 rounded-xl border border-white-6 bg-z-surface-2-55 overflow-hidden">
                  {/* None option */}
                  <Pressable
                    onPress={() => {
                      setParentId(null);
                      setParentPickerOpen(false);
                    }}
                    className={`px-3.5 py-2.5 active:bg-z-surface-2/5 border-b border-white-6 ${
                      !parentId ? "bg-z-brass-8" : ""
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-inter-medium ${
                        !parentId ? "text-z-brass" : "text-foreground"
                      }`}
                    >
                      Sin padre
                    </Text>
                  </Pressable>
                  {parentCategories.map((parent, idx) => (
                    <Pressable
                      key={parent.id}
                      onPress={() => {
                        setParentId(parent.id);
                        setParentPickerOpen(false);
                      }}
                      className={`flex-row items-center gap-2.5 px-3.5 py-2.5 active:bg-z-surface-2/5 ${
                        idx < parentCategories.length - 1
                          ? "border-b border-white-6"
                          : ""
                      } ${parentId === parent.id ? "bg-z-brass-8" : ""}`}
                    >
                      {parent.color && (
                        <View
                          className="h-2.5 w-2.5 rounded-full"
                          style={
                            { backgroundColor: parent.color } as ViewStyle
                          }
                        />
                      )}
                      <Text
                        className={`text-[13px] font-inter-medium ${
                          parentId === parent.id
                            ? "text-z-brass"
                            : "text-foreground"
                        }`}
                      >
                        {parent.name_es ?? parent.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Color picker */}
            <View>
              <Text className="text-[11px] font-inter-semibold text-z-sage-dark uppercase tracking-[2px] mb-1.5">
                Color
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {COLOR_PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setColor(preset)}
                    className={`h-9 w-9 rounded-full items-center justify-center ${
                      color === preset
                        ? "border-2 border-foreground"
                        : "border border-white-6"
                    }`}
                    accessibilityLabel={`Color ${preset}`}
                  >
                    <View
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: preset } as ViewStyle}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Actions */}
            <View className="gap-3 mt-2">
              <Pressable
                onPress={handleSave}
                disabled={!name.trim()}
                className={`${BRASS_BUTTON_CLASS} items-center rounded-xl py-3 ${
                  !name.trim() ? "opacity-40" : "active:opacity-80"
                }`}
              >
                <Text className="text-[13px] font-inter-semibold text-z-ink">
                  {isEditing ? "Guardar cambios" : "Crear categoría"}
                </Text>
              </Pressable>

              {isEditing && onDelete && (
                <Pressable
                  onPress={handleDelete}
                  className={`${DESTRUCTIVE_GHOST_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-xl py-3 active:opacity-80`}
                >
                  <Trash2 size={14} color={COLORS.debt} />
                  <Text className="text-[13px] font-inter-semibold text-z-expense">
                    Eliminar categoría
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </MobileSheet>
  );
}
