import { View, TextInput } from "react-native";
import { Search, X } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { COLORS } from "../../lib/constants/colors";

type SearchBarProps = {
  onSearch: (query: string) => void;
  placeholder?: string;
};

export function SearchBar({
  onSearch,
  placeholder = "Buscar transacciones...",
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (text: string) => {
      setValue(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(text.trim());
      }, 300);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setValue("");
    onSearch("");
  }, [onSearch]);

  return (
    <View className="flex-row items-center bg-z-surface-2 rounded-lg px-3 py-2.5 border border-white-6">
      <Search size={18} color={COLORS.sageDark} />
      <TextInput
        className="flex-1 ml-2 text-foreground font-inter text-sm"
        placeholder={placeholder}
        placeholderTextColor={COLORS.sageDark}
        value={value}
        onChangeText={handleChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <X size={18} color={COLORS.sageDark} onPress={handleClear} />
      )}
    </View>
  );
}
