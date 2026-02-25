import { View, Text, SectionList, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { getTransactions } from "../../lib/repositories/transactions";
import { formatDate } from "@venti5/shared";
import { SearchBar } from "../../components/transactions/SearchBar";
import { TransactionRow } from "../../components/transactions/TransactionRow";

type TransactionItem = {
  id: string;
  description: string | null;
  merchant_name: string | null;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currency_code: string;
  transaction_date: string;
  category_name_es: string | null;
  category_color: string | null;
  category_icon: string | null;
};

type Section = {
  title: string;
  data: TransactionItem[];
};

const PAGE_SIZE = 50;

export default function TransactionsScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const groupByDate = (items: TransactionItem[]): Section[] => {
    const groups = new Map<string, TransactionItem[]>();
    for (const item of items) {
      const dateKey = item.transaction_date?.slice(0, 10) ?? "unknown";
      const existing = groups.get(dateKey);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(dateKey, [item]);
      }
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, data]) => ({
        title:
          dateKey === "unknown"
            ? "Sin fecha"
            : formatDate(dateKey, "dd MMM yyyy"),
        data,
      }));
  };

  const loadTransactions = useCallback(
    async (search: string, reset = true) => {
      try {
        if (reset) {
          setLoading(true);
          setOffset(0);
        }

        const newOffset = reset ? 0 : offset;
        const results = (await getTransactions({
          search: search || undefined,
          limit: PAGE_SIZE,
          offset: newOffset,
        })) as TransactionItem[];

        if (reset) {
          setSections(groupByDate(results));
        } else {
          // Merge with existing — flatten, add new, re-group
          const existing = sections.flatMap((s) => s.data);
          const merged = [...existing, ...results];
          setSections(groupByDate(merged));
        }

        setHasMore(results.length === PAGE_SIZE);
        setOffset(newOffset + results.length);
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [offset, sections]
  );

  useFocusEffect(
    useCallback(() => {
      loadTransactions(searchQuery, true);
    }, [searchQuery])
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadTransactions(searchQuery, false);
  }, [loadingMore, hasMore, searchQuery, loadTransactions]);

  return (
    <View className="flex-1 bg-gray-100">
      <SearchBar onSearch={handleSearch} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#047857" />
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 font-inter text-base text-center">
            {searchQuery
              ? "No se encontraron transacciones"
              : "Sin transacciones aun"}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionRow
              id={item.id}
              description={item.description}
              merchant_name={item.merchant_name}
              amount={item.amount}
              direction={item.direction}
              currency_code={item.currency_code as any}
              category_name_es={item.category_name_es}
              category_color={item.category_color}
              category_icon={item.category_icon}
            />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View className="px-4 py-2 bg-gray-100">
              <Text className="text-gray-500 font-inter-semibold text-xs uppercase">
                {title}
              </Text>
            </View>
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4">
                <ActivityIndicator size="small" color="#047857" />
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => (
            <View className="h-px bg-gray-100 ml-16" />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}
