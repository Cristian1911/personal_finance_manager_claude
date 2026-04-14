import { Pressable, Text, View } from "react-native";
import { Check, SkipForward } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import type { OccurrenceWithTemplate } from "../../lib/repositories/recurring";
import { StateChip } from "../ui/StateChip";
import { COLORS } from "../../lib/constants/colors";

interface OccurrenceRowProps {
  occurrence: OccurrenceWithTemplate;
  onConfirm: (occurrenceId: string) => void;
  onSkip: (occurrenceId: string) => void;
}

/** String comparison for YYYY-MM-DD dates — avoids UTC timezone trap. */
function getDateColoring(occurrenceDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (occurrenceDate < today) return "text-z-debt";
  if (occurrenceDate === today) return "text-z-alert";
  return "text-muted-foreground";
}

export function OccurrenceRow({
  occurrence,
  onConfirm,
  onSkip,
}: OccurrenceRowProps) {
  const label = occurrence.merchant_name || occurrence.description || "Pago recurrente";
  const currency = (occurrence.currency_code ?? "COP") as CurrencyCode;
  const dateColor = getDateColoring(occurrence.occurrence_date);

  return (
    <View className="flex-row items-center justify-between px-3.5 py-2.5">
      {/* Left: name + date */}
      <View className="flex-1 min-w-0 mr-3">
        <Text
          className="text-sm font-inter-semibold text-foreground"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text className={`text-[11px] font-inter ${dateColor} mt-0.5`}>
          {formatDate(occurrence.occurrence_date, "dd MMM yyyy")}
        </Text>
      </View>

      {/* Right: amount + status/actions */}
      <View className="items-end gap-1.5">
        <Text className="text-sm font-inter-semibold text-foreground">
          {formatCurrency(occurrence.expected_amount, currency)}
        </Text>

        {occurrence.status === "pending" && (
          <View className="flex-row gap-1.5">
            <Pressable
              onPress={() => onConfirm(occurrence.id)}
              className="flex-row items-center gap-1 rounded-md bg-z-brass px-2 py-1"
            >
              <Check size={10} color={COLORS.ink} />
              <Text className="text-[10px] font-inter-bold text-z-ink">
                Confirmar
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSkip(occurrence.id)}
              className="flex-row items-center gap-1 rounded-md border border-white-8 bg-black-10 px-2 py-1"
            >
              <SkipForward size={10} color={COLORS.sageDark} />
              <Text className="text-[10px] font-inter-medium text-z-sage-dark">
                Omitir
              </Text>
            </Pressable>
          </View>
        )}

        {occurrence.status === "paid" && (
          <View className="flex-row items-center gap-1.5">
            <StateChip label="Pagado" variant="sage" />
            {occurrence.paid_at && (
              <Text className="text-[10px] font-inter text-muted-foreground">
                {formatDate(occurrence.paid_at, "dd MMM")}
              </Text>
            )}
          </View>
        )}

        {occurrence.status === "skipped" && (
          <StateChip label="Omitido" variant="brass" />
        )}
      </View>
    </View>
  );
}
