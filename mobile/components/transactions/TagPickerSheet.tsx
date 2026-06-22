import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import { BRASS_BUTTON_CLASS } from "../../lib/constants/styles";
import { MODAL_SCRIM_COLOR } from "../ui/MobileSheet";
import { TagSelector } from "./TagSelector";
import { getTagsForTransaction } from "../../lib/repositories/tags";

type Props = {
  visible: boolean;
  transactionId: string | null;
  onClose: () => void;
  onSave: (tagIds: string[]) => Promise<void> | void;
};

/**
 * Bottom-sheet wrapper around `TagSelector` for the Movimientos row-expand
 * Etiquetas chip. Mirrors webapp's `TagZonePicker variant="drawer" compact`
 * affordance — a chip on the row opens this sheet, user toggles tags,
 * presses Guardar to persist. Sheet stays open if save throws so the user
 * can retry without losing the staged toggles.
 */
export function TagPickerSheet({ visible, transactionId, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !transactionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const rows = await getTagsForTransaction(transactionId);
        if (!cancelled) setSelectedTagIds(rows.map((r) => r.id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, transactionId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedTagIds);
      onClose();
    } catch {
      // Parent rethrows on failure; keep the sheet open so the user sees
      // their pending toggles weren't committed and can retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: MODAL_SCRIM_COLOR }}
      >
        <View
          className="max-h-[80%] min-h-[420px] rounded-t-2xl border border-white-6 bg-background"
          style={{ paddingBottom: insets.bottom }}
        >
          <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
            <Text className="font-inter-semibold text-base text-foreground">
              Etiquetas
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Cerrar"
              accessibilityRole="button"
              className="h-8 w-8 items-center justify-center rounded-full active:bg-black-10"
            >
              <X size={18} color={COLORS.sageDark} />
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
          >
            {loading ? (
              <View className="py-12 items-center">
                <Text className="text-sm font-inter text-muted-foreground">
                  Cargando…
                </Text>
              </View>
            ) : (
              <TagSelector
                selectedTagIds={selectedTagIds}
                onChange={setSelectedTagIds}
              />
            )}
          </ScrollView>

          <View className="px-4 pb-4 pt-2">
            <Pressable
              onPress={handleSave}
              disabled={saving || loading}
              accessibilityLabel="Guardar etiquetas"
              accessibilityRole="button"
              className={`items-center rounded-full py-3 ${BRASS_BUTTON_CLASS} ${saving || loading ? "opacity-40" : ""}`}
            >
              <Text className="text-sm font-inter-semibold text-z-ink">
                {saving ? "Guardando…" : "Guardar"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
