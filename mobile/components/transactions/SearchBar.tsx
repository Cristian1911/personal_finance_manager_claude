import { View, TextInput } from "react-native";
import { Search, X } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";

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
    <View className="flex-row items-center bg-white rounded-lg px-3 py-2.5 mx-4 mt-3 mb-2 border border-gray-200">
      <Search size={18} color="#9CA3AF" />
      <TextInput
        className="flex-1 ml-2 text-gray-900 font-inter text-sm"
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={handleChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <X size={18} color="#9CA3AF" onPress={handleClear} />
      )}
    </View>
  );
}
