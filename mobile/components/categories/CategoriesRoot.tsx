import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { Grid3X3, Plus } from "lucide-react-native";
import * as Crypto from "expo-crypto";
import { useSync } from "../../lib/sync/hooks";
import { useAuth } from "../../lib/auth";
import {
  getAllCategories,
  type CategoryRow as CategoryRowType,
} from "../../lib/repositories/categories";
import { getDatabase } from "../../lib/db/database";
import { COLORS } from "../../lib/constants/colors";
import { MOBILE_TAB_BAR_CLEARANCE, SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard } from "../ui/MCard";
import { CategoryRow } from "./CategoryRow";
import { CategoryFormSheet } from "./CategoryFormSheet";

/** Generate a URL-safe slug from a category name. */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "category";
}

interface CategorySection {
  parent: CategoryRowType;
  children: CategoryRowType[];
}

export function CategoriesRoot() {
  const { sync } = useSync();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<CategoryRowType[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<
    CategoryRowType | undefined
  >();

  const loadData = useCallback(async () => {
    try {
      const cats = await getAllCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Failed to load categories:", error);
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

  // Group categories by parent
  const { sections, standalone } = useMemo(() => {
    const parentMap = new Map<string, CategoryRowType>();
    const childrenMap = new Map<string, CategoryRowType[]>();

    for (const cat of categories) {
      if (!cat.parent_id) {
        parentMap.set(cat.id, cat);
      } else {
        const siblings = childrenMap.get(cat.parent_id) ?? [];
        siblings.push(cat);
        childrenMap.set(cat.parent_id, siblings);
      }
    }

    const sects: CategorySection[] = [];
    const stand: CategoryRowType[] = [];

    for (const [id, parent] of parentMap) {
      const children = childrenMap.get(id);
      if (children && children.length > 0) {
        sects.push({ parent, children });
      } else {
        stand.push(parent);
      }
    }

    return { sections: sects, standalone: stand };
  }, [categories]);

  // Parent categories for the form picker (categories without a parent that have children)
  const parentCategoriesForPicker = useMemo(() => {
    const parentIds = new Set<string>();
    for (const cat of categories) {
      if (cat.parent_id) parentIds.add(cat.parent_id);
    }
    return categories.filter(
      (cat) => !cat.parent_id && (parentIds.has(cat.id) || cat.is_system)
    );
  }, [categories]);

  // Counts
  const systemCount = useMemo(
    () => categories.filter((c) => c.is_system).length,
    [categories]
  );
  const userCount = categories.length - systemCount;

  // CRUD handlers
  const handleEdit = useCallback(
    (id: string) => {
      const cat = categories.find((c) => c.id === id);
      if (cat) {
        setEditingCategory(cat);
        setFormVisible(true);
      }
    },
    [categories]
  );

  const handleCreate = useCallback(() => {
    setEditingCategory(undefined);
    setFormVisible(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setFormVisible(false);
    setEditingCategory(undefined);
  }, []);

  const handleSave = useCallback(
    async (data: {
      id?: string;
      name: string;
      nameEs: string;
      color: string;
      parentId: string | null;
    }) => {
      try {
        const db = await getDatabase();
        const now = new Date().toISOString();

        if (data.id) {
          // UPDATE existing category
          const slug = generateSlug(data.name);
          await db.runAsync(
            "UPDATE categories SET name = ?, name_es = ?, slug = ?, color = ?, parent_id = ?, updated_at = ? WHERE id = ?",
            [data.name, data.nameEs, slug, data.color, data.parentId, now, data.id]
          );
          await db.runAsync(
            `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
            [
              "categories",
              data.id,
              "UPDATE",
              JSON.stringify({
                name: data.name,
                name_es: data.nameEs,
                slug,
                color: data.color,
                parent_id: data.parentId,
                updated_at: now,
              }),
              now,
            ]
          );
        } else {
          // INSERT new category
          const id = Crypto.randomUUID();
          const slug = generateSlug(data.name);
          await db.runAsync(
            `INSERT INTO categories (id, user_id, name, name_es, slug, color, parent_id, is_system, display_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 999, ?, ?)`,
            [id, userId, data.name, data.nameEs, slug, data.color, data.parentId, now, now]
          );
          await db.runAsync(
            `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
            [
              "categories",
              id,
              "INSERT",
              JSON.stringify({
                id,
                user_id: userId,
                name: data.name,
                name_es: data.nameEs,
                slug,
                icon: "tag",
                color: data.color,
                parent_id: data.parentId,
                is_system: false,
                display_order: 999,
                created_at: now,
              }),
              now,
            ]
          );
        }

        await loadData();
      } catch (error) {
        console.error("Failed to save category:", error);
      }
    },
    [loadData]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const db = await getDatabase();
        const now = new Date().toISOString();

        // Check if there's a pending INSERT that hasn't synced
        const pendingInsert = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM sync_queue
           WHERE table_name = 'categories' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
          [id]
        );

        await db.runAsync("DELETE FROM categories WHERE id = ?", [id]);

        if (pendingInsert) {
          // Never synced — just remove the pending INSERT
          await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [
            pendingInsert.id,
          ]);
        } else {
          // Already synced — queue a DELETE
          await db.runAsync(
            `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
             VALUES ('categories', ?, 'DELETE', ?, ?)`,
            [id, JSON.stringify({ id }), now]
          );
        }

        await loadData();
      } catch (error) {
        console.error("Failed to delete category:", error);
      }
    },
    [loadData]
  );

  const renderSection = (
    section: CategorySection,
    isLastSection: boolean
  ) => {
    const isSystem = section.parent.is_system === 1;

    return (
      <View key={section.parent.id} className={!isLastSection ? "mb-3" : ""}>
        <Text
          className={`${SECTION_EYEBROW_CLASS} mb-1.5 mt-2 px-1`}
        >
          {section.parent.name_es ?? section.parent.name}
        </Text>
        <MCard className="p-0 overflow-hidden">
          {section.children.map((child, idx) => (
            <View
              key={child.id}
              className={
                idx < section.children.length - 1
                  ? "border-b border-white-6"
                  : ""
              }
            >
              <CategoryRow
                category={child}
                isSystem={isSystem || child.is_system === 1}
                onEdit={
                  !(isSystem || child.is_system === 1)
                    ? handleEdit
                    : undefined
                }
              />
            </View>
          ))}
        </MCard>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="sub"
        title="Categorías"
        action={
          <Pressable
            onPress={handleCreate}
            className="h-8 w-8 items-center justify-center rounded-full"
            accessibilityLabel="Nueva categoría"
          >
            <Plus size={16} color={COLORS.brass} />
          </Pressable>
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
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
            <Grid3X3 size={18} color={COLORS.brass} />
          </View>
          <View className="flex-1">
            <Text className="text-[22px] font-inter-bold text-foreground">
              {categories.length}
            </Text>
            <Text className="text-[11px] font-inter text-muted-foreground">
              {systemCount} del sistema · {userCount} personalizadas
            </Text>
          </View>
        </MCard>

        {/* Grouped sections */}
        {sections.map((section, idx) =>
          renderSection(section, idx === sections.length - 1 && standalone.length === 0)
        )}

        {/* Standalone categories */}
        {standalone.length > 0 && (
          <View>
            <Text className={`${SECTION_EYEBROW_CLASS} mb-1.5 mt-2 px-1`}>
              Otras
            </Text>
            <MCard className="p-0 overflow-hidden">
              {standalone.map((cat, idx) => (
                <View
                  key={cat.id}
                  className={
                    idx < standalone.length - 1
                      ? "border-b border-white-6"
                      : ""
                  }
                >
                  <CategoryRow
                    category={cat}
                    isSystem={cat.is_system === 1}
                    onEdit={cat.is_system !== 1 ? handleEdit : undefined}
                  />
                </View>
              ))}
            </MCard>
          </View>
        )}

        {/* Empty state */}
        {categories.length === 0 && (
          <View className="items-center justify-center py-16">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-z-brass-10 mb-3">
              <Grid3X3 size={24} color={COLORS.brass} />
            </View>
            <Text className="text-[13px] font-inter-medium text-foreground mb-1">
              Sin categorías
            </Text>
            <Text className="text-[11px] font-inter text-muted-foreground text-center px-8">
              Las categorías se sincronizarán cuando te conectes
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Create/Edit form sheet */}
      <CategoryFormSheet
        visible={formVisible}
        category={editingCategory}
        parentCategories={parentCategoriesForPicker}
        onSave={handleSave}
        onDelete={
          editingCategory && editingCategory.is_system !== 1
            ? handleDelete
            : undefined
        }
        onClose={handleFormClose}
      />
    </View>
  );
}
