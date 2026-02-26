import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";

export type CategoryRow = {
  id: string;
  name: string;
  name_es: string | null;
  color: string | null;
  parent_id: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string | null, name: string | null) => void;
  selectedId: string | null;
  categories: CategoryRow[];
};

type ListItem =
  | { type: "header"; item: CategoryRow }
  | { type: "row"; item: CategoryRow; indented: boolean };

function displayName(cat: CategoryRow): string {
  return cat.name_es ?? cat.name;
}

export function CategoryPicker({
  visible,
  onClose,
  onSelect,
  selectedId,
  categories,
}: Props) {
  const [search, setSearch] = useState("");

  const listItems = useMemo((): ListItem[] => {
    const query = search.toLowerCase().trim();

    if (query) {
      // Flat filtered list — all matching categories are selectable rows
      return categories
        .filter((c) => displayName(c).toLowerCase().includes(query))
        .map((item) => ({ type: "row" as const, item, indented: false }));
    }

    // Hierarchical view: roots first, then their children
    const rootIds = new Set(
      categories.filter((c) => !c.parent_id).map((c) => c.id)
    );
    const childrenByParent = new Map<string, CategoryRow[]>();
    for (const cat of categories) {
      if (cat.parent_id && rootIds.has(cat.parent_id)) {
        const arr = childrenByParent.get(cat.parent_id) ?? [];
        arr.push(cat);
        childrenByParent.set(cat.parent_id, arr);
      }
    }

    const result: ListItem[] = [];
    for (const cat of categories.filter((c) => !c.parent_id)) {
      const children = childrenByParent.get(cat.id) ?? [];
      if (children.length > 0) {
        // Show as non-selectable section header
        result.push({ type: "header", item: cat });
        for (const child of children) {
          result.push({ type: "row", item: child, indented: true });
        }
      } else {
        // No children — show as a normal selectable row
        result.push({ type: "row", item: cat, indented: false });
      }
    }

    // Orphaned children (parent not in root list)
    for (const cat of categories) {
      if (cat.parent_id && !rootIds.has(cat.parent_id)) {
        result.push({ type: "row", item: cat, indented: false });
      }
    }

    return result;
  }, [categories, search]);

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  const handleSelect = (id: string | null, name: string | null) => {
    setSearch("");
    onSelect(id, name);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end bg-black/35">
        <View className="max-h-[72%] min-h-[320px] rounded-t-2xl bg-white">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
            <Text className="text-gray-900 font-inter-bold text-base">
              Categoría
            </Text>
            <Pressable
              onPress={handleClose}
              className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
            >
              <X size={18} color="#6B7280" />
            </Pressable>
          </View>

          {/* Search */}
          <View className="px-4 py-3 border-b border-gray-100">
            <TextInput
              className="bg-gray-100 rounded-xl px-4 py-2.5 text-gray-900 font-inter text-sm"
              placeholder="Buscar categoría..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {/* "None" option */}
          <Pressable
            onPress={() => handleSelect(null, null)}
            className="flex-row items-center px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
          >
            <View className="w-3 h-3 rounded-full bg-gray-300 mr-3" />
            <Text className="text-gray-500 font-inter text-sm flex-1">
              Sin categoría
            </Text>
            {selectedId === null && <Check size={16} color="#10B981" />}
          </Pressable>

          <FlatList
            data={listItems}
            keyExtractor={(item) => item.item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              if (item.type === "header") {
                return (
                  <View className="px-4 pt-4 pb-1.5 bg-gray-50">
                    <Text className="text-gray-400 font-inter-semibold text-xs uppercase tracking-wide">
                      {displayName(item.item)}
                    </Text>
                  </View>
                );
              }

              const isSelected = item.item.id === selectedId;
              const paddingLeft = item.indented ? "pl-8" : "pl-4";

              return (
                <Pressable
                  onPress={() =>
                    handleSelect(item.item.id, displayName(item.item))
                  }
                  className={`flex-row items-center ${paddingLeft} pr-4 py-3.5 active:bg-gray-50`}
                >
                  {item.item.color ? (
                    <View
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: item.item.color }}
                    />
                  ) : (
                    <View className="w-3 h-3 rounded-full bg-gray-200 mr-3" />
                  )}
                  <Text
                    className={`font-inter text-sm flex-1 ${
                      isSelected ? "text-primary font-inter-medium" : "text-gray-900"
                    }`}
                  >
                    {displayName(item.item)}
                  </Text>
                  {isSelected && <Check size={16} color="#10B981" />}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => (
              <View className="h-px bg-gray-50 ml-4" />
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
