import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { Users, ArrowDownLeft, ArrowUpRight, AlertCircle } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import {
  getActivePersonalDebts,
  type PersonalDebtWithDetails,
} from "../../lib/repositories/personal-debts";
import { COLORS } from "../../lib/constants/colors";
import { MOBILE_TAB_BAR_CLEARANCE, SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard } from "../ui/MCard";

export function PersonasRoot() {
  const { sync } = useSync();

  const [refreshing, setRefreshing] = useState(false);
  const [debts, setDebts] = useState<PersonalDebtWithDetails[]>([]);

  const loadData = useCallback(async () => {
    try {
      const data = await getActivePersonalDebts();
      setDebts(data);
    } catch (error) {
      console.error("Failed to load personal debts:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadData();
    } catch (error) {
      console.error("Failed to refresh personal debts:", error);
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadData]);

  const { iOwe, owedToMe, iOweTotal, owedToMeTotal } = useMemo(() => {
    const borrowed = debts.filter((d) => d.direction === "borrowed");
    const lent = debts.filter((d) => d.direction === "lent");
    const sum = (xs: PersonalDebtWithDetails[]) =>
      xs.reduce((s, d) => s + d.outstanding_amount, 0);
    return {
      iOwe: borrowed,
      owedToMe: lent,
      iOweTotal: sum(borrowed),
      owedToMeTotal: sum(lent),
    };
  }, [debts]);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Personas" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {debts.length === 0 ? (
          <View className="items-center justify-center py-16">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-z-brass-10 mb-3">
              <Users size={24} color={COLORS.brass} />
            </View>
            <Text className="text-[13px] font-inter-medium text-foreground mb-1">
              No hay deudas con personas
            </Text>
            <Text className="text-[11px] font-inter text-muted-foreground text-center px-8">
              Registra dinero que prestaste o que te prestaron desde la versión web.
            </Text>
          </View>
        ) : (
          <>
            {/* Resumen */}
            <View className="flex-row gap-3">
              <MCard className="flex-1 gap-1">
                <Text className="text-[11px] font-inter text-muted-foreground">Debo</Text>
                <Text className="text-[18px] font-inter-bold tabular-nums text-z-debt">
                  {formatCurrency(iOweTotal, "COP")}
                </Text>
              </MCard>
              <MCard className="flex-1 gap-1">
                <Text className="text-[11px] font-inter text-muted-foreground">Me deben</Text>
                <Text className="text-[18px] font-inter-bold tabular-nums text-z-income">
                  {formatCurrency(owedToMeTotal, "COP")}
                </Text>
              </MCard>
            </View>

            {iOwe.length > 0 && (
              <DebtSection
                eyebrow="DEBO"
                debts={iOwe}
                accent={COLORS.debt}
                iconBgClass="bg-z-debt-12"
                Icon={ArrowUpRight}
              />
            )}

            {owedToMe.length > 0 && (
              <DebtSection
                eyebrow="ME DEBEN"
                debts={owedToMe}
                accent={COLORS.income}
                iconBgClass="bg-z-income-12"
                Icon={ArrowDownLeft}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DebtSection({
  eyebrow,
  debts,
  accent,
  iconBgClass,
  Icon,
}: {
  eyebrow: string;
  debts: PersonalDebtWithDetails[];
  accent: string;
  iconBgClass: string;
  Icon: typeof ArrowUpRight;
}) {
  return (
    <View>
      <Text className={`mb-2 ${SECTION_EYEBROW_CLASS}`}>{eyebrow}</Text>
      <MCard className="p-0 overflow-hidden">
        {debts.map((d, idx) => (
          <View
            key={d.id}
            className={`flex-row items-center gap-3 px-4 py-3 ${
              idx < debts.length - 1 ? "border-b border-white-6" : ""
            }`}
          >
            <View
              className={`h-9 w-9 items-center justify-center rounded-full ${iconBgClass}`}
            >
              <Icon size={16} color={accent} />
            </View>

            <View className="min-w-0 flex-1">
              <Text
                className="text-[13px] font-inter-medium text-foreground"
                numberOfLines={1}
              >
                {d.destinatario_name ?? "—"}
              </Text>
              {d.is_overdue && d.due_date ? (
                <View className="mt-0.5 flex-row items-center gap-1 self-start rounded-md bg-z-debt-12 px-1.5 py-0.5">
                  <AlertCircle size={10} color={COLORS.debt} />
                  <Text className="text-[10px] font-inter-medium text-z-debt">
                    Vencida
                  </Text>
                </View>
              ) : (
                <Text className="text-[11px] font-inter text-muted-foreground">
                  Pendiente
                </Text>
              )}
            </View>

            <Text
              className="text-[14px] font-inter-semibold tabular-nums text-foreground"
              style={{ color: accent }}
            >
              {formatCurrency(d.outstanding_amount, d.currency_code as CurrencyCode)}
            </Text>
          </View>
        ))}
      </MCard>
    </View>
  );
}
