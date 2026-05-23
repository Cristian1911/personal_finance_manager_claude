import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, UserRound, X } from "lucide-react-native";
import type { DestinatarioWithCount } from "../../lib/repositories/destinatarios";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string | null, name: string | null) => void;
  selectedId: string | null;
  destinatarios: DestinatarioWithCount[];
};

/**
 * Bottom-sheet destinatario picker. Mirrors `CategoryPicker` for visual
 * consistency. Includes a "Sin destinatario" clear option so the user can
 * unassign without leaving the sheet.
 */
export function DestinatarioPicker({
  visible,
  onClose,
  onSelect,
  selectedId,
  destinatarios,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return destinatarios;
    return destinatarios.filter((d) => d.name.toLowerCase().includes(query));
  }, [destinatarios, search]);

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
        <View className="max-h-[72%] min-h-[320px] rounded-t-2xl bg-z-surface-2-55">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-white-6">
            <Text className="text-foreground font-inter-bold text-base">
              Destinatario
            </Text>
            <Pressable
              onPress={handleClose}
              accessibilityLabel="Cerrar"
              accessibilityRole="button"
              className="w-8 h-8 items-center justify-center rounded-full bg-black-10 active:bg-black-20"
            >
              <X size={18} color="#938C7E" />
            </Pressable>
          </View>

          {/* Search */}
          <View className="px-4 py-3 border-b border-white-6">
            <TextInput
              className="bg-black-10 rounded-xl px-4 py-2.5 text-foreground font-inter text-sm"
              placeholder="Buscar destinatario..."
              placeholderTextColor="#938C7E"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {/* Clear option */}
          <Pressable
            onPress={() => handleSelect(null, null)}
            accessibilityLabel="Quitar destinatario"
            accessibilityRole="button"
            className="flex-row items-center px-4 py-3.5 border-b border-white-6 active:bg-black-10"
          >
            <View className="w-7 h-7 rounded-full bg-white-6 items-center justify-center mr-3">
              <UserRound size={14} color="#938C7E" />
            </View>
            <Text className="text-muted-foreground font-inter text-sm flex-1">
              Sin destinatario
            </Text>
            {selectedId === null && <Check size={16} color="#10B981" />}
          </Pressable>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <Pressable
                  onPress={() => handleSelect(item.id, item.name)}
                  accessibilityLabel={`Seleccionar ${item.name}`}
                  accessibilityRole="button"
                  className="flex-row items-center px-4 py-3.5 active:bg-black-10"
                >
                  <View className="w-7 h-7 rounded-full bg-z-brass-15 items-center justify-center mr-3">
                    <UserRound size={14} color="#C8B560" />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-inter text-sm ${
                        isSelected ? "text-primary font-inter-medium" : "text-foreground"
                      }`}
                    >
                      {item.name}
                    </Text>
                    {item.category_name && (
                      <Text className="text-muted-fg-50 font-inter text-xs mt-0.5">
                        {item.category_name}
                      </Text>
                    )}
                  </View>
                  {isSelected && <Check size={16} color="#10B981" />}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => (
              <View className="h-px bg-white-6 ml-4" />
            )}
            ListEmptyComponent={
              <View className="py-8 px-6">
                <Text className="text-muted-fg-50 font-inter text-sm text-center">
                  No hay destinatarios.
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}
