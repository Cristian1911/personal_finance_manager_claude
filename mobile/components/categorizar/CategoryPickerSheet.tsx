import { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  type ViewStyle,
} from "react-native";
import { X } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import type { CategoryRow } from "../../lib/repositories/categories";

interface CategoryPickerSheetProps {
  categories: CategoryRow[];
  visible: boolean;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}

/**
 * Groups categories by parent. Shows parent as section header,
 * subcategories as selectable rows. Root categories (no parent)
 * that have children are section headers only.
 */
export function CategoryPickerSheet({
  categories,
  visible,
  onSelect,
  onClose,
}: CategoryPickerSheetProps) {
  // Build grouped structure: parent -> subcategories
  const grouped = useMemo(() => {
    const parentMap = new Map<string, CategoryRow>();
    const childrenMap = new Map<string | null, CategoryRow[]>();

    for (const cat of categories) {
      if (!cat.parent_id) {
        parentMap.set(cat.id, cat);
      } else {
        const siblings = childrenMap.get(cat.parent_id) ?? [];
        siblings.push(cat);
        childrenMap.set(cat.parent_id, siblings);
      }
    }

    // Build sections: parent categories that have children become headers
    const sections: Array<{ parent: CategoryRow; children: CategoryRow[] }> = [];
    // Standalone categories (no parent, no children)
    const standalone: CategoryRow[] = [];

    for (const [id, parent] of parentMap) {
      const children = childrenMap.get(id);
      if (children && children.length > 0) {
        sections.push({ parent, children });
      } else {
        standalone.push(parent);
      }
    }

    return { sections, standalone };
  }, [categories]);

  const handleSelect = useCallback(
    (categoryId: string) => {
      onSelect(categoryId);
      onClose();
    },
    [onSelect, onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[70%] rounded-t-3xl border-t border-white-6 bg-background">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Text className="text-[15px] font-inter-semibold text-foreground">
              Elegir categoría
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
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          >
            {/* Grouped sections */}
            {grouped.sections.map(({ parent, children }) => (
              <View key={parent.id} className="mb-3">
                <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark mb-1.5 mt-2">
                  {parent.name_es ?? parent.name}
                </Text>
                <View className="rounded-2xl border border-white-6 bg-z-surface-2-55 overflow-hidden">
                  {children.map((child, idx) => (
                    <Pressable
                      key={child.id}
                      onPress={() => handleSelect(child.id)}
                      className={`flex-row items-center gap-3 px-3.5 py-2.5 active:bg-z-surface-2/5 ${
                        idx < children.length - 1
                          ? "border-b border-white-6"
                          : ""
                      }`}
                    >
                      {child.color && (
                        <View
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: child.color } as ViewStyle}
                        />
                      )}
                      <Text className="text-[13px] font-inter-medium text-foreground flex-1">
                        {child.name_es ?? child.name}
                      </Text>
                      {child.icon && (
                        <Text className="text-[13px]">{child.icon}</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            {/* Standalone categories */}
            {grouped.standalone.length > 0 && (
              <View className="mb-3">
                <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark mb-1.5 mt-2">
                  Otras
                </Text>
                <View className="rounded-2xl border border-white-6 bg-z-surface-2-55 overflow-hidden">
                  {grouped.standalone.map((cat, idx) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => handleSelect(cat.id)}
                      className={`flex-row items-center gap-3 px-3.5 py-2.5 active:bg-z-surface-2/5 ${
                        idx < grouped.standalone.length - 1
                          ? "border-b border-white-6"
                          : ""
                      }`}
                    >
                      {cat.color && (
                        <View
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cat.color } as ViewStyle}
                        />
                      )}
                      <Text className="text-[13px] font-inter-medium text-foreground flex-1">
                        {cat.name_es ?? cat.name}
                      </Text>
                      {cat.icon && (
                        <Text className="text-[13px]">{cat.icon}</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
