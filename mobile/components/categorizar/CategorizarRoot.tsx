import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { Tag } from "lucide-react-native";
import { useSync } from "../../lib/sync/hooks";
import {
  categorizeAndLearn,
  getTransactions,
  type TransactionListRow,
} from "../../lib/repositories/transactions";
import {
  getAllCategories,
  type CategoryRow,
} from "../../lib/repositories/categories";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard } from "../ui/MCard";
import { MOBILE_TAB_BAR_CLEARANCE, SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { UncategorizedRow } from "./UncategorizedRow";
import { CategoryZonePickerSheet } from "../transactions/CategoryZonePickerSheet";
import { trackProductEvent } from "../../lib/analytics/product-events";

export function CategorizarRoot() {
  const { sync } = useSync();

  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<TransactionListRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [txs, cats] = await Promise.all([
        getTransactions({
          uncategorizedOnly: true,
          limit: 200,
        }),
        getAllCategories(),
      ]);
      setTransactions(txs);
      setCategories(cats);
    } catch (error) {
      console.error("Failed to load categorizar data:", error);
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
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadData]);

  const handleAssignPress = useCallback((transactionId: string) => {
    setSelectedTxId(transactionId);
    setPickerVisible(true);
  }, []);

  const handleCategorySelect = useCallback(
    async (categoryId: string) => {
      if (!selectedTxId) return;

      try {
        await categorizeAndLearn(selectedTxId, categoryId);
        trackProductEvent({
          event_name: "categorize_applied",
          flow: "categorize",
          success: true,
        });
        // Remove from list optimistically
        setTransactions((prev: TransactionListRow[]) =>
          prev.filter((tx: TransactionListRow) => tx.id !== selectedTxId)
        );
      } catch (error) {
        console.error("Failed to assign category:", error);
        // Reload to get consistent state
        await loadData();
      }

      setSelectedTxId(null);
    },
    [selectedTxId, loadData]
  );

  const handlePickerClose = useCallback(() => {
    setPickerVisible(false);
    setSelectedTxId(null);
  }, []);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Categorizar" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {/* Summary card */}
        <MCard className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-z-brass-10">
            <Tag size={18} color={COLORS.brass} />
          </View>
          <View className="flex-1">
            <Text className="text-[22px] font-inter-bold text-foreground">
              {transactions.length}
            </Text>
            <Text className="text-[11px] font-inter text-muted-foreground">
              {transactions.length === 1
                ? "transacción sin categoría"
                : "transacciones sin categoría"}
            </Text>
          </View>
        </MCard>

        {/* Transaction list */}
        {transactions.length === 0 ? (
          <View className="items-center justify-center py-16">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-z-brass-10 mb-3">
              <Tag size={24} color={COLORS.brass} />
            </View>
            <Text className="text-[13px] font-inter-medium text-foreground mb-1">
              Todo categorizado
            </Text>
            <Text className="text-[11px] font-inter text-muted-foreground text-center px-8">
              No hay transacciones pendientes por categorizar
            </Text>
          </View>
        ) : (
          <View>
            <Text className={`mb-2 ${SECTION_EYEBROW_CLASS}`}>
              PENDIENTES
            </Text>
            <MCard className="p-0">
              {transactions.map((tx, idx) => (
                <View
                  key={tx.id}
                  className={
                    idx < transactions.length - 1
                      ? "border-b border-white-6 px-2"
                      : "px-2"
                  }
                >
                  <UncategorizedRow
                    transaction={tx}
                    onAssign={handleAssignPress}
                  />
                </View>
              ))}
            </MCard>
          </View>
        )}
      </ScrollView>

      {/* Category picker bottom sheet */}
      <CategoryZonePickerSheet
        categories={categories}
        visible={pickerVisible}
        selectedId={null}
        onSelect={(id) => id && handleCategorySelect(id)}
        onClose={handlePickerClose}
      />
    </View>
  );
}
