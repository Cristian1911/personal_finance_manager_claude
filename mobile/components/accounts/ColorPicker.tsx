import { View, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { PRESET_COLORS } from "../../lib/constants/accounts";

type Props = {
  selected: string;
  onSelect: (color: string) => void;
};

export function ColorPicker({ selected, onSelect }: Props) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {PRESET_COLORS.map((color) => {
        const isSelected = selected === color;
        return (
          <Pressable
            key={color}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-80"
            style={{
              backgroundColor: color,
              borderWidth: isSelected ? 3 : 0,
              borderColor: "#FFFFFF",
              shadowColor: isSelected ? color : "transparent",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: isSelected ? 0.6 : 0,
              shadowRadius: 4,
              elevation: isSelected ? 4 : 0,
            }}
            onPress={() => onSelect(color)}
          >
            {isSelected && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
          </Pressable>
        );
      })}
    </View>
  );
}
