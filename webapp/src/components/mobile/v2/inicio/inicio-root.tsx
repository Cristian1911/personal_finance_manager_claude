"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { InicioStarter } from "./inicio-starter";
import { WidgetGrid, type WidgetRender } from "./widget-grid";
import { AddWidgetSheet } from "./add-widget-sheet";
import { SectionDivider } from "./section-divider";
import { WidgetEditSheet } from "./widget-edit-sheet";
import { renderAttentionWidget } from "./widgets/attention-widget";
import { renderRitmoWidget } from "./widgets/ritmo-widget";
import { renderWhereTodayWidget } from "./widgets/where-today-widget";
import {
  renderRecentWidget,
  type RecentActivityTx,
} from "./widgets/recent-widget";
import { renderPuedoComprarloWidget } from "./widgets/puedo-comprarlo-widget";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { useLiveDashboard } from "@/hooks/use-live-metrics";
import { cn } from "@/lib/utils";
import {
  ARRANGEABLE_TYPES,
  DEFAULT_LAYOUT,
  SYSTEM_INSIGHTS,
  WIDGET_CATALOG,
  type DashboardLayout,
  type WidgetInstance,
  type WidgetSize,
  type WidgetType,
} from "@/lib/dashboard/widgets";
import { updateMobileLayout } from "@/actions/dashboard-config";
import type { LiveDashboardData } from "@/actions/live-dashboard";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";
import type { UpcomingIncomeItem } from "./timeline-model";
import type { MobileDashboardLayout } from "@/types/dashboard-config";

