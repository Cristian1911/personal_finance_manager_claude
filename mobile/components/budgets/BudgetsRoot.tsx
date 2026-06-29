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
import type { CurrencyCode } from "@zeta/shared";
import { useAuth } from "../../lib/auth";
import { useSync } from "../../lib/sync/hooks";
import {
  deleteBudget,
  getBudgetProgress,
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

interface BudgetsRootProps {
  variant?: "main" | "sub";
}

export function BudgetsRoot({ variant = "main" }: BudgetsRootProps) {
  const { session } = useAuth();
  const { sync } = useSync();

  const [items, setItems] = useState<BudgetProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => toLocalMonthString());

  /** Guards stale setState when the month changes mid-fetch. */
  const requestIdRef = useRef(0);

  const flatListRef = useRef<FlatList<BudgetProgressRow>>(null);

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
      const data = await getBudgetProgress(currentMonth);
      if (requestId !== requestIdRef.current) return;
      setItems(data);
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
    const target = items.reduce((sum, item) => sum + item.amount, 0);
    const spent = items.reduce((sum, item) => sum + item.spent, 0);
    const progress = target > 0 ? (spent / target) * 100 : 0;
    return { target, spent, progress };
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

  const keyExtractor = useCallback(
    (item: BudgetProgressRow) => item.id ?? item.category_id,
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: BudgetProgressRow; index: number }) => {
      const rowId = item.id ?? item.category_id;
      return (
        <BudgetRow
          item={item}
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
      <View className="gap-3 pb-2">
        <View className="items-center">
          <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
        </View>

        <BudgetsHero
          spent={totals.spent}
          target={totals.target}
          progress={totals.progress}
          currency={CURRENCY}
        />

        <Text className={`mt-2 ${SECTION_EYEBROW_CLASS}`}>
          Presupuestos por categoría
        </Text>
        <Text className="text-xs font-inter text-muted-foreground">
          Toca una categoría para definir o editar su tope mensual.
        </Text>
      </View>
    ),
    [currentMonth, totals.spent, totals.target, totals.progress]
  );

  const listEmpty = useMemo(
    () => (
      <View className={`${PANEL_SURFACE_SUBTLE_CLASS} p-6`}>
        <Text className="text-center text-base font-inter-medium text-foreground">
          Aún no hay presupuestos configurados
        </Text>
        <Text className="mt-1 text-center text-sm font-inter text-muted-foreground">
          Crea presupuestos desde categorías en la web y aquí podrás revisarlos.
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
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
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
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
      />
    </View>
  );
}
