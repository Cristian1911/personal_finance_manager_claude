import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { Plus, RotateCcw, Settings2 } from "lucide-react-native";
import * as Crypto from "expo-crypto";
import { useSync } from "../../lib/sync/hooks";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/constants/colors";
import { toLocalDateString } from "../../lib/utils/date";
import {
  DEFAULT_LAYOUT,
  SYSTEM_INSIGHTS,
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
import { SectionDivider } from "../ui/SectionDivider";
import { MOBILE_TAB_BAR_CLEARANCE } from "../../lib/constants/styles";
import { PulseWidget } from "./widgets/PulseWidget";
import { WidgetGrid, type WidgetRender } from "./WidgetGrid";
import { ChipEyebrow } from "../ui/ExpandableChip";
import { AddWidgetSheet } from "./AddWidgetSheet";
import { renderRitmoWidget } from "./widgets/RitmoWidget";
import { renderAttentionWidget } from "./widgets/AttentionWidget";
import { renderWhereTodayWidget } from "./widgets/WhereTodayWidget";
import { renderRecentWidget } from "./widgets/RecentWidget";
import { renderPuedoComprarloWidget } from "./widgets/PuedoComprarloWidget";

const WEEKDAY_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
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
  detail: () => null,
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

  const { activeZone, toggle } = useExpandableZone<string>();

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

  const handleResetToDefault = useCallback(() => {
    persist({
      pulseRange: DEFAULT_LAYOUT.pulseRange,
      widgets: DEFAULT_LAYOUT.widgets.map((w) => ({ ...w, id: Crypto.randomUUID() })),
    });
  }, [persist]);

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

  const primaryAccount = useMemo(() => {
    const a = summary.accounts.find((x) => x.current_balance > 0);
    if (!a) return null;
    return {
      name: a.name,
      currentBalance: a.current_balance,
      currencyCode: a.currency_code as typeof summary.currency,
    };
  }, [summary.accounts, summary.currency]);

  const renderWidget = useCallback(
    (w: WidgetInstance): WidgetRender => {
      switch (w.type) {
        case "ritmo":
          return renderRitmoWidget({
            dayOfMonth: summary.dayOfMonth,
            daysInMonth: summary.daysInMonth,
            dailyAverage: summary.avgLast7 ?? null,
            currency: summary.currency,
          });
        case "attention":
          return renderAttentionWidget({
            overdue: summary.attention.overdue,
            upcoming: summary.attention.upcoming,
            pendingEmails: summary.attention.pendingEmails,
          });
        case "where_today":
          return renderWhereTodayWidget({
            transactions: summary.transactions,
            today,
            spentToday: summary.spentToday,
            spentYesterday: summary.spentYesterday,
            currency: summary.currency,
          });
        case "recent":
          return renderRecentWidget({
            transactions: summary.transactions,
          });
        case "puedo_comprarlo":
          return renderPuedoComprarloWidget();
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
        right={<AvatarMenuTrigger />}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 12,
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
        <PulseWidget
          availablePerDay={pulseValue}
          daysRemaining={pulseDays}
          currency={summary.currency}
          onTrack={summary.onTrack}
          range={layout.pulseRange}
          onRangeChange={handlePulseRangeChange}
          trend={pulseTrend}
          breakdown={{
            liquidBalance: summary.liquidBalance,
            pendingObligations: summary.pendingObligations,
            alreadySpent: summary.totalSpentThisMonth,
            availableTotal: summary.availableTotal,
            windowEndLabel: summary.daysLabel,
          }}
          primaryAccount={primaryAccount}
          nextIncome={
            summary.nextIncome
              ? {
                  name: summary.nextIncome.name,
                  amount: summary.nextIncome.amount,
                  date: summary.nextIncome.date,
                }
              : null
          }
          expanded={activeZone === "hero"}
          onToggle={() => toggle("hero")}
        />

        <SectionDivider label="Herramientas" />
        <WidgetGrid
          widgets={SYSTEM_INSIGHTS}
          activeId={activeZone}
          onToggle={toggle}
          render={renderWidget}
        />

        <SectionDivider label="Widgets" />
        <WidgetGrid
          widgets={layout.widgets}
          activeId={editing ? null : activeZone}
          onToggle={toggle}
          render={renderWidget}
          editing={editing}
          onRemove={handleRemove}
        />

        {editing && (
          <View className="gap-2">
            <Pressable
              onPress={() => setCatalogOpen(true)}
              accessibilityLabel="Añadir widget"
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-z-brass-30 bg-z-brass-8 py-3"
            >
              <Plus size={14} color={COLORS.brass} />
              <Text className="text-[12px] font-inter-semibold text-z-brass">
                Añadir widget
              </Text>
            </Pressable>
            <Pressable
              onPress={handleResetToDefault}
              accessibilityLabel="Restablecer predeterminado"
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-white-6 bg-z-surface-2-3 py-2.5"
            >
              <RotateCcw size={14} color={COLORS.sageDark} />
              <Text className="text-[11px] font-inter-semibold text-muted-foreground">
                Restablecer predeterminado
              </Text>
            </Pressable>
          </View>
        )}

        <View className="flex-row justify-center pt-1">
          <Pressable
            onPress={() => setEditing((v) => !v)}
            accessibilityLabel={
              editing ? "Terminar de organizar" : "Organizar widgets"
            }
            className={
              editing
                ? "flex-row items-center gap-1.5 rounded-full border border-z-brass-30 bg-z-brass-10 px-3 py-1.5"
                : "flex-row items-center gap-1.5 rounded-full border border-white-6 bg-z-surface-2-3 px-3 py-1.5"
            }
          >
            <Settings2
              size={12}
              color={editing ? COLORS.brass : COLORS.sageDark}
            />
            <Text
              className={
                editing
                  ? "text-[10px] font-inter-semibold uppercase tracking-[4px] text-z-brass"
                  : "text-[10px] font-inter-semibold uppercase tracking-[4px] text-muted-foreground"
              }
            >
              {editing ? "Listo" : "Organizar"}
            </Text>
          </Pressable>
        </View>
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
