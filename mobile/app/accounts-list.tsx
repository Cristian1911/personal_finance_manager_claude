import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import {
  getAllAccounts,
  type AccountRow,
} from "../lib/repositories/accounts";
import { AccountCard } from "../components/accounts/AccountCard";
import { MobileHeader } from "../components/ui/MobileHeader";
import { useSync } from "../lib/sync/hooks";
import { COLORS } from "../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
  PANEL_SURFACE_SUBTLE_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../lib/constants/styles";
import {
  computeNetWorth,
  computeSecondaryNetWorth,
  DISPLAY_CURRENCY,
} from "../lib/utils/net-worth";

export default function AccountsListScreen() {
  const router = useRouter();
  const { sync } = useSync();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const result = await getAllAccounts();
      setAccounts(result);
    } catch (error) {
      console.error("Failed to load accounts:", error);
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

  const netWorth = useMemo(
    () => computeNetWorth(accounts, DISPLAY_CURRENCY),
    [accounts]
  );
  const secondaryNetWorth = useMemo(
    () => computeSecondaryNetWorth(accounts, DISPLAY_CURRENCY),
    [accounts]
  );
  const isNegative = netWorth < 0;

  const listHeader = useMemo(
    () => (
      <View className="pt-4 pb-2 gap-4">
        <View className={`${PANEL_SURFACE_SUBTLE_CLASS} p-5`}>
          <Text className={SECTION_EYEBROW_CLASS}>Patrimonio neto</Text>
          <Text
            className={`font-inter-bold text-3xl mt-2 ${
              isNegative ? "text-z-debt" : "text-foreground"
            }`}
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {(isNegative ? "-" : "") +
              formatCurrency(Math.abs(netWorth), DISPLAY_CURRENCY as CurrencyCode)}
          </Text>
          {secondaryNetWorth.length > 0 && (
            <View className="mt-3 gap-1.5 border-t border-white-6 pt-3">
              {secondaryNetWorth.map(([cc, total]) => (
                <View key={cc} className="flex-row items-center justify-between">
                  <Text className="text-xs font-inter-medium text-muted-foreground">
                    {cc}
                  </Text>
                  <Text
                    className={`text-sm font-inter-medium ${
                      total < 0 ? "text-z-debt" : "text-foreground"
                    }`}
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {formatCurrency(total, cc as CurrencyCode)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Pressable
          className={`${BRASS_BUTTON_CLASS} rounded-xl py-3.5 items-center flex-row justify-center gap-2 active:bg-z-brass-80`}
          onPress={() => router.push("/account/create")}
          accessibilityRole="button"
          accessibilityLabel="Nueva cuenta"
        >
          <Plus size={18} color={COLORS.ink} />
          <Text className="text-z-ink font-inter-bold text-sm">
            Nueva cuenta
          </Text>
        </Pressable>

        {accounts.length > 0 && (
          <Text className={`${SECTION_EYEBROW_CLASS} px-1`}>Mis cuentas</Text>
        )}
      </View>
    ),
    [netWorth, secondaryNetWorth, isNegative, accounts.length, router],
  );

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Mis cuentas" />
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-4 pt-8">
            <Text className="text-muted-foreground font-inter text-base text-center">
              No tienes cuentas registradas.{"\n"}Crea una para empezar.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <AccountCard
            account={item}
            onPress={() => router.push(`/account/${item.id}`)}
          />
        )}
      />
    </View>
  );
}
