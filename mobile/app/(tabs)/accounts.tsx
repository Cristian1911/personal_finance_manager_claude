import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Plus } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@venti5/shared";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { AccountCard } from "../../components/accounts/AccountCard";
import { useSync } from "../../lib/sync/hooks";

const DEBT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

function computeNetWorth(accounts: AccountRow[]) {
  return accounts.reduce((sum, acc) => {
    return DEBT_TYPES.has(acc.account_type)
      ? sum - acc.current_balance
      : sum + acc.current_balance;
  }, 0);
}

export default function AccountsScreen() {
  const router = useRouter();
  const { sync } = useSync();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const result = await getAllAccounts();
      setAccounts(result);
    } catch (error) {
      console.error("Failed to load accounts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadAccounts();
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadAccounts]);

  const netWorth = computeNetWorth(accounts);
  const isNegative = netWorth < 0;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#047857"
          />
        }
        ListHeaderComponent={
          <View className="px-4 pt-4 pb-2">
            {/* Net Worth Card */}
            <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
              <Text className="text-gray-500 font-inter text-sm">
                Patrimonio neto
              </Text>
              <Text
                className={`font-inter-bold text-3xl mt-1 ${
                  isNegative ? "text-red-500" : "text-gray-900"
                }`}
              >
                {formatCurrency(Math.abs(netWorth), "COP" as CurrencyCode)}
              </Text>
              <Text className="text-gray-400 font-inter text-xs mt-1">
                {accounts.length}{" "}
                {accounts.length === 1 ? "cuenta activa" : "cuentas activas"}
              </Text>
            </View>

            {/* Nueva cuenta button */}
            <Pressable
              className="bg-primary rounded-xl py-3.5 items-center flex-row justify-center gap-2 active:bg-primary-dark mb-4"
              onPress={() => router.push("/account/create")}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text className="text-white font-inter-bold text-sm">
                Nueva cuenta
              </Text>
            </Pressable>

            {accounts.length > 0 && (
              <Text className="text-gray-500 font-inter-semibold text-xs uppercase mb-2 px-1">
                Mis cuentas
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 pt-8">
            <Text className="text-gray-400 font-inter text-base text-center">
              No tienes cuentas registradas.{"\n"}Crea una para empezar.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <View className="px-4">
            <AccountCard
              account={item}
              onPress={() => router.push(`/account/${item.id}`)}
            />
          </View>
        )}
      />
    </View>
  );
}
