import { View, Text } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { ChipEyebrow } from "../../ui/ExpandableChip";
import { COLORS } from "../../../lib/constants/colors";
import type { WidgetRender } from "../WidgetGrid";

interface AttentionCounts {
  overdue: number;
  upcoming: number;
  pendingEmails: number;
}

export function renderAttentionWidget(props: AttentionCounts): WidgetRender {
  const { overdue, upcoming, pendingEmails } = props;
  const total = overdue + upcoming + pendingEmails;
  const tone: WidgetRender["tone"] =
    overdue > 0 ? "debt" : total > 0 ? "brass" : "foreground";

  return {
    tone,
    accessibilityLabel: total > 0 ? `Por resolver: ${total}` : "Sin pendientes",
    chip: (
      <View className="h-full flex-col items-center gap-1">
        <ChipEyebrow tone={overdue > 0 ? "debt" : "foreground"}>
          Por resolver
        </ChipEyebrow>
        {total === 0 ? (
          <View className="flex-1 flex-row items-center gap-1.5">
            <CheckCircle2 size={16} color={COLORS.income} />
            <Text className="text-[12px] font-inter-semibold text-foreground">
              Al día
            </Text>
          </View>
        ) : (
          <View className="flex-1 flex-row items-baseline gap-1.5">
            <Text className="text-[26px] font-inter-bold leading-none text-foreground">
              {total}
            </Text>
            <Text className="text-[10px] font-inter text-muted-foreground">
              {total === 1 ? "item" : "items"}
            </Text>
          </View>
        )}
        <Text
          numberOfLines={1}
          className="text-[10px] font-inter text-muted-foreground"
        >
          {overdue > 0
            ? `${overdue} vencido${overdue === 1 ? "" : "s"}`
            : upcoming > 0
              ? `${upcoming} próximo${upcoming === 1 ? "" : "s"}`
              : pendingEmails > 0
                ? `${pendingEmails} correo${pendingEmails === 1 ? "" : "s"}`
                : "Sin pendientes"}
        </Text>
      </View>
    ),
    detail: () => null,
  };
}
