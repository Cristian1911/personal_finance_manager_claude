import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { Plus, X } from "lucide-react-native";
import { MobileHeader } from "../components/ui/MobileHeader";
import { COLORS } from "../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  FORM_INPUT_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../lib/constants/styles";
import { useAuth } from "../lib/auth";
import {
  createTag,
  createTagGroup,
  deleteTag,
  deleteTagGroup,
  getAllTagGroups,
  getAllTags,
  type TagGroupRow,
  type TagWithGroup,
} from "../lib/repositories/tags";

const UNGROUPED_ID = "__ungrouped__";

type GroupWithTags = {
  id: string;
  name: string;
  isSystem: boolean;
  tags: TagWithGroup[];
};

/**
 * Tags manager (`/etiquetas`) — parity with the webapp tag-manager: grouped tag
 * chips, create group, add/delete tags, delete user groups. System groups/tags
 * are read-only. Rename-group is deferred (repo `updateTagGroup` exists).
 */
export default function EtiquetasScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [groups, setGroups] = useState<GroupWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  // Draft add-tag input keyed by group id (null draft = closed).
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [rawGroups, rawTags] = await Promise.all([
        getAllTagGroups(),
        getAllTags(),
      ]);
      const groupIds = new Set(rawGroups.map((g) => g.id));
      const built: GroupWithTags[] = rawGroups.map((g: TagGroupRow) => ({
        id: g.id,
        name: g.name,
        isSystem: !!g.is_system,
        tags: rawTags.filter((t) => t.group_id === g.id),
      }));
      const ungrouped = rawTags.filter(
        (t) => !t.group_id || !groupIds.has(t.group_id)
      );
      if (ungrouped.length > 0) {
        built.push({
          id: UNGROUPED_ID,
          name: "Sin grupo",
          isSystem: true,
          tags: ungrouped,
        });
      }
      setGroups(built);
    } catch (error) {
      console.error("Failed to load tags:", error);
      Alert.alert("Error", "No se pudieron cargar las etiquetas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) return;
    if (!userId) {
      Alert.alert("Error", "No hay sesión activa.");
      return;
    }
    setCreatingGroup(true);
    try {
      await createTagGroup(userId, name);
      setNewGroupName("");
      await load();
    } catch (error) {
      console.error("Failed to create tag group:", error);
      Alert.alert("Error", "No se pudo crear el grupo.");
    } finally {
      setCreatingGroup(false);
    }
  }, [newGroupName, userId, load]);

  const handleAddTag = useCallback(
    async (groupId: string) => {
      const name = (tagDrafts[groupId] ?? "").trim();
      if (!name) return;
      if (!userId) {
        Alert.alert("Error", "No hay sesión activa.");
        return;
      }
      try {
        await createTag(userId, name, groupId === UNGROUPED_ID ? null : groupId);
        setTagDrafts((d) => ({ ...d, [groupId]: "" }));
        await load();
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error ? error.message : "No se pudo crear la etiqueta."
        );
      }
    },
    [tagDrafts, userId, load]
  );

  const handleDeleteTag = useCallback(
    (tag: TagWithGroup) => {
      Alert.alert(
        "Eliminar etiqueta",
        `¿Eliminar "${tag.name}"? Se quitará de todos los movimientos.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteTag(tag.id);
                await load();
              } catch (error) {
                console.error("Failed to delete tag:", error);
                Alert.alert("Error", "No se pudo eliminar la etiqueta.");
              }
            },
          },
        ]
      );
    },
    [load]
  );

  const handleDeleteGroup = useCallback(
    (group: GroupWithTags) => {
      Alert.alert(
        "Eliminar grupo",
        `¿Eliminar el grupo "${group.name}"? Sus etiquetas quedarán sin grupo.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteTagGroup(group.id);
                await load();
              } catch (error) {
                console.error("Failed to delete tag group:", error);
                Alert.alert("Error", "No se pudo eliminar el grupo.");
              }
            },
          },
        ]
      );
    },
    [load]
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <MobileHeader variant="sub" title="Etiquetas" />
      {loading ? (
        <View
          className="flex-1 items-center justify-center"
          accessibilityLabel="Cargando etiquetas"
        >
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 16,
            paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Create group */}
          <View className={`${PANEL_INSET_CLASS} p-4 gap-2`}>
            <Text className={SECTION_EYEBROW_CLASS}>Nuevo grupo</Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                accessibilityLabel="Nombre del nuevo grupo"
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="Ej. Contexto, Prioridad…"
                placeholderTextColor={COLORS.sageDark}
                className={`${FORM_INPUT_CLASS} flex-1`}
                onSubmitEditing={handleCreateGroup}
                returnKeyType="done"
              />
              <Pressable
                onPress={handleCreateGroup}
                disabled={creatingGroup || !newGroupName.trim()}
                accessibilityRole="button"
                accessibilityLabel="Crear grupo"
                accessibilityState={{
                  disabled: creatingGroup || !newGroupName.trim(),
                }}
                className={`${BRASS_BUTTON_CLASS} items-center justify-center rounded-xl px-4 py-3 active:opacity-80`}
                style={
                  creatingGroup || !newGroupName.trim()
                    ? { opacity: 0.5 }
                    : undefined
                }
              >
                <Plus size={18} color={COLORS.ink} />
              </Pressable>
            </View>
          </View>

          {groups.map((group) => (
            <View key={group.id} className={`${PANEL_INSET_CLASS} p-4 gap-3`}>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-inter-semibold text-foreground">
                  {group.name}
                </Text>
                {!group.isSystem && (
                  <Pressable
                    onPress={() => handleDeleteGroup(group)}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar grupo ${group.name}`}
                    hitSlop={8}
                  >
                    <X size={16} color={COLORS.debt} />
                  </Pressable>
                )}
              </View>

              {group.tags.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {group.tags.map((tag) => {
                    const removable = !tag.is_system;
                    return (
                      <View
                        key={tag.id}
                        className="flex-row items-center gap-1.5 rounded-full border border-white-6 bg-z-surface-2 px-3 py-1.5"
                      >
                        <Text className="text-[13px] font-inter-medium text-foreground">
                          {tag.name}
                        </Text>
                        {removable && (
                          <Pressable
                            onPress={() => handleDeleteTag(tag)}
                            accessibilityRole="button"
                            accessibilityLabel={`Eliminar etiqueta ${tag.name}`}
                            hitSlop={8}
                          >
                            <X size={12} color={COLORS.sageDark} />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text className="text-[12px] font-inter text-muted-foreground">
                  Sin etiquetas todavía.
                </Text>
              )}

              {!group.isSystem && (
                <View className="flex-row items-center gap-2">
                  <TextInput
                    accessibilityLabel={`Nueva etiqueta en ${group.name}`}
                    value={tagDrafts[group.id] ?? ""}
                    onChangeText={(v) =>
                      setTagDrafts((d) => ({ ...d, [group.id]: v }))
                    }
                    placeholder="Añadir etiqueta"
                    placeholderTextColor={COLORS.sageDark}
                    className={`${FORM_INPUT_CLASS} flex-1`}
                    onSubmitEditing={() => handleAddTag(group.id)}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => handleAddTag(group.id)}
                    disabled={!(tagDrafts[group.id] ?? "").trim()}
                    accessibilityRole="button"
                    accessibilityLabel={`Agregar etiqueta a ${group.name}`}
                    accessibilityState={{
                      disabled: !(tagDrafts[group.id] ?? "").trim(),
                    }}
                    className="items-center justify-center rounded-xl border border-white-6 bg-z-surface-2 px-4 py-3 active:opacity-80"
                    style={
                      !(tagDrafts[group.id] ?? "").trim()
                        ? { opacity: 0.5 }
                        : undefined
                    }
                  >
                    <Plus size={18} color={COLORS.sageLight} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
