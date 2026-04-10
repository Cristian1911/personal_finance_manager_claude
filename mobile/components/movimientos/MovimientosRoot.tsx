import { useMemo, useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { formatDate, type CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import { getTransactions, type TransactionListRow } from "../../lib/repositories/transactions";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { computeCashflow } from "../../lib/utils/cashflow";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import { useExpandableZone } from "../ui/useExpandableZone";
import { MonthSelector } from "../common/MonthSelector";
import { SearchBar } from "../transactions/SearchBar";
import { MovimientosLectura } from "./MovimientosLectura";
import { MovimientosHerramientas } from "./MovimientosHerramientas";
import { MovimientosTransactionRow } from "./MovimientosTransactionRow";
import { SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";

export function MovimientosRoot() {
  const { sync } = useSync();
  const { activeZone, toggle } = useExpandableZone<string>();

  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<TransactionListRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date().toISOString().slice(0, 7)
  );

  const loadData = useCallback(async () => {
    try {
      const [txs, accts] = await Promise.all([
        getTransactions({
          search: searchQuery || undefined,
          month: currentMonth,
          limit: 200,
        }) as Promise<TransactionListRow[]>,
        getAllAccounts(),
      ]);
      setTransactions(txs);
      setAccounts(accts);
    } catch (error) {
      console.error("Failed to load movimientos data:", error);
    }
  }, [searchQuery, currentMonth]);

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

  // Compute summary
  const { count, totalInflow, totalOutflow, uncategorizedCount } = useMemo(() => {
    const { totalInflow: inflow, totalOutflow: outflow } = computeCashflow(transactions, accounts);
    let uncat = 0;
    for (const tx of transactions) {
      if (!tx.is_excluded && tx.direction === "OUTFLOW" && !tx.category_id) uncat++;
    }
    return { count: transactions.length, totalInflow: inflow, totalOutflow: outflow, uncategorizedCount: uncat };
  }, [transactions, accounts]);

  // Group transactions by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, TransactionListRow[]>();
    for (const tx of transactions) {
      const date = tx.transaction_date;
      const existing = groups.get(date);
      if (existing) existing.push(tx);
      else groups.set(date, [tx]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  const currency: CurrencyCode = "COP";

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="main"
        title="Movimientos"
        right={<AvatarMenuTrigger />}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {/* Month navigation */}
        <View className="items-center">
          <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
        </View>

        {/* Search */}
        <SearchBar onSearch={setSearchQuery} />

        {/* Lectura — month summary */}
        <MovimientosLectura
          count={count}
          totalInflow={totalInflow}
          totalOutflow={totalOutflow}
          currency={currency}
          expanded={activeZone === "lectura"}
          onToggle={() => toggle("lectura")}
        />

        {/* Herramientas — tools grid */}
        <MovimientosHerramientas uncategorizedCount={uncategorizedCount} />

        {/* Feed — date-grouped transaction rows */}
        {transactions.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Text className="text-muted-foreground font-inter text-sm">
              {searchQuery
                ? "No se encontraron transacciones"
                : "Sin transacciones aun"}
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            {groupedByDate.map(([date, txs]) => (
              <View key={date}>
                <Text className={`mb-2 ${SECTION_EYEBROW_CLASS}`}>
                  {formatDate(date, "dd MMM yyyy")}
                </Text>
                <View className="gap-0.5">
                  {txs.map((tx) => (
                    <MovimientosTransactionRow
                      key={tx.id}
                      transaction={{
                        id: tx.id,
                        description: tx.description,
                        merchant_name: tx.merchant_name,
                        amount: tx.amount,
                        direction: tx.direction as "INFLOW" | "OUTFLOW",
                        currency_code: tx.currency_code,
                        transaction_date: tx.transaction_date,
                        category_name_es: tx.category_name_es,
                        category_color: tx.category_color,
                        category_icon: tx.category_icon,
                        account_type: tx.account_type,
                      }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
