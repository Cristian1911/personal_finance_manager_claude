import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { useAuth } from "../../lib/auth";
import { useSync } from "../../lib/sync/hooks";
import {
  compute503020,
  deleteBudget,
  getBudgetProgress,
  getMonthlyIncome,
  type Allocation,
  type BudgetProgressRow,
  upsertBudget,
} from "../../lib/repositories/budgets";
import { toLocalMonthString } from "../../lib/utils/date";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import { MonthSelector } from "../common/MonthSelector";
import {
  MOBILE_TAB_BAR_CLEARANCE,
  PANEL_SURFACE_SUBTLE_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../../lib/constants/styles";
import { BudgetsHero } from "./BudgetsHero";
import { BudgetRow } from "./BudgetRow";

const CURRENCY: CurrencyCode = "COP";

/** Flattened list: section headers interleaved with rows so one FlatList keeps
 * the keyboard scroll-to-focus behaviour while showing risk-grouped sections. */
type ListRow =
  | { kind: "header"; key: string; label: string; tone: string; count: number }
  | { kind: "row"; key: string; item: BudgetProgressRow };

interface BudgetsRootProps {
  variant?: "main" | "sub";
}

export function BudgetsRoot({ variant = "main" }: BudgetsRootProps) {
  const { session } = useAuth();
  const { sync } = useSync();

  const [items, setItems] = useState<BudgetProgressRow[]>([]);
  const [income, setIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => toLocalMonthString());

  /** Guards stale setState when the month changes mid-fetch. */
  const requestIdRef = useRef(0);

  const flatListRef = useRef<FlatList<ListRow>>(null);

  /** Lift the focused budget-edit row above the keyboard — the input lives in a
   * FlatList row, out of any KeyboardAvoidingView's reach. */
  const handleInputFocus = useCallback((index: number) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({
        index,
        viewPosition: 0,
        viewOffset: 12,
        animated: true,
      });
    });
  }, []);

  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const [data, inc] = await Promise.all([
        getBudgetProgress(currentMonth),
        getMonthlyIncome(currentMonth),
      ]);
      if (requestId !== requestIdRef.current) return;
      setItems(data);
      setIncome(inc);
    } catch (error) {
      console.error("Failed to load budgets:", error);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [currentMonth]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadData]);

  const totals = useMemo(() => {
    const budgeted = items.filter((item) => item.amount > 0);
    const target = budgeted.reduce((sum, item) => sum + item.amount, 0);
    const spent = budgeted.reduce((sum, item) => sum + item.spent, 0);
    const progress = target > 0 ? (spent / target) * 100 : 0;
    return { target, spent, progress };
  }, [items]);

  const allocation = useMemo<Allocation | null>(
    () => compute503020(items, income),
    [items, income]
  );

  /** Group budgeted categories by risk state (mirrors the webapp MobileBudgetList)
   * plus a "Sin límite" group for categories with spend but no budget. */
  const sections = useMemo<ListRow[]>(() => {
    const budgeted = items.filter((i) => i.amount > 0);
    const over = budgeted
      .filter((i) => i.progress > 100)
      .sort((a, b) => b.progress - a.progress);
    const near = budgeted
      .filter((i) => i.progress >= 85 && i.progress <= 100)
      .sort((a, b) => b.progress - a.progress);
    const safe = budgeted
      .filter((i) => i.progress < 85)
      .sort((a, b) => a.progress - b.progress);
    const unbudgeted = items
      .filter((i) => i.amount <= 0)
      .sort((a, b) => b.spent - a.spent);

    const rows: ListRow[] = [];
    const push = (label: string, tone: string, group: BudgetProgressRow[]) => {
      if (group.length === 0) return;
      rows.push({ kind: "header", key: `h:${label}`, label, tone, count: group.length });
      for (const item of group) {
        rows.push({ kind: "row", key: item.id ?? item.category_id, item });
      }
    };
    push("Sobre límite", "text-z-expense", over);
    push("Cerca del límite", "text-z-brass", near);
    push("Dentro del límite", "text-z-income", safe);
    push("Sin límite", "text-muted-foreground", unbudgeted);
    return rows;
  }, [items]);

  const handleSave = useCallback(
    async (item: BudgetProgressRow, amount: number) => {
      if (!session?.user?.id) return;
      const recordId = item.id ?? item.category_id;
      setSavingId(recordId);
      try {
        await upsertBudget({
          id: item.id ?? undefined,
          user_id: session.user.id,
          category_id: item.category_id,
          amount,
          period: "monthly",
        });
        await loadData();
      } finally {
        setSavingId(null);
      }
    },
    [session?.user?.id, loadData]
  );

  const handleDelete = useCallback(
    async (item: BudgetProgressRow) => {
      if (!item.id) return;
      setSavingId(item.id);
      try {
        await deleteBudget(item.id);
        await loadData();
      } finally {
        setSavingId(null);
      }
    },
    [loadData]
  );

  const keyExtractor = useCallback((row: ListRow) => row.key, []);

  const renderItem = useCallback(
    ({ item: row, index }: { item: ListRow; index: number }) => {
      if (row.kind === "header") {
        return (
          <View className="mb-2 mt-3 flex-row items-center justify-between">
            <Text className={`${SECTION_EYEBROW_CLASS} ${row.tone}`}>
              {row.label}
            </Text>
            <Text className="text-[10px] font-inter text-muted-foreground">
              {row.count}
            </Text>
          </View>
        );
      }
      const rowId = row.item.id ?? row.item.category_id;
      return (
        <BudgetRow
          item={row.item}
          index={index}
          currency={CURRENCY}
          saving={savingId === rowId}
          onSave={handleSave}
          onDelete={handleDelete}
          onInputFocus={handleInputFocus}
        />
      );
    },
    [savingId, handleSave, handleDelete, handleInputFocus]
  );

  const listHeader = useMemo(
    () => (
      <View className="gap-3 pb-1">
        <View className="items-center">
          <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
        </View>
        <BudgetsHero
          spent={totals.spent}
          target={totals.target}
          progress={totals.progress}
          currency={CURRENCY}
          allocation={allocation}
        />
      </View>
    ),
    [currentMonth, totals.spent, totals.target, totals.progress, allocation]
  );

  const listFooter = useMemo(() => {
    if (sections.length === 0) return null;
    const remaining = totals.target - totals.spent;
    return (
      <View
        className={`${PANEL_SURFACE_SUBTLE_CLASS} mt-4 flex-row items-center justify-between px-4 py-3.5`}
      >
        <Text className="text-sm font-inter-medium text-muted-foreground">
          Restante
        </Text>
        <Text
          className={`text-base font-inter-bold ${remaining < 0 ? "text-z-debt" : "text-z-income"}`}
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {(remaining < 0 ? "-" : "") + formatCurrency(Math.abs(remaining), CURRENCY)}
        </Text>
      </View>
    );
  }, [sections.length, totals.target, totals.spent]);

  const listEmpty = useMemo(
    () => (
      <View className={`${PANEL_SURFACE_SUBTLE_CLASS} p-6`}>
        <Text className="text-center text-base font-inter-medium text-foreground">
          Aún no hay presupuestos configurados
        </Text>
        <Text className="mt-1 text-center text-sm font-inter text-muted-foreground">
          Toca una categoría con gasto para fijar su tope mensual.
        </Text>
      </View>
    ),
    []
  );

  const header =
    variant === "sub" ? (
      <MobileHeader variant="sub" title="Presupuestos" />
    ) : (
      <MobileHeader variant="main" title="Presupuestos" right={<AvatarMenuTrigger />} />
    );

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        {header}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {header}

      <FlatList
        ref={flatListRef}
        data={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
        automaticallyAdjustKeyboardInsets
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          flatListRef.current?.scrollToOffset({
            offset: averageItemLength * index,
            animated: true,
          });
        }}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
      />
    </View>
  );
}
