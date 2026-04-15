import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View, ScrollView, RefreshControl, type ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";
import { Tags, Plus, Lock, Pencil, FolderOpen } from "lucide-react-native";
import { useSync } from "../../lib/sync/hooks";
import { useAuth } from "../../lib/auth";
import {
  getAllTagGroups,
  getAllTags,
  createTagGroup,
  updateTagGroup,
  deleteTagGroup,
  createTag,
  updateTag,
  deleteTag,
  type TagGroupRow,
  type TagWithGroup,
  type TagRow,
} from "../../lib/repositories/tags";
import { COLORS } from "../../lib/constants/colors";
import { SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard } from "../ui/MCard";
import { TagFormSheet } from "./TagFormSheet";

type FormMode =
  | { type: "create-group" }
  | { type: "edit-group"; group: TagGroupRow }
  | { type: "create-tag"; groupId: string | null }
  | { type: "edit-tag"; tag: TagRow };

interface GroupWithTags {
  group: TagGroupRow;
  tags: TagWithGroup[];
}

export function EtiquetasRoot() {
  const { sync } = useSync();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<TagGroupRow[]>([]);
  const [tags, setTags] = useState<TagWithGroup[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([getAllTagGroups(), getAllTags()]);
      setGroups(g);
      setTags(t);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadData]);

  // Group tags by group_id
  const { grouped, ungrouped } = useMemo(() => {
    const byGroup = new Map<string, TagWithGroup[]>();
    const noGroup: TagWithGroup[] = [];

    for (const tag of tags) {
      if (tag.group_id) {
        const list = byGroup.get(tag.group_id) ?? [];
        list.push(tag);
        byGroup.set(tag.group_id, list);
      } else {
        noGroup.push(tag);
      }
    }

    const result: GroupWithTags[] = [];
    for (const group of groups) {
      result.push({ group, tags: byGroup.get(group.id) ?? [] });
    }

    return { grouped: result, ungrouped: noGroup };
  }, [groups, tags]);

  const systemCount = useMemo(() => tags.filter((t) => t.is_system).length, [tags]);
  const userCount = tags.length - systemCount;

  // Form handlers
  const openCreateGroup = useCallback(() => {
    setFormMode({ type: "create-group" });
    setFormVisible(true);
  }, []);

  const openEditGroup = useCallback((group: TagGroupRow) => {
    setFormMode({ type: "edit-group", group });
    setFormVisible(true);
  }, []);

  const openCreateTag = useCallback((groupId: string | null) => {
    setFormMode({ type: "create-tag", groupId });
    setFormVisible(true);
  }, []);

  const openEditTag = useCallback((tag: TagWithGroup) => {
    setFormMode({ type: "edit-tag", tag });
    setFormVisible(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setFormVisible(false);
    setFormMode(null);
  }, []);

  const handleSaveGroup = useCallback(
    async (data: { id?: string; name: string; color: string | null }) => {
      if (!userId) return;
      try {
        if (data.id) {
          await updateTagGroup(data.id, data.name, data.color);
        } else {
          await createTagGroup(userId, data.name, data.color);
        }
        await loadData();
      } catch (error) {
        console.error("Failed to save tag group:", error);
      }
    },
    [userId, loadData]
  );

  const handleDeleteGroup = useCallback(
    async (id: string) => {
      try {
        await deleteTagGroup(id);
        await loadData();
      } catch (error) {
        console.error("Failed to delete tag group:", error);
      }
    },
    [loadData]
  );

  const handleSaveTag = useCallback(
    async (data: { id?: string; name: string; groupId: string | null; color: string | null }) => {
      if (!userId) return;
      try {
        if (data.id) {
          await updateTag(data.id, data.name, data.groupId, data.color);
        } else {
          await createTag(userId, data.name, data.groupId, data.color);
        }
        await loadData();
      } catch (error) {
        console.error("Failed to save tag:", error);
      }
    },
    [userId, loadData]
  );

  const handleDeleteTag = useCallback(
    async (id: string) => {
      try {
        await deleteTag(id);
        await loadData();
      } catch (error) {
        console.error("Failed to delete tag:", error);
      }
    },
    [loadData]
  );

  const renderTagChip = (tag: TagWithGroup, isSystem: boolean) => {
    const tagColor = tag.color ?? tag.group_color ?? "#6B7280";
    return (
      <Pressable
        key={tag.id}
        onPress={!isSystem ? () => openEditTag(tag) : undefined}
        disabled={isSystem}
        className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1 border border-white-6"
        style={{ backgroundColor: `${tagColor}15` } as ViewStyle}
      >
        <Text className="text-[12px] font-inter-medium text-foreground">
          {tag.name}
        </Text>
        {isSystem ? (
          <Lock size={10} color={COLORS.sageDark} />
        ) : (
          <Pencil size={10} color={COLORS.brass} />
        )}
      </Pressable>
    );
  };

  const renderGroup = (item: GroupWithTags, isLast: boolean) => {
    const isSystem = item.group.is_system === 1;

    return (
      <View key={item.group.id} className={!isLast ? "mb-3" : ""}>
        <View className="flex-row items-center justify-between mb-1.5 mt-2 px-1">
          <View className="flex-row items-center gap-2">
            {item.group.color && (
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.group.color } as ViewStyle}
              />
            )}
            <Text className={SECTION_EYEBROW_CLASS}>
              {item.group.name}
            </Text>
          </View>
          {!isSystem && (
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => openCreateTag(item.group.id)}
                className="h-6 w-6 items-center justify-center"
                accessibilityLabel={`Agregar etiqueta a ${item.group.name}`}
              >
                <Plus size={12} color={COLORS.brass} />
              </Pressable>
              <Pressable
                onPress={() => openEditGroup(item.group)}
                className="h-6 w-6 items-center justify-center"
                accessibilityLabel={`Editar grupo ${item.group.name}`}
              >
                <Pencil size={10} color={COLORS.sageDark} />
              </Pressable>
            </View>
          )}
        </View>
        <MCard>
          {item.tags.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {item.tags.map((tag) => renderTagChip(tag, isSystem || tag.is_system === 1))}
            </View>
          ) : (
            <Text className="text-[11px] font-inter text-muted-foreground text-center py-2">
              Sin etiquetas en este grupo
            </Text>
          )}
        </MCard>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="sub"
        title="Etiquetas"
        action={
          <Pressable
            onPress={openCreateGroup}
            className="h-8 w-8 items-center justify-center rounded-full"
            accessibilityLabel="Nuevo grupo"
          >
            <Plus size={16} color={COLORS.brass} />
          </Pressable>
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {/* Summary card */}
        <MCard className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-z-brass-10">
            <Tags size={18} color={COLORS.brass} />
          </View>
          <View className="flex-1">
            <Text className="text-[22px] font-inter-bold text-foreground">
              {tags.length}
            </Text>
            <Text className="text-[11px] font-inter text-muted-foreground">
              {systemCount} del sistema · {userCount} personalizadas · {groups.length} grupos
            </Text>
          </View>
        </MCard>

        {/* Grouped sections */}
        {grouped.map((item, idx) =>
          renderGroup(item, idx === grouped.length - 1 && ungrouped.length === 0)
        )}

        {/* Ungrouped tags */}
        {ungrouped.length > 0 && (
          <View>
            <View className="flex-row items-center justify-between mb-1.5 mt-2 px-1">
              <View className="flex-row items-center gap-2">
                <FolderOpen size={10} color={COLORS.sageDark} />
                <Text className={SECTION_EYEBROW_CLASS}>Sin grupo</Text>
              </View>
              <Pressable
                onPress={() => openCreateTag(null)}
                className="h-6 w-6 items-center justify-center"
                accessibilityLabel="Agregar etiqueta sin grupo"
              >
                <Plus size={12} color={COLORS.brass} />
              </Pressable>
            </View>
            <MCard>
              <View className="flex-row flex-wrap gap-1.5">
                {ungrouped.map((tag) => renderTagChip(tag, tag.is_system === 1))}
              </View>
            </MCard>
          </View>
        )}

        {/* Empty state */}
        {tags.length === 0 && groups.length === 0 && (
          <View className="items-center justify-center py-16">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-z-brass-10 mb-3">
              <Tags size={24} color={COLORS.brass} />
            </View>
            <Text className="text-[13px] font-inter-medium text-foreground mb-1">
              Sin etiquetas
            </Text>
            <Text className="text-[11px] font-inter text-muted-foreground text-center px-8">
              Las etiquetas se sincronizaran cuando te conectes, o crea un grupo nuevo
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Form sheet */}
      <TagFormSheet
        visible={formVisible}
        mode={formMode}
        groups={groups}
        onSaveGroup={handleSaveGroup}
        onDeleteGroup={handleDeleteGroup}
        onSaveTag={handleSaveTag}
        onDeleteTag={handleDeleteTag}
        onClose={handleCloseForm}
      />
    </View>
  );
}
