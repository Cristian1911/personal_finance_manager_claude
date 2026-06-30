import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight, FileText, Pencil, Shield, Store } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import {
  getDestinatarioById,
  getRulesForDestinatario,
  type DestinatarioWithCount,
  type DestinatarioRuleRow,
} from "../../lib/repositories/destinatarios";
import { getDatabase } from "../../lib/db/database";
import { COLORS } from "../../lib/constants/colors";
import { MOBILE_TAB_BAR_CLEARANCE, SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard, MListRow } from "../ui/MCard";
import { StateChip } from "../ui/StateChip";

type TransactionSummary = {
  id: string;
  description: string | null;
  merchant_name: string | null;
  amount: number;
  direction: string;
  transaction_date: string;
  currency_code: string;
  category_name: string | null;
};

interface DestinatarioDetailProps {
  id: string;
}

export function DestinatarioDetail({ id }: DestinatarioDetailProps) {
  const { sync } = useSync();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [destinatario, setDestinatario] =
    useState<DestinatarioWithCount | null>(null);
  const [rules, setRules] = useState<DestinatarioRuleRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [dest, rulesList] = await Promise.all([
        getDestinatarioById(id),
        getRulesForDestinatario(id),
      ]);
      setDestinatario(dest);
      setRules(rulesList);

      // Load recent transactions for this merchant
      const db = await getDatabase();
      const txs = await db.getAllAsync<TransactionSummary>(
        `SELECT t.id, t.description, t.merchant_name, t.amount, t.direction,
                t.transaction_date, t.currency_code,
                COALESCE(c.name_es, c.name) AS category_name
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.destinatario_id = ?
         ORDER BY t.transaction_date DESC
         LIMIT 10`,
        [id]
      );
      setTransactions(txs);
    } catch (error) {
      console.error("Failed to load destinatario detail:", error);
    }
  }, [id]);

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

  const title = destinatario?.name ?? "Destinatario";

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="sub"
        title={title}
        right={
          <Pressable
            onPress={() => router.push(`/destinatarios/${id}/edit` as any)}
            accessibilityRole="button"
            accessibilityLabel="Editar destinatario"
            className="flex-row items-center gap-1 rounded-full border border-z-brass-20 bg-z-brass-8 px-3 py-1.5 active:opacity-80"
          >
            <Pencil size={13} color={COLORS.brass} />
            <Text className="text-xs font-inter-semibold text-z-brass">Editar</Text>
          </Pressable>
        }
      />

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
        {/* Info card */}
        <MCard className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-z-brass-10">
              <Store size={20} color={COLORS.brass} />
            </View>
            <View className="flex-1 min-w-0">
              <Text
                className="text-base font-inter-bold text-foreground"
                numberOfLines={1}
              >
                {destinatario?.name ?? "..."}
              </Text>
              {destinatario?.category_name && (
                <Text className="text-[11px] font-inter text-z-brass mt-0.5">
                  {destinatario.category_name}
                </Text>
              )}
            </View>
            <StateChip
              label={destinatario?.is_active ? "Activo" : "Inactivo"}
              variant={destinatario?.is_active ? "sage" : "brass"}
            />
          </View>

          {destinatario?.notes && (
            <Text className="text-xs font-inter text-muted-foreground">
              {destinatario.notes}
            </Text>
          )}

          <View className="flex-row items-center gap-4 pt-1 border-t border-white-6">
            <View className="flex-row items-center gap-1.5 pt-2">
              <FileText size={12} color={COLORS.sageDark} />
              <Text className="text-[11px] font-inter text-muted-foreground">
                {destinatario?.transaction_count ?? 0}{" "}
                {(destinatario?.transaction_count ?? 0) === 1
                  ? "transacción"
                  : "transacciones"}
              </Text>
            </View>
          </View>
        </MCard>

        {/* Rules section */}
        <View className="mt-2">
          <Text className={`${SECTION_EYEBROW_CLASS} mb-2 px-1`}>REGLAS</Text>
          {rules.length === 0 ? (
            <MCard>
              <Text className="text-sm font-inter text-muted-foreground text-center py-2">
                No hay reglas configuradas
              </Text>
            </MCard>
          ) : (
            <MCard className="p-0 overflow-hidden">
              {rules.map((rule, idx) => (
                <MListRow
                  key={rule.id}
                  className={
                    idx < rules.length - 1 ? "border-b border-white-6" : ""
                  }
                >
                  <View className="flex-row items-center gap-2 flex-1 min-w-0">
                    <Shield size={14} color={COLORS.sageDark} />
                    <Text
                      className="text-sm font-inter-medium text-foreground flex-1"
                      numberOfLines={1}
                    >
                      {rule.pattern}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[10px] font-inter text-muted-foreground uppercase">
                      {rule.match_type}
                    </Text>
                    {rule.match_count > 0 && (
                      <View className="rounded-full bg-z-surface-2-8 px-2 py-0.5">
                        <Text className="text-[10px] font-inter-medium text-muted-foreground">
                          {rule.match_count}
                        </Text>
                      </View>
                    )}
                  </View>
                </MListRow>
              ))}
            </MCard>
          )}
        </View>

        {/* Recent transactions section */}
        <View className="mt-2">
          <Text className={`${SECTION_EYEBROW_CLASS} mb-2 px-1`}>
            TRANSACCIONES RECIENTES
          </Text>
          {transactions.length === 0 ? (
            <MCard>
              <Text className="text-sm font-inter text-muted-foreground text-center py-2">
                No hay transacciones vinculadas
              </Text>
            </MCard>
          ) : (
            <MCard className="p-0 overflow-hidden">
              {transactions.map((tx, idx) => {
                const isInflow = tx.direction === "INFLOW";
                const label =
                  tx.merchant_name ?? tx.description ?? "Sin descripción";

                return (
                  <MListRow
                    key={tx.id}
                    className={
                      idx < transactions.length - 1
                        ? "border-b border-white-6"
                        : ""
                    }
                  >
                    {/* Direction icon + description */}
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0 mr-3">
                      <View
                        className={`h-[22px] w-[22px] items-center justify-center rounded-md ${
                          isInflow ? "bg-green-500-10" : "bg-z-expense-12"
                        }`}
                      >
                        {isInflow ? (
                          <ArrowDownLeft size={12} color={COLORS.income} />
                        ) : (
                          <ArrowUpRight size={12} color={COLORS.expense} />
                        )}
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text
                          className="text-xs font-inter-medium text-foreground"
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                        <Text className="text-[10px] font-inter text-muted-foreground mt-0.5">
                          {formatDate(tx.transaction_date, "dd MMM yyyy")}
                        </Text>
                      </View>
                    </View>

                    {/* Amount */}
                    <Text
                      className={`text-xs font-inter-medium ${
                        isInflow ? "text-z-income" : "text-foreground"
                      }`}
                    >
                      {isInflow ? "+" : "-"}
                      {formatCurrency(
                        Math.abs(tx.amount),
                        tx.currency_code as CurrencyCode
                      )}
                    </Text>
                  </MListRow>
                );
              })}
            </MCard>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
