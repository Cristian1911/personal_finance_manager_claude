import { Pressable, Text, View, type ViewStyle } from "react-native";
import { Lock, Pencil } from "lucide-react-native";
import type { CategoryRow as CategoryRowType } from "../../lib/repositories/categories";
import { COLORS } from "../../lib/constants/colors";
import { CategoryIcon } from "../ui/CategoryIcon";

interface CategoryRowProps {
  category: CategoryRowType;
  isSystem: boolean;
  onEdit?: (id: string) => void;
}

export function CategoryRow({ category, isSystem, onEdit }: CategoryRowProps) {
  const displayName = category.name_es ?? category.name;

  return (
    <Pressable
      onPress={!isSystem && onEdit ? () => onEdit(category.id) : undefined}
      className={`flex-row items-center gap-3 px-3.5 py-2.5 ${
        !isSystem ? "active:bg-z-surface-2/5" : ""
      }`}
      disabled={isSystem}
      accessibilityLabel={displayName}
    >
      {/* Color dot */}
      {category.color ? (
        <View
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: category.color } as ViewStyle}
        />
      ) : (
        <View className="h-3 w-3 rounded-full bg-z-sage-dark/40" />
      )}

      {/* Name */}
      <Text
        className="text-[13px] font-inter-medium text-foreground flex-1"
        numberOfLines={1}
      >
        {displayName}
      </Text>

      {/* Icon indicator */}
      {category.icon && (
        <View className="mr-1">
          <CategoryIcon icon={category.icon} size={14} color={COLORS.sageDark} />
        </View>
      )}

      {/* System lock or edit pencil */}
      {isSystem ? (
        <Lock size={12} color={COLORS.sageDark} />
      ) : onEdit ? (
        <Pencil size={12} color={COLORS.brass} />
      ) : null}
    </Pressable>
  );
}
