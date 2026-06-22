import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { CalendarClock, X } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import type { CandidateOccurrence } from "../../lib/repositories/recurring";

type Props = {
  visible: boolean;
  onClose: () => void;
  candidates: CandidateOccurrence[];
  onSelect: (occurrenceId: string) => void;
  submitting?: boolean;
  txSubtitle?: string;
  /** Optional error message rendered above the candidate list — useful when
   *  the parent failed to fetch candidates and wants to surface that instead
   *  of an empty list. */
  error?: string | null;
};

function formatOccurrenceDate(d: string): string {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Bottom-sheet picker listing pending recurring occurrences a transaction
 * can be vinculated to. Mirrors webapp `LinkPickerSheet` — candidates sorted
 * by descending match score; each row shows merchant, occurrence date, and
 * expected amount.
 */
export function VincularPicker({
  visible,
  onClose,
  candidates,
  onSelect,
  submitting,
  txSubtitle,
  error,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black-40">
        <View className="max-h-[72%] min-h-[280px] rounded-t-2xl border-t border-white-6 bg-background">
          <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-white-6">
            <View>
              <Text className="text-foreground font-inter-bold text-base">
                Vincular a recurrente
              </Text>
              {txSubtitle && (
                <Text
                  className="text-muted-fg-50 font-inter text-xs mt-0.5"
                  numberOfLines={1}
                >
                  {txSubtitle}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Cerrar"
              accessibilityRole="button"
              className="w-8 h-8 items-center justify-center rounded-full bg-black-10 active:bg-black-20"
            >
              <X size={18} color={COLORS.sageDark} />
            </Pressable>
          </View>

          {error ? (
            <View className="py-10 px-6">
              <Text className="text-z-debt font-inter text-sm text-center">
                {error}
              </Text>
            </View>
          ) : candidates.length === 0 ? (
            <View className="py-10 px-6">
              <Text className="text-muted-fg-50 font-inter text-sm text-center">
                No hay ocurrencias pendientes en la misma cuenta y rango de
                fechas.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {candidates.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => onSelect(c.id)}
                  disabled={submitting}
                  accessibilityLabel={`Vincular a ${c.merchant}`}
                  accessibilityRole="button"
                  className="flex-row items-center px-4 py-3.5 border-b border-white-6 active:bg-black-10"
                  style={submitting ? { opacity: 0.5 } : undefined}
                >
                  <View className="w-9 h-9 rounded-full bg-z-brass-15 items-center justify-center mr-3">
                    <CalendarClock size={16} color={COLORS.brass} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-foreground font-inter-medium text-sm"
                      numberOfLines={1}
                    >
                      {c.merchant}
                    </Text>
                    <Text className="text-muted-foreground font-inter text-xs mt-0.5">
                      {formatOccurrenceDate(c.occurrenceDate)} ·{" "}
                      {formatCurrency(
                        c.expectedAmount,
                        c.currencyCode as CurrencyCode
                      )}{" "}
                      esperado
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
