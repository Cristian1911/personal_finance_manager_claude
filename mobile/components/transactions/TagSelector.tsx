import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { getAllTags, type TagWithGroup } from "../../lib/repositories/tags";

type Props = {
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
};

type GroupedTags = {
  groupName: string;
  groupColor: string | null;
  tags: TagWithGroup[];
};

function groupTags(tags: TagWithGroup[]): GroupedTags[] {
  const groups = new Map<string, GroupedTags>();
  for (const tag of tags) {
    const key = tag.group_name ?? "Sin grupo";
    if (!groups.has(key)) {
      groups.set(key, {
        groupName: key,
        groupColor: tag.group_color,
        tags: [],
      });
    }
    groups.get(key)!.tags.push(tag);
  }
  return Array.from(groups.values());
}

export function TagSelector({ selectedTagIds, onChange }: Props) {
  const [tags, setTags] = useState<TagWithGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const rows = await getAllTags();
        setTags(rows);
      } catch (err) {
        console.error("Failed to load tags:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  if (loading) {
    return (
      <View className="py-3 items-center">
        <ActivityIndicator size="small" color="#937844" />
      </View>
    );
  }

  if (tags.length === 0) {
    return (
      <View className="py-2">
        <Text className="text-gray-400 font-inter text-xs text-center">
          No hay tags disponibles
        </Text>
      </View>
    );
  }

  const grouped = groupTags(tags);
  const selected = new Set(selectedTagIds);

  return (
    <View>
      {grouped.map((group) => (
        <View key={group.groupName} className="mb-3">
          <Text className="text-gray-500 font-inter-medium text-xs mb-1.5">
            {group.groupName}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {group.tags.map((tag) => {
              const isSelected = selected.has(tag.id);
              const tagColor = tag.color ?? group.groupColor ?? "#6B7280";
              return (
                <Pressable
                  key={tag.id}
                  onPress={() => toggleTag(tag.id)}
                  className={`rounded-full px-2.5 py-1 border ${
                    isSelected
                      ? "border-amber-600 bg-amber-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                  style={
                    isSelected
                      ? { borderColor: "#937844", backgroundColor: "#93784410" }
                      : undefined
                  }
                >
                  <Text
                    className={`font-inter-medium text-xs ${
                      isSelected ? "text-amber-700" : "text-gray-600"
                    }`}
                    style={isSelected ? { color: "#937844" } : undefined}
                  >
                    {tag.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
