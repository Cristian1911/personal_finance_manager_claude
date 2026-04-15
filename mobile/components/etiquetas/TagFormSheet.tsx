import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  type ViewStyle,
  Alert,
} from "react-native";
import { X, Trash2, ChevronDown } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import { BRASS_BUTTON_CLASS } from "../../lib/constants/styles";
import type { TagGroupRow, TagRow } from "../../lib/repositories/tags";

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

type FormMode =
  | { type: "create-group" }
  | { type: "edit-group"; group: TagGroupRow }
  | { type: "create-tag"; groupId: string | null }
  | { type: "edit-tag"; tag: TagRow };

interface TagFormSheetProps {
  visible: boolean;
  mode: FormMode | null;
  groups: TagGroupRow[];
  onSaveGroup: (data: { id?: string; name: string; color: string | null }) => void;
  onDeleteGroup?: (id: string) => void;
  onSaveTag: (data: { id?: string; name: string; groupId: string | null; color: string | null }) => void;
  onDeleteTag?: (id: string) => void;
  onClose: () => void;
}

export function TagFormSheet({
  visible,
  mode,
  groups,
  onSaveGroup,
  onDeleteGroup,
  onSaveTag,
  onDeleteTag,
  onClose,
}: TagFormSheetProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(COLOR_PRESETS[0]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  const isGroupMode = mode?.type === "create-group" || mode?.type === "edit-group";
  const isEditing = mode?.type === "edit-group" || mode?.type === "edit-tag";

  useEffect(() => {
    if (visible && mode) {
      setGroupPickerOpen(false);
      switch (mode.type) {
        case "create-group":
          setName("");
          setColor(COLOR_PRESETS[0]);
          break;
        case "edit-group":
          setName(mode.group.name);
          setColor(mode.group.color);
          break;
        case "create-tag":
          setName("");
          setColor(null);
          setGroupId(mode.groupId);
          break;
        case "edit-tag":
          setName(mode.tag.name);
          setColor(mode.tag.color);
          setGroupId(mode.tag.group_id);
          break;
      }
    }
  }, [visible, mode]);

  const title = (() => {
    switch (mode?.type) {
      case "create-group": return "Nuevo grupo";
      case "edit-group": return "Editar grupo";
      case "create-tag": return "Nueva etiqueta";
      case "edit-tag": return "Editar etiqueta";
      default: return "";
    }
  })();

  const selectedGroup = groupId ? groups.find((g) => g.id === groupId) : null;

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (isGroupMode) {
      onSaveGroup({
        id: mode?.type === "edit-group" ? mode.group.id : undefined,
        name: trimmed,
        color,
      });
    } else {
      onSaveTag({
        id: mode?.type === "edit-tag" ? mode.tag.id : undefined,
        name: trimmed,
        groupId,
        color,
      });
    }
    onClose();
  }, [name, color, groupId, mode, isGroupMode, onSaveGroup, onSaveTag, onClose]);

  const handleDelete = useCallback(() => {
    if (!mode) return;

    if (mode.type === "edit-group" && onDeleteGroup) {
      Alert.alert(
        "Eliminar grupo",
        `Seguro que quieres eliminar "${mode.group.name}"? Las etiquetas del grupo no se eliminaran.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar", style: "destructive", onPress: () => { onDeleteGroup(mode.group.id); onClose(); } },
        ]
      );
    } else if (mode.type === "edit-tag" && onDeleteTag) {
      Alert.alert(
        "Eliminar etiqueta",
        `Seguro que quieres eliminar "${mode.tag.name}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar", style: "destructive", onPress: () => { onDeleteTag(mode.tag.id); onClose(); } },
        ]
      );
    }
  }, [mode, onDeleteGroup, onDeleteTag, onClose]);

  const canDelete =
    (mode?.type === "edit-group" && onDeleteGroup) ||
    (mode?.type === "edit-tag" && onDeleteTag);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[80%] rounded-t-3xl border-t border-white-6 bg-background">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Text className="text-[15px] font-inter-semibold text-foreground">
              {title}
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
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}
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
                placeholder={isGroupMode ? "Ej: Proyecto casa" : "Ej: Urgente"}
                placeholderTextColor={COLORS.sageDark}
                className="rounded-xl border border-white-6 bg-z-surface-2-55 px-3.5 py-2.5 text-[13px] font-inter-medium text-foreground"
                autoFocus={!isEditing}
                returnKeyType="done"
              />
            </View>

            {/* Group picker (tags only) */}
            {!isGroupMode && (
              <View>
                <Text className="text-[11px] font-inter-semibold text-z-sage-dark uppercase tracking-[2px] mb-1.5">
                  Grupo (opcional)
                </Text>
                <Pressable
                  onPress={() => setGroupPickerOpen(!groupPickerOpen)}
                  className="flex-row items-center justify-between rounded-xl border border-white-6 bg-z-surface-2-55 px-3.5 py-2.5"
                >
                  <Text
                    className={`text-[13px] font-inter-medium ${selectedGroup ? "text-foreground" : "text-z-sage-dark"}`}
                  >
                    {selectedGroup ? selectedGroup.name : "Sin grupo"}
                  </Text>
                  <ChevronDown size={14} color={COLORS.sageDark} />
                </Pressable>

                {groupPickerOpen && (
                  <View className="mt-1.5 rounded-xl border border-white-6 bg-z-surface-2-55 overflow-hidden">
                    <Pressable
                      onPress={() => { setGroupId(null); setGroupPickerOpen(false); }}
                      className={`px-3.5 py-2.5 active:bg-white/5 border-b border-white-6 ${!groupId ? "bg-z-brass-8" : ""}`}
                    >
                      <Text className={`text-[13px] font-inter-medium ${!groupId ? "text-z-brass" : "text-foreground"}`}>
                        Sin grupo
                      </Text>
                    </Pressable>
                    {groups.filter((g) => g.is_system === 0).map((group, idx, arr) => (
                      <Pressable
                        key={group.id}
                        onPress={() => { setGroupId(group.id); setGroupPickerOpen(false); }}
                        className={`flex-row items-center gap-2.5 px-3.5 py-2.5 active:bg-white/5 ${
                          idx < arr.length - 1 ? "border-b border-white-6" : ""
                        } ${groupId === group.id ? "bg-z-brass-8" : ""}`}
                      >
                        {group.color && (
                          <View
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: group.color } as ViewStyle}
                          />
                        )}
                        <Text className={`text-[13px] font-inter-medium ${groupId === group.id ? "text-z-brass" : "text-foreground"}`}>
                          {group.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Color picker */}
            <View>
              <Text className="text-[11px] font-inter-semibold text-z-sage-dark uppercase tracking-[2px] mb-1.5">
                Color {!isGroupMode ? "(opcional)" : ""}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {!isGroupMode && (
                  <Pressable
                    onPress={() => setColor(null)}
                    className={`h-9 w-9 rounded-full items-center justify-center ${
                      color === null ? "border-2 border-foreground" : "border border-white-6"
                    }`}
                    accessibilityLabel="Sin color"
                  >
                    <View className="h-6 w-6 rounded-full bg-z-sage-dark/40" />
                  </Pressable>
                )}
                {COLOR_PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setColor(preset)}
                    className={`h-9 w-9 rounded-full items-center justify-center ${
                      color === preset ? "border-2 border-foreground" : "border border-white-6"
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
                  {isEditing ? "Guardar cambios" : isGroupMode ? "Crear grupo" : "Crear etiqueta"}
                </Text>
              </Pressable>

              {isEditing && canDelete && (
                <Pressable
                  onPress={handleDelete}
                  className="flex-row items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 py-3 active:opacity-80"
                >
                  <Trash2 size={14} color="#E05545" />
                  <Text className="text-[13px] font-inter-semibold text-red-400">
                    Eliminar {isGroupMode ? "grupo" : "etiqueta"}
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
