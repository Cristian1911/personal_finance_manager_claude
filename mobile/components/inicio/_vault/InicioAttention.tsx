import { View, Text, Pressable } from "react-native";
import { AlertTriangle, Calendar } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { MobileZone } from "../ui/MobileZone";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";

export interface AttentionOverdue {
  id: string;
  title: string;
  due_date: string;
  amount: number | null;
}

export interface AttentionPayment {
  name: string;
  amount: number;
  daysUntil: number;
  accountName: string;
}

interface InicioAttentionProps {
  overdueReminders: AttentionOverdue[];
  upcomingPayments: AttentionPayment[];
  currency: CurrencyCode;
  expanded: string | null;
  onToggle: (zone: string) => void;
}

export function InicioAttention({
  overdueReminders,
  upcomingPayments,
  currency,
  expanded,
  onToggle,
}: InicioAttentionProps) {
  const totalCount = overdueReminders.length + upcomingPayments.length;
  if (totalCount === 0) return null;

  const isVencidosActive = expanded === "attention-vencidos";
  const isPagosActive = expanded === "attention-pagos";

  return (
    <MobileZone eyebrow="ATENCION">
      {/* Chip row */}
      <View className="flex-row gap-1.5">
        {/* Vencidos chip */}
        <Pressable
          onPress={() => onToggle("attention-vencidos")}
          className={`${PANEL_INSET_CLASS} flex-1 items-center p-2.5 rounded-[14px] ${isVencidosActive ? "border-red-500-10" : ""}`}
        >
          <Text className={`text-[22px] font-inter-bold ${overdueReminders.length > 0 ? "text-z-debt" : "text-muted-foreground"}`}>
            {overdueReminders.length}
          </Text>
          <Text className="mt-0.5 text-[10px] font-inter-semibold text-muted-foreground">
            Vencidos
          </Text>
          {overdueReminders.length > 0 && (
            <View className="mt-1 flex-row items-center gap-1">
              <View className="h-1.5 w-1.5 rounded-full bg-z-debt" />
              <Text className="text-[9px] font-inter text-z-debt-70">por resolver</Text>
            </View>
          )}
        </Pressable>

        {/* Pagos chip */}
        <Pressable
          onPress={() => onToggle("attention-pagos")}
          className={`${PANEL_INSET_CLASS} flex-1 items-center p-2.5 rounded-[14px] ${isPagosActive ? "border-z-brass-30" : ""}`}
        >
          <Text className="text-[22px] font-inter-bold text-z-brass">
            {upcomingPayments.length}
          </Text>
          <Text className="mt-0.5 text-[10px] font-inter-semibold text-muted-foreground">
            Pagos
          </Text>
          <Text className="mt-1 text-[9px] font-inter text-muted-foreground">
            en 7 dias
          </Text>
        </Pressable>
      </View>

      {/* Vencidos detail panel */}
      <AnimatedAccordion expanded={isVencidosActive} estimatedHeight={300}>
        <View className={`mt-1.5 ${PANEL_INSET_CLASS} border-white-8 bg-black-20 p-3 gap-2`}>
          <Text className="text-[10px] font-inter-bold uppercase tracking-[3px] text-z-debt">
            Recordatorios vencidos
          </Text>
          {overdueReminders.slice(0, 5).map((r) => (
            <View key={r.id} className="flex-row items-center gap-2 px-1.5 py-1.5">
              <View className="h-5 w-5 items-center justify-center rounded-md bg-red-500-10">
                <AlertTriangle size={12} color={COLORS.debt} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-inter text-foreground" numberOfLines={1}>
                  {r.title}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {r.amount ? formatCurrency(r.amount, currency) : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </AnimatedAccordion>

      {/* Pagos detail panel */}
      <AnimatedAccordion expanded={isPagosActive} estimatedHeight={300}>
        <View className={`mt-1.5 ${PANEL_INSET_CLASS} border-white-8 bg-black-20 p-3 gap-2`}>
          <Text className="text-[10px] font-inter-bold uppercase tracking-[3px] text-z-brass">
            Pagos proximos
          </Text>
          {upcomingPayments.slice(0, 5).map((p, i) => (
            <View key={`${p.name}-${i}`} className="flex-row items-center gap-2 px-1.5 py-1.5">
              <View className="h-5 w-5 items-center justify-center rounded-md bg-z-brass-10">
                <Calendar size={12} color={COLORS.brass} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-inter text-foreground" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {p.daysUntil === 0 ? "Vence hoy" : `en ${p.daysUntil} dias`}
                </Text>
              </View>
              <Text className="text-xs font-inter-semibold text-foreground">
                {formatCurrency(p.amount, currency)}
              </Text>
            </View>
          ))}
        </View>
      </AnimatedAccordion>
    </MobileZone>
  );
}
