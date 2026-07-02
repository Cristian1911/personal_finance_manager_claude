import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import { BRASS_BUTTON_CLASS } from "../../lib/constants/styles";
import { MobileSheet } from "../ui/MobileSheet";
import {
  getAllDestinatarios,
  mergeDestinatarios,
  type DestinatarioWithCount,
} from "../../lib/repositories/destinatarios";

interface DestinatarioMergeSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Survivor — the destinatario currently open; sources merge INTO it. */
  targetId: string;
  targetName: string;
  onMerged: () => void;
}

/**
 * D3 merge picker. The current destinatario is the fixed survivor; the user
 * multi-selects the duplicates whose transactions + rules move into it (the
 * sources are then deleted) — same semantics as the webapp MergeDialog, with
 * the survivor pre-decided by context instead of a radio.
 */
export function DestinatarioMergeSheet({
  visible,
  onClose,
  targetId,
  targetName,
  onMerged,
}: DestinatarioMergeSheetProps) {
  const [options, setOptions] = useState<DestinatarioWithCount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set());
    setLoading(true);
    void (async () => {
      try {
        const all = await getAllDestinatarios();
        setOptions(all.filter((d) => d.id !== targetId));
      } catch (error) {
        console.error("Failed to load destinatarios for merge:", error);
        Alert.alert("Error", "No se pudieron cargar los destinatarios.");
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, targetId]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleMerge = useCallback(() => {
    const count = selected.size;
    if (count === 0) return;
    Alert.alert(
      "Fusionar destinatarios",
      `Los movimientos y reglas de ${count} ${
        count === 1 ? "destinatario" : "destinatarios"
      } pasarán a "${targetName}" y los originales se eliminarán. Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Fusionar",
          style: "destructive",
          onPress: async () => {
            setMerging(true);
            try {
              await mergeDestinatarios(targetId, Array.from(selected));
              onMerged();
            } catch (error) {
              console.error("Failed to merge destinatarios:", error);
              Alert.alert("Error", "No se pudo completar la fusión.");
            } finally {
              setMerging(false);
            }
          },
        },
      ]
    );
  }, [selected, targetId, targetName, onMerged]);

  return (
    <MobileSheet visible={visible} onClose={onClose}>
      <View className="flex-row items-center justify-between border-b border-white-6 px-4 pb-3">
        <Text className="text-base font-inter-bold text-foreground">
          Fusionar en “{targetName}”
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          className="h-8 w-8 items-center justify-center rounded-full bg-black-10 active:opacity-80"
        >
          <X size={16} color={COLORS.sageDark} />
        </Pressable>
      </View>

      {loading ? (
        <View className="items-center py-10" accessibilityLabel="Cargando destinatarios">
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      ) : options.length === 0 ? (
        <View className="px-4 py-8">
          <Text className="text-center text-sm font-inter text-muted-foreground">
            No hay otros destinatarios para fusionar.
          </Text>
        </View>
      ) : (
        <>
          <Text className="px-4 pt-3 text-[12px] font-inter text-muted-foreground">
            Elige los duplicados. Sus movimientos y reglas pasarán aquí.
          </Text>
          <ScrollView contentContainerStyle={{ padding: 12 }} className="max-h-96">
            {options.map((d) => {
              const isSelected = selected.has(d.id);
              return (
                <Pressable
                  key={d.id}
                  onPress={() => toggle(d.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={d.name}
                  className={`flex-row items-center gap-2.5 rounded-lg px-3 py-3 active:opacity-80 ${
                    isSelected ? "bg-z-brass-8" : ""
                  }`}
                >
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-md border ${
                      isSelected
                        ? "border-z-brass bg-z-brass-12"
                        : "border-white-6 bg-black-10"
                    }`}
                  >
                    {isSelected && <Check size={12} color={COLORS.brass} />}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-sm font-inter-medium text-foreground"
                      numberOfLines={1}
                    >
                      {d.name}
                    </Text>
                    <Text className="text-[11px] font-inter text-muted-foreground">
                      {d.transaction_count}{" "}
                      {d.transaction_count === 1 ? "movimiento" : "movimientos"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View className="border-t border-white-6 p-4">
            <Pressable
              onPress={handleMerge}
              disabled={merging || selected.size === 0}
              accessibilityRole="button"
              accessibilityLabel="Fusionar seleccionados"
              accessibilityState={{ disabled: merging || selected.size === 0 }}
              className={`${BRASS_BUTTON_CLASS} items-center rounded-xl py-3 active:opacity-80`}
              style={merging || selected.size === 0 ? { opacity: 0.5 } : undefined}
            >
              {merging ? (
                <ActivityIndicator size="small" color={COLORS.ink} />
              ) : (
                <Text className="text-sm font-inter-bold text-z-ink">
                  Fusionar{selected.size > 0 ? ` (${selected.size})` : ""}
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </MobileSheet>
  );
}
