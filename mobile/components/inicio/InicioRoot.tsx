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
import { useExpandableZone } from "../ui/useExpandableZone";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import { MOBILE_TAB_BAR_CLEARANCE } from "../../lib/constants/styles";
import { PulseWidget } from "./widgets/PulseWidget";
import { WidgetGrid, type WidgetRender } from "./WidgetGrid";
import { ChipEyebrow } from "../ui/ExpandableChip";
import { AddWidgetSheet } from "./AddWidgetSheet";
import { renderAccountsWidget } from "./widgets/AccountsWidget";
import { renderNextBillWidget } from "./widgets/NextBillWidget";
import { renderNextIncomeWidget } from "./widgets/NextIncomeWidget";
import { renderWhereTodayWidget } from "./widgets/WhereTodayWidget";
import { renderRecentWidget } from "./widgets/RecentWidget";

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

const UNKNOWN_RENDER: WidgetRender = {
  tone: "foreground",
  accessibilityLabel: "Widget",
  chip: (
    <View>
      <ChipEyebrow tone="foreground">Widget</ChipEyebrow>
      <Text className="mt-2 text-[20px] font-inter-bold text-z-sage-dark">
        —
      </Text>
      <Text className="mt-1 text-[10px] font-inter text-muted-foreground">
        Próximamente
      </Text>
    </View>
  ),
  detail: null,
};

export function InicioRoot() {
  const { sync } = useSync();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { summary, reload } = useDashboardData();

  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const { activeZone, toggle, close } = useExpandableZone<string>();

  useEffect(() => {
    if (!userId) return;
    loadDashboardLayout(userId).then(setLayout).catch(() => {});
  }, [userId]);

  // Close any open chip when entering/leaving edit mode
  useEffect(() => {
    close();
  }, [editing, close]);

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

  const pulseValue =
    layout.pulseRange === "weekly"
      ? Math.round(summary.spentLast7 / Math.max(1, 7))
      : summary.availablePerDay;
  const pulseDays = layout.pulseRange === "weekly" ? 7 : summary.daysRemaining;
  const pulseTrend =
    layout.pulseRange === "weekly" ? summary.spentTrend7 : summary.spentTrend30;

  const renderWidget = useCallback(
    (w: WidgetInstance): WidgetRender => {
      switch (w.type) {
        case "accounts":
          return renderAccountsWidget({
            accounts: summary.accounts,
            currency: summary.currency,
          });
        case "next_bill":
          return renderNextBillWidget({
            bill: summary.nextBill,
            upcoming: summary.upcomingBills,
            currency: summary.currency,
          });
        case "next_income":
          return renderNextIncomeWidget({
            income: summary.nextIncome,
            upcoming: summary.upcomingIncomes,
            currency: summary.currency,
          });
        case "where_today":
          return renderWhereTodayWidget({
            transactions: summary.transactions,
            today,
            spentToday: summary.spentToday,
            currency: summary.currency,
          });
        case "recent":
          return renderRecentWidget({
            transactions: summary.transactions,
          });
        default:
          return UNKNOWN_RENDER;
      }
    },
    [summary, today]
  );

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
              Quita chips con × o añade más abajo · Ritmo es permanente
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
          activeId={editing ? null : activeZone}
          onToggle={toggle}
          render={renderWidget}
          editing={editing}
          onRemove={handleRemove}
        />

        {editing && (
          <Pressable
            onPress={() => setCatalogOpen(true)}
            accessibilityLabel="Añadir chip"
            className="mt-1 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-z-brass-30 bg-z-brass-8 py-4"
          >
            <Plus size={14} color={COLORS.brass} />
            <Text className="text-[12px] font-inter-semibold text-z-brass">
              Añadir chip
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
