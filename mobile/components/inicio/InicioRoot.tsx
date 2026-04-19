import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { Plus } from "lucide-react-native";
import * as Crypto from "expo-crypto";
import { useSync } from "../../lib/sync/hooks";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/constants/colors";
import { toLocalDateString } from "../../lib/utils/date";
import {
  DEFAULT_LAYOUT,
  WIDGET_CATALOG,
  type DashboardLayout,
  type PulseRange,
  type WidgetInstance,
  type WidgetType,
} from "../../lib/dashboard/widgets";
import {
  loadDashboardLayout,
  saveDashboardLayout,
} from "../../lib/dashboard/layout-storage";
import { useDashboardData } from "../../lib/dashboard/useDashboardData";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import {
  MOBILE_TAB_BAR_CLEARANCE,
  PANEL_INSET_CLASS,
} from "../../lib/constants/styles";
import { PulseWidget } from "./widgets/PulseWidget";
import { NextBillWidget } from "./widgets/NextBillWidget";
import { AccountsWidget } from "./widgets/AccountsWidget";
import { WhereTodayWidget } from "./widgets/WhereTodayWidget";
import { RecentWidget } from "./widgets/RecentWidget";
import { WidgetGrid } from "./WidgetGrid";
import { AddWidgetSheet } from "./AddWidgetSheet";

const WEEKDAY_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function formatHeaderDate(d: Date): string {
  return `${WEEKDAY_ES[d.getDay()]} · ${d.getDate()} ${MONTH_ES[d.getMonth()]}`;
}

export function InicioRoot() {
  const { sync } = useSync();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { summary, reload } = useDashboardData();

  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadDashboardLayout(userId).then(setLayout).catch(() => {});
  }, [userId]);

  const persist = useCallback(
    (next: DashboardLayout) => {
      setLayout(next);
      if (userId) saveDashboardLayout(userId, next).catch(() => {});
    },
    [userId]
  );

  const handlePulseRangeChange = useCallback(
    (next: PulseRange) => persist({ ...layout, pulseRange: next }),
    [layout, persist]
  );

  const handleRemove = useCallback(
    (id: string) =>
      persist({ ...layout, widgets: layout.widgets.filter((w) => w.id !== id) }),
    [layout, persist]
  );

  const handleAdd = useCallback(
    (type: WidgetType) => {
      const catalogEntry = WIDGET_CATALOG.find((c) => c.type === type);
      if (!catalogEntry) return;
      const instance: WidgetInstance = {
        id: Crypto.randomUUID(),
        type,
        size: catalogEntry.defaultSize,
      };
      persist({ ...layout, widgets: [...layout.widgets, instance] });
    },
    [layout, persist]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [sync, reload]);

  const existingTypes = useMemo(
    () => new Set(layout.widgets.map((w) => w.type)),
    [layout.widgets]
  );

  const today = toLocalDateString(new Date());
  const dateLabel = formatHeaderDate(new Date());

  // Pulse metric depends on selected range
  const pulseValue =
    layout.pulseRange === "weekly"
      ? Math.round(summary.spentLast7 / Math.max(1, 7))
      : summary.availablePerDay;
  const pulseDays = layout.pulseRange === "weekly" ? 7 : summary.daysRemaining;
  const pulseTrend =
    layout.pulseRange === "weekly" ? summary.spentTrend7 : summary.spentTrend30;

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="main"
        title="Zeta"
        titleFont="narrator"
        subtitle={dateLabel}
        action={
          <Pressable
            onPress={() => setEditing((e) => !e)}
            accessibilityRole="button"
            accessibilityLabel={editing ? "Terminar" : "Organizar inicio"}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="rounded-full border border-z-brass-20 bg-z-brass-10 px-2.5 py-1.5"
          >
            <Text className="text-[10px] font-inter-semibold uppercase tracking-[4px] text-z-brass">
              {editing ? "Listo" : "Organizar"}
            </Text>
          </Pressable>
        }
        right={<AvatarMenuTrigger />}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 8,
          paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {editing && (
          <View className="mb-1 flex-row items-center gap-2 rounded-xl border border-z-brass-20 bg-z-brass-8 px-3 py-2">
            <Text className="flex-1 text-[11px] font-inter text-z-brass">
              Quita widgets con × o añade más abajo · Ritmo es permanente
            </Text>
          </View>
        )}

        <PulseWidget
          availablePerDay={pulseValue}
          daysRemaining={pulseDays}
          currency={summary.currency}
          onTrack={summary.onTrack}
          range={layout.pulseRange}
          onRangeChange={handlePulseRangeChange}
          trend={pulseTrend}
        />

        <WidgetGrid
          widgets={layout.widgets}
          render={(w) => {
            const onRemove = () => handleRemove(w.id);
            switch (w.type) {
              case "next_bill":
                return (
                  <NextBillWidget
                    bill={summary.nextBill}
                    currency={summary.currency}
                    editing={editing}
                    onRemove={onRemove}
                  />
                );
              case "accounts":
                return (
                  <AccountsWidget
                    accounts={summary.accounts}
                    currency={summary.currency}
                    editing={editing}
                    onRemove={onRemove}
                  />
                );
              case "where_today":
                return (
                  <WhereTodayWidget
                    transactions={summary.transactions}
                    today={today}
                    spentToday={summary.spentToday}
                    currency={summary.currency}
                    editing={editing}
                    onRemove={onRemove}
                  />
                );
              case "recent":
                return (
                  <RecentWidget
                    transactions={summary.transactions}
                    editing={editing}
                    onRemove={onRemove}
                  />
                );
              default:
                return (
                  <View className={`${PANEL_INSET_CLASS} p-3`}>
                    <Text className="text-[11px] font-inter text-muted-foreground">
                      Widget próximamente
                    </Text>
                  </View>
                );
            }
          }}
        />

        {editing && (
          <Pressable
            onPress={() => setCatalogOpen(true)}
            accessibilityLabel="Añadir widget"
            className="mt-1 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-z-brass-30 bg-z-brass-8 py-4"
          >
            <Plus size={14} color={COLORS.brass} />
            <Text className="text-[12px] font-inter-semibold text-z-brass">
              Añadir widget
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <AddWidgetSheet
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onAdd={handleAdd}
        existingTypes={existingTypes}
      />
    </View>
  );
}