export interface InicioRootProps {
  hero: {
    availablePerDay: number;
    availableTotal: number;
    daysRemaining: number;
    currency: CurrencyCode;
    nextIncomeDate?: string | null;
    nextIncomeAmount?: number;
    nextIncomeName?: string | null;
    incomeConfigured?: boolean;
    breakdown?: {
      totalLiquid: number;
      fixedExpenses: number;
      alreadySpent: number;
    };
    primaryAccount?: {
      id: string;
      name: string;
      currentBalance: number;
      currencyCode: CurrencyCode;
    };
  };
  metrics: {
    daysInMonth: number;
    dayOfMonth: number;
    spentToday: number;
    spentYesterday: number;
    avgLast7: number;
    currency: CurrencyCode;
    /** Last-7 OUTFLOW per day (oldest → newest), used for the Pulse sparkline. */
    last7Spend: number[];
  };
  attentionItems: {
    overdueReminders: LiveDashboardData["attention"]["overdueReminders"];
    upcomingPayments: LiveDashboardData["attention"]["upcomingPayments"];
    pendingEmails: LiveDashboardData["attention"]["pendingEmails"];
  };
  upcomingIncome: UpcomingIncomeItem[];
  burnRateData: BurnRateResponse | null;
  totalBudget: number;
  starterMode: boolean;
  daysSinceImport: number;
  recentTransactions: RecentActivityTx[];
  currency: CurrencyCode;
  /** Server-saved layout. Undefined → DEFAULT_LAYOUT. */
  initialLayout?: MobileDashboardLayout;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `w-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function normalizeLayout(
  layout: MobileDashboardLayout | undefined,
): DashboardLayout {
  if (!layout) return DEFAULT_LAYOUT;
  // Keep only arrangeable widget types. Drops system widgets that may have
  // leaked into older saved layouts, plus unknown types from deprecated catalogs.
  const widgets = layout.widgets
    .filter((w) => ARRANGEABLE_TYPES.has(w.type))
    .map((w) => ({
      id: w.id,
      type: w.type as WidgetInstance["type"],
      size: w.size,
    }));
  if (widgets.length === 0) return DEFAULT_LAYOUT;
  return {
    pulseRange: layout.pulseRange,
    widgets,
  };
}

export function InicioRoot({
  hero,
  metrics,
  attentionItems,
  upcomingIncome,
  burnRateData,
  starterMode,
  daysSinceImport,
  recentTransactions,
  currency,
  initialLayout,
}: InicioRootProps) {
  const router = useRouter();
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    normalizeLayout(initialLayout),
  );
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [, startPersist] = useTransition();
  const { activeZone, toggle } = useExpandableZone<string>();

  const editingIndex = editingWidgetId
    ? layout.widgets.findIndex((w) => w.id === editingWidgetId)
    : -1;
  const editingWidget = editingIndex >= 0 ? layout.widgets[editingIndex] : null;

  // Lock body scroll whenever any chip is expanded so the inline accordion
  // doesn't fight touch gestures inside horizontal-scroll widget details.
  useEffect(() => {
    if (!activeZone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeZone]);

  const live = useLiveDashboard(
    {
      hero: {
        availablePerDay: hero.availablePerDay,
        availableTotal: hero.availableTotal,
        daysRemaining: hero.daysRemaining,
        nextIncomeDate: hero.nextIncomeDate ?? null,
        nextIncomeAmount: hero.nextIncomeAmount ?? 0,
        nextIncomeName: hero.nextIncomeName ?? null,
        incomeConfigured: hero.incomeConfigured ?? false,
        breakdown: hero.breakdown ?? {
          totalLiquid: 0,
          fixedExpenses: 0,
          alreadySpent: 0,
        },
      },
      metrics: {
        spentToday: metrics.spentToday,
        spentYesterday: metrics.spentYesterday,
        avgLast7: metrics.avgLast7,
      },
      attention: attentionItems,
    },
    currency,
  );

  const persist = useCallback(
    (next: DashboardLayout) => {
      // Optimistic update — roll back to the snapshot if the server rejects the save.
      setLayout((prev) => {
        startPersist(async () => {
          const result = await updateMobileLayout({
            pulseRange: next.pulseRange,
            widgets: next.widgets.map((w) => ({
              id: w.id,
              type: w.type,
              size: w.size,
            })),
          });
          if (!result.success) {
            console.error("updateMobileLayout failed", result.error);
            setLayout(prev);
            toast.error(result.error ?? "No se pudo guardar tu layout");
          }
        });
        return next;
      });
    },
    [],
  );

  const handleRemove = useCallback(
    (id: string) =>
      persist({ ...layout, widgets: layout.widgets.filter((w) => w.id !== id) }),
    [layout, persist],
  );

  const handleAdd = useCallback(
    (type: WidgetType) => {
      const entry = WIDGET_CATALOG.find((c) => c.type === type);
      if (!entry) return;
      const instance: WidgetInstance = {
        id: generateId(),
        type,
        size: entry.defaultSize,
      };
      persist({ ...layout, widgets: [...layout.widgets, instance] });
    },
    [layout, persist],
  );

  const handleMove = useCallback(
    (id: string, delta: -1 | 1) => {
      const widgets = [...layout.widgets];
      const idx = widgets.findIndex((w) => w.id === id);
      const target = idx + delta;
      if (idx === -1 || target < 0 || target >= widgets.length) return;
      [widgets[idx], widgets[target]] = [widgets[target], widgets[idx]];
      persist({ ...layout, widgets });
    },
    [layout, persist],
  );

  const handleResize = useCallback(
    (id: string, size: WidgetSize) => {
      const current = layout.widgets.find((w) => w.id === id);
      if (!current || current.size === size) return;
      const widgets = layout.widgets.map((w) =>
        w.id === id ? { ...w, size } : w,
      );
      persist({ ...layout, widgets });
    },
    [layout, persist],
  );

  const handleResetToDefault = useCallback(() => {
    persist({
      pulseRange: DEFAULT_LAYOUT.pulseRange,
      widgets: DEFAULT_LAYOUT.widgets.map((w) => ({
        ...w,
        id: generateId(),
      })),
    });
  }, [persist]);

  const existingTypes = useMemo(
    () => new Set(layout.widgets.map((w) => w.type)),
    [layout.widgets],
  );

  const renderWidget = useCallback(
    (w: WidgetInstance): WidgetRender => {
      switch (w.type) {
        case "attention":
          return renderAttentionWidget({
            overdueReminders: live.attention.overdueReminders,
            upcomingPayments: live.attention.upcomingPayments,
            pendingEmails: live.attention.pendingEmails,
            upcomingIncome,
            currency,
            daysSinceImport,
          });
        case "ritmo":
          return renderRitmoWidget({
            dayOfMonth: metrics.dayOfMonth,
            daysInMonth: metrics.daysInMonth,
            burnRateData,
            currency,
          });
        case "where_today":
          return renderWhereTodayWidget({
            spentToday: live.metrics.spentToday,
            spentYesterday: live.metrics.spentYesterday,
            avgLast7: live.metrics.avgLast7,
            currency,
          });
        case "recent":
          return renderRecentWidget({ transactions: recentTransactions });
        case "puedo_comprarlo":
          return renderPuedoComprarloWidget({
            onOpen: () => router.push("/puedo-pagar"),
          });
        default:
          return {
            tone: "muted",
            accessibilityLabel: "Widget próximamente",
            chip: (
              <div className="flex h-full flex-col justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Widget
                </p>
                <p className="text-[12px] text-muted-foreground">Próximamente</p>
              </div>
            ),
            detail: null,
          };
      }
    },
    [
      live.attention.overdueReminders,
      live.attention.upcomingPayments,
      live.attention.pendingEmails,
      live.metrics.spentToday,
      live.metrics.spentYesterday,
      live.metrics.avgLast7,
      upcomingIncome,
      currency,
      daysSinceImport,
      metrics.dayOfMonth,
      metrics.daysInMonth,
      burnRateData,
      recentTransactions,
      router,
    ],
  );

  if (starterMode) {
    return (
      <div className="space-y-2">
        <InicioStarter />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Old PulseWidget hero ("ESTE MES · PULSO") removed 2026-05-21.
          Replaced by the V7 HybridHero rendered above this component in
          MobileZone (Option A predictive-runway canonical, see #264).
          The `hero` + `metrics` props are still received but their hero-
          related fields are no longer rendered here; `metrics.last7Spend`
          is still consumed by downstream widgets if any. The PulseWidget
          component file is kept as a 1-line rollback target if needed. */}

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
        onEdit={setEditingWidgetId}
      />

      {editing && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-z-brass/30 bg-z-brass/5 py-3 text-[12px] font-semibold text-z-brass transition-colors active:bg-z-brass/10"
          >
            <Plus className="size-3.5" />
            Añadir widget
          </button>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/6 bg-white/[0.02] py-2.5 text-[11px] font-semibold text-muted-foreground transition-colors active:bg-white/[0.05]"
          >
            <RotateCcw className="size-3.5" />
            Restablecer predeterminado
          </button>
        </div>
      )}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label={editing ? "Terminar de organizar" : "Organizar widgets"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors",
            editing
              ? "border-z-brass/30 bg-z-brass/10 text-z-brass"
              : "border-white/6 bg-white/[0.02] text-muted-foreground active:bg-white/[0.05]",
          )}
        >
          <Settings2 className="size-3" />
          {editing ? "Listo" : "Organizar"}
        </button>
      </div>

      <AddWidgetSheet
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onAdd={handleAdd}
        existingTypes={existingTypes as Set<WidgetType>}
      />

      <WidgetEditSheet
        open={Boolean(editingWidget)}
        onOpenChange={(open) => {
          if (!open) setEditingWidgetId(null);
        }}
        widget={editingWidget}
        canMoveUp={editingIndex > 0}
        canMoveDown={
          editingIndex >= 0 && editingIndex < layout.widgets.length - 1
        }
        onMoveUp={() => {
          if (!editingWidgetId) return;
          handleMove(editingWidgetId, -1);
        }}
        onMoveDown={() => {
          if (!editingWidgetId) return;
          handleMove(editingWidgetId, 1);
        }}
        onResize={(size) => {
          if (!editingWidgetId) return;
          handleResize(editingWidgetId, size);
        }}
        onRemove={() => {
          if (!editingWidgetId) return;
          handleRemove(editingWidgetId);
          setEditingWidgetId(null);
        }}
      />

    </div>
  );
}
