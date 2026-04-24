import { useMemo, useCallback, useRef, useState } from "react";
import { View, Text, RefreshControl, FlatList, ActivityIndicator, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { formatDate, type CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import {
  getMonthlyAggregates,
  getTopUncategorized,
  getTransactions,
  updateTransaction,
  type MonthlyAggregates,
  type TransactionListRow,
  type UncategorizedSampleRow,
} from "../../lib/repositories/transactions";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { getAllCategories, type CategoryRow } from "../../lib/repositories/categories";
import { getPreferredCurrency } from "../../lib/profile";
import { toLocalMonthString } from "../../lib/utils/date";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import { useExpandableZone } from "../ui/useExpandableZone";
import { MonthSelector } from "../common/MonthSelector";
import { MovimientosLectura } from "./MovimientosLectura";
import { MovimientosHerramientas } from "./MovimientosHerramientas";
import {
  MovimientosUtilidades,
  type MovimientosFilters,
} from "./MovimientosUtilidades";
import { MovimientosTransactionRow } from "./MovimientosTransactionRow";
import { CategoryPickerSheet } from "../categorizar/CategoryPickerSheet";
import { SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";

type ToolId = "categorizar" | "importar";
const PAGE_SIZE = 25;

type FeedItem =
  | { type: "header"; date: string }
  | { type: "row"; tx: TransactionListRow };

export function MovimientosRoot() {
  const { sync } = useSync();
  const { activeZone, toggle } = useExpandableZone<string>();

  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<TransactionListRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [aggregates, setAggregates] = useState<MonthlyAggregates>({
    count: 0,
    totalInflow: 0,
    totalOutflow: 0,
    uncategorizedCount: 0,
    daysByDate: [],
  });
  const [uncategorizedSample, setUncategorizedSample] = useState<UncategorizedSampleRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<MovimientosFilters>({
    accountId: null,
    direction: "all",
    showExcluded: false,
  });
  const [currentMonth, setCurrentMonth] = useState(() => toLocalMonthString());
  const [pickerTxId, setPickerTxId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>("COP");

  /** Bumped on every loadData call; stale in-flight results drop their setState. */
  const requestIdRef = useRef(0);
  /** Snapshot of transactions.length captured without entering loadData's dep list.
   *  loadData would otherwise recreate on every append and retrigger useFocusEffect. */
  const txCountRef = useRef(0);
  txCountRef.current = transactions.length;

  const loadData = useCallback(
    async ({ reset = true }: { reset?: boolean } = {}) => {
      const requestId = ++requestIdRef.current;
      try {
        const offset = reset ? 0 : txCountRef.current;
        const queryOpts = {
          search: searchQuery || undefined,
          month: currentMonth,
          accountId: filters.accountId ?? undefined,
          limit: PAGE_SIZE,
          offset,
        };

        if (reset) {
          const [txs, accts, cats, agg, sample, preferredCurrency] = await Promise.all([
            getTransactions(queryOpts),
            getAllAccounts(),
            getAllCategories(),
            getMonthlyAggregates({
              month: currentMonth,
              accountId: filters.accountId ?? undefined,
            }),
            getTopUncategorized({
              month: currentMonth,
              accountId: filters.accountId ?? undefined,
              limit: 5,
            }),
            getPreferredCurrency(),
          ]);
          if (requestId !== requestIdRef.current) return;
          setTransactions(txs);
          setAccounts(accts);
          setCategories(cats);
          setAggregates(agg);
          setUncategorizedSample(sample);
          setCurrency(preferredCurrency);
          setHasMore(txs.length === PAGE_SIZE);
        } else {
          const page = await getTransactions(queryOpts);
          if (requestId !== requestIdRef.current) return;
          setTransactions((prev) => [...prev, ...page]);
          setHasMore(page.length === PAGE_SIZE);
        }
      } catch (error) {
        console.error("Failed to load movimientos data:", error);
      }
    },
    [searchQuery, currentMonth, filters.accountId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadData({ reset: true });
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadData({ reset: true });
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadData]);

  const handleEndReached = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadData({ reset: false });
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loadData]);

  /** Post-SQL filters (direction, showExcluded) — accountId handled server-side.
   *  These only affect which rows render in the feed; monthly summary totals come
   *  from getMonthlyAggregates (SQL, unaffected by pagination or client filters). */
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (!filters.showExcluded && tx.is_excluded) return false;
      if (filters.direction !== "all" && tx.direction !== filters.direction)
        return false;
      return true;
    });
  }, [transactions, filters.direction, filters.showExcluded]);

  // Summary totals come from SQL aggregates, not the paginated feed.
  // Fixes the "numbers grow as you scroll" bug — Lectura + Herramientas now
  // reflect the full month regardless of how much feed is loaded.
  const { count, totalInflow, totalOutflow, uncategorizedCount, daysByDate } =
    aggregates;

  /** Flattened feed — [header, row, row, header, row, ...] for FlatList.
   *  TransactionItem references are stable when the underlying row is untouched,
   *  so memoized MovimientosTransactionRow skips re-render on unrelated state changes. */
  const feedItems = useMemo<FeedItem[]>(() => {
    const groups = new Map<string, TransactionListRow[]>();
    for (const tx of filteredTransactions) {
      const date = tx.transaction_date;
      const existing = groups.get(date);
      if (existing) existing.push(tx);
      else groups.set(date, [tx]);
    }
    const sorted = Array.from(groups.entries()).sort(([a], [b]) =>
      b.localeCompare(a)
    );
    const out: FeedItem[] = [];
    for (const [date, txs] of sorted) {
      out.push({ type: "header", date });
      for (const tx of txs) out.push({ type: "row", tx });
    }
    return out;
  }, [filteredTransactions]);

  const activeTool: ToolId | null =
    activeZone === "tool-categorizar" || activeZone === "tool-importar"
      ? (activeZone.replace("tool-", "") as ToolId)
      : null;

  const handleRequestPicker = useCallback((txId: string) => {
    setPickerTxId(txId);
  }, []);

  const handleToggleTool = useCallback(
    (tool: ToolId) => toggle(`tool-${tool}`),
    [toggle]
  );

  const handleToggleLectura = useCallback(() => toggle("lectura"), [toggle]);

  const handleClosePicker = useCallback(() => setPickerTxId(null), []);

  const handleCategorySelect = useCallback(
    async (categoryId: string) => {
      const txId = pickerTxId;
      if (!txId) return;
      setPickerTxId(null);
      // Optimistic local update — keeps row mounted, no reload needed.
      const cat = categories.find((c) => c.id === categoryId);
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txId
            ? {
                ...t,
                category_id: categoryId,
                category_name: cat?.name ?? t.category_name,
                category_name_es: cat?.name_es ?? cat?.name ?? t.category_name_es,
                category_color: cat?.color ?? t.category_color,
                category_icon: cat?.icon ?? t.category_icon,
              }
            : t
        )
      );
      try {
        await updateTransaction(txId, { category_id: categoryId });
      } catch (error) {
        console.error("Failed to categorize:", error);
        await loadData({ reset: true });
      }
    },
    [pickerTxId, categories, loadData]
  );


  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.type === "header") {
        return (
          <Text className={`mb-2 mt-4 ${SECTION_EYEBROW_CLASS}`}>
            {formatDate(item.date, "EEEE, dd MMM")}
          </Text>
        );
      }
      return (
        <MovimientosTransactionRow
          transaction={item.tx}
          onRequestCategoryPicker={handleRequestPicker}
        />
      );
    },
    [handleRequestPicker]
  );

  const listHeader = useMemo(
    () => (
      <View style={{ gap: 8, paddingBottom: 8 }}>
        <View className="items-center">
          <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
        </View>

        <MovimientosLectura
          count={count}
          totalInflow={totalInflow}
          totalOutflow={totalOutflow}
          daysByDate={daysByDate}
          currency={currency}
          expanded={activeZone === "lectura"}
          onToggle={handleToggleLectura}
        />

        <MovimientosHerramientas
          uncategorizedTransactions={uncategorizedSample}
          uncategorizedCount={uncategorizedCount}
          categories={categories}
          activeTool={activeTool}
          onToggleTool={handleToggleTool}
          onRequestCategoryPicker={handleRequestPicker}
        />

        <MovimientosUtilidades
          accounts={accounts}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </View>
    ),
    [
      currentMonth,
      count,
      totalInflow,
      totalOutflow,
      daysByDate,
      activeZone,
      uncategorizedSample,
      uncategorizedCount,
      categories,
      activeTool,
      accounts,
      searchQuery,
      filters,
      handleToggleLectura,
      handleToggleTool,
      handleRequestPicker,
    ]
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View className="py-4 items-center">
          <ActivityIndicator color={COLORS.brass} />
        </View>
      );
    }
    if (filteredTransactions.length === 0) {
      return (
        <View className="items-center justify-center py-16">
          <Text className="text-muted-foreground font-inter text-sm">
            {searchQuery
              ? "No se encontraron transacciones"
              : "Sin transacciones aún"}
          </Text>
        </View>
      );
    }
    return null;
  }, [loadingMore, filteredTransactions.length, searchQuery]);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="main"
        title="Movimientos"
        right={<AvatarMenuTrigger />}
      />

      <FlatList
        data={feedItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
      />

      {pickerTxId !== null && (
        <CategoryPickerSheet
          categories={categories}
          visible
          onSelect={handleCategorySelect}
          onClose={handleClosePicker}
        />
      )}
    </View>
  );
}

function keyExtractor(item: FeedItem): string {
  return item.type === "header" ? `h-${item.date}` : `r-${item.tx.id}`;
}
