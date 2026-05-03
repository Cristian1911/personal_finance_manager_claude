import { Pressable, Text, View } from "react-native";
import { ChevronRight, Store } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";

interface DestinatarioRowProps {
  id: string;
  name: string;
  categoryName: string | null;
  transactionCount: number;
  onPress: (id: string) => void;
}

export function DestinatarioRow({
  id,
  name,
  categoryName,
  transactionCount,
  onPress,
}: DestinatarioRowProps) {
  return (
    <Pressable
      onPress={() => onPress(id)}
      className="flex-row items-center px-3.5 py-2.5 active:bg-z-surface-2-4"
      accessibilityLabel={`Ver detalles de ${name}`}
    >
      {/* Left: icon + name + category */}
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-z-brass-10 mr-3">
        <Store size={16} color={COLORS.brass} />
      </View>

      <View className="flex-1 min-w-0 mr-3">
        <Text
          className="text-sm font-inter-semibold text-foreground"
          numberOfLines={1}
        >
          {name}
        </Text>
        {categoryName && (
          <Text
            className="text-[10px] font-inter text-z-brass mt-0.5 rounded-full bg-z-brass-8 self-start px-2 py-0.5 overflow-hidden"
            numberOfLines={1}
          >
            {categoryName}
          </Text>
        )}
      </View>

      {/* Right: count badge + chevron */}
      <View className="flex-row items-center gap-2">
        {transactionCount > 0 && (
          <View className="rounded-full bg-z-surface-2-8 px-2 py-0.5">
            <Text className="text-[10px] font-inter-medium text-muted-foreground">
              {transactionCount}
            </Text>
          </View>
        )}
        <ChevronRight size={14} color={COLORS.sageDark} />
      </View>
    </Pressable>
  );
}
