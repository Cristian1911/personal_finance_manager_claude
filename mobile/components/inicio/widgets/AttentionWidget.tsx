import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, CalendarClock, CheckCircle2, Mail } from "lucide-react-native";
import { ChipEyebrow } from "../../ui/ExpandableChip";
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
    detail: () => (
      <AttentionDetail
        overdue={overdue}
        upcoming={upcoming}
        pendingEmails={pendingEmails}
      />
    ),
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
        <Pressable
          onPress={() => router.push("/recurrentes")}
          className="flex-row items-center gap-3 rounded-xl border border-z-debt-30 bg-z-debt-12 px-3 py-2.5"
        >
          <AlertCircle size={18} color={COLORS.debt} />
          <View className="flex-1">
            <Text className="text-[12px] font-inter-semibold text-z-debt">
              {overdue} vencido{overdue === 1 ? "" : "s"}
            </Text>
            <Text className="text-[10px] font-inter text-muted-foreground">
              Revisa los pagos atrasados
            </Text>
          </View>
        </Pressable>
      )}
      {upcoming > 0 && (
        <Pressable
          onPress={() => router.push("/(tabs)/plan")}
          className="flex-row items-center gap-3 rounded-xl border border-z-brass-20 bg-z-brass-8 px-3 py-2.5"
        >
          <CalendarClock size={18} color={COLORS.brass} />
          <View className="flex-1">
            <Text className="text-[12px] font-inter-semibold text-z-brass">
              {upcoming} próximo{upcoming === 1 ? "" : "s"}
            </Text>
            <Text className="text-[10px] font-inter text-muted-foreground">
              Pagos o ingresos programados
            </Text>
          </View>
        </Pressable>
      )}
      {pendingEmails > 0 && (
        <Pressable
          onPress={() => router.push("/(tabs)/import")}
          className="flex-row items-center gap-3 rounded-xl border border-white-10 bg-white-3 px-3 py-2.5"
        >
          <Mail size={18} color={COLORS.sageDark} />
          <View className="flex-1">
            <Text className="text-[12px] font-inter-semibold text-foreground">
              {pendingEmails} correo{pendingEmails === 1 ? "" : "s"}
            </Text>
            <Text className="text-[10px] font-inter text-muted-foreground">
              Importaciones por confirmar
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
