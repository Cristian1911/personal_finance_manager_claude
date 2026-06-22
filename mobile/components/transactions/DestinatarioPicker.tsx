import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Plus, UserRound, X } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import { useAuth } from "../../lib/auth";
import {
  createDestinatarioWithPattern,
  type DestinatarioWithCount,
} from "../../lib/repositories/destinatarios";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string | null, name: string | null) => void;
  selectedId: string | null;
  destinatarios: DestinatarioWithCount[];
};

const keyExtractor = (item: DestinatarioWithCount) => item.id;
const Separator = () => <View className="h-px bg-white-6 ml-4" />;

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
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const query = search.trim();

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return destinatarios;
    return destinatarios.filter((d) => d.name.toLowerCase().includes(q));
  }, [destinatarios, query]);

  // Offer inline creation when the search term doesn't already name a destinatario.
  const canCreate = useMemo(
    () =>
      query.length > 0 &&
      !destinatarios.some((d) => d.name.toLowerCase() === query.toLowerCase()),
    [destinatarios, query]
  );

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  const handleSelect = useCallback(
    (id: string | null, name: string | null) => {
      setSearch("");
      onSelect(id, name);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleCreate = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId || !query || creating) return;
    setCreating(true);
    try {
      const { destinatarioId } = await createDestinatarioWithPattern({
        user_id: userId,
        name: query,
      });
      handleSelect(destinatarioId, query);
    } finally {
      setCreating(false);
    }
  }, [session, query, creating, handleSelect]);

  const renderRow = useCallback(
    ({ item }: { item: DestinatarioWithCount }) => {
      const isSelected = item.id === selectedId;
      return (
        <Pressable
          onPress={() => handleSelect(item.id, item.name)}
          accessibilityLabel={`Seleccionar ${item.name}`}
          accessibilityRole="button"
          className="flex-row items-center px-4 py-3.5 active:bg-black-10"
        >
          <View className="w-7 h-7 rounded-full bg-z-brass-15 items-center justify-center mr-3">
            <UserRound size={14} color={COLORS.brass} />
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
          {isSelected && <Check size={16} color={COLORS.income} />}
        </Pressable>
      );
    },
    [selectedId, handleSelect]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end bg-black-40">
        <View className="max-h-[72%] min-h-[320px] rounded-t-2xl border border-white-6 bg-background">
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
              <X size={18} color={COLORS.sageDark} />
            </Pressable>
          </View>

          {/* Search */}
          <View className="px-4 py-3 border-b border-white-6">
            <TextInput
              className="bg-black-10 rounded-xl px-4 py-2.5 text-foreground font-inter text-sm"
              placeholder="Buscar destinatario..."
              placeholderTextColor={COLORS.sageDark}
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
              <UserRound size={14} color={COLORS.sageDark} />
            </View>
            <Text className="text-muted-foreground font-inter text-sm flex-1">
              Sin destinatario
            </Text>
            {selectedId === null && <Check size={16} color={COLORS.income} />}
          </Pressable>

          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            renderItem={renderRow}
            ItemSeparatorComponent={Separator}
            ListHeaderComponent={
              canCreate ? (
                <Pressable
                  onPress={handleCreate}
                  disabled={creating}
                  accessibilityLabel={`Crear destinatario ${query}`}
                  accessibilityRole="button"
                  className="flex-row items-center px-4 py-3.5 border-b border-white-6 active:bg-black-10"
                >
                  <View className="w-7 h-7 rounded-full bg-z-income-20 items-center justify-center mr-3">
                    {creating ? (
                      <ActivityIndicator size="small" color={COLORS.income} />
                    ) : (
                      <Plus size={14} color={COLORS.income} />
                    )}
                  </View>
                  <Text className="text-foreground font-inter text-sm flex-1">
                    Crear «{query}»
                  </Text>
                  <Text className="text-z-income font-inter-medium text-xs">
                    {creating ? "Creando…" : "Nuevo"}
                  </Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              canCreate ? null : (
                <View className="py-8 px-6">
                  <Text className="text-muted-fg-50 font-inter text-sm text-center">
                    No hay destinatarios.
                  </Text>
                </View>
              )
            }
          />
        </View>
      </View>
    </Modal>
  );
}
