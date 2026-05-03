import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, CalendarClock, CheckCircle2, Mail } from "lucide-react-native";
import { ChipEyebrow } from "../../ui/ExpandableChip";
import { ToneActionRow } from "../../ui/ToneActionRow";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
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
      <View className="flex-1 items-center justify-center gap-1.5">
        <ChipEyebrow tone={overdue > 0 ? "debt" : "foreground"}>
          Por resolver
        </ChipEyebrow>
        {total === 0 ? (
          <View className="flex-row items-center gap-1.5">
            <CheckCircle2 size={16} color={COLORS.income} />
            <Text className="text-[12px] font-inter-semibold text-foreground">
              Al día
            </Text>
          </View>
        ) : (
          <View className="flex-row items-baseline gap-1.5">
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
    detail: () => (
      <AttentionDetail
        overdue={overdue}
        upcoming={upcoming}
        pendingEmails={pendingEmails}
      />
    ),
    estimatedHeight:
      total === 0
        ? 140
        : 32 + // panel padding
          (overdue > 0 ? 64 : 0) +
          (upcoming > 0 ? 64 : 0) +
          (pendingEmails > 0 ? 64 : 0),
  };
}

function AttentionDetail({
  overdue,
  upcoming,
  pendingEmails,
}: AttentionCounts) {
  const router = useRouter();
  const total = overdue + upcoming + pendingEmails;

  if (total === 0) {
    return (
      <View className={`${PANEL_INSET_CLASS} p-4 items-center gap-2`}>
        <CheckCircle2 size={28} color={COLORS.income} />
        <Text className="text-[13px] font-inter-semibold text-foreground">
          Todo al día
        </Text>
        <Text className="text-[11px] font-inter text-muted-foreground text-center">
          No tienes pagos vencidos ni cosas pendientes por resolver.
        </Text>
      </View>
    );
  }

  return (
    <View className={`${PANEL_INSET_CLASS} p-3 gap-2`}>
      {overdue > 0 && (
        <ToneActionRow
          tone="debt"
          icon={AlertCircle}
          title={`${overdue} vencido${overdue === 1 ? "" : "s"}`}
          subtitle="Revisa los pagos atrasados"
          onPress={() => router.push("/recurrentes")}
        />
      )}
      {upcoming > 0 && (
        <ToneActionRow
          tone="brass"
          icon={CalendarClock}
          title={`${upcoming} próximo${upcoming === 1 ? "" : "s"}`}
          subtitle="Pagos o ingresos programados"
          onPress={() => router.push("/(tabs)/plan")}
        />
      )}
      {pendingEmails > 0 && (
        <ToneActionRow
          tone="foreground"
          icon={Mail}
          title={`${pendingEmails} correo${pendingEmails === 1 ? "" : "s"}`}
          subtitle="Importaciones por confirmar"
          onPress={() => router.push("/(tabs)/import")}
        />
      )}
    </View>
  );
}
