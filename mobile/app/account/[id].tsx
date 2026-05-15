import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import {
  getAccountById,
  deleteAccount,
  type AccountRow,
} from "../../lib/repositories/accounts";
import { getTransactions } from "../../lib/repositories/transactions";
import { getDatabase } from "../../lib/db/database";
import {
  getBalanceHistory,
  getSpendingPulse,
  type SnapshotPoint,
  type DailyPoint,
} from "../../lib/repositories/accounts-detail";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { isDebtInflow } from "../../lib/transaction-semantics";
import { AccountHero } from "../../components/accounts/AccountHero";
import { QuickActionsBar } from "../../components/accounts/QuickActionsBar";
import {
  MOBILE_TAB_BAR_CLEARANCE,
  SECTION_EYEBROW_CLASS,
} from "../../lib/constants/styles";

type TransactionRow = {
  id: string;
  description: string | null;
  merchant_name: string | null;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  category_name_es: string | null;
  account_type: string | null;
};

function getAmountColorClass(isDebtPayment: boolean, isInflow: boolean): string {
  if (isDebtPayment) return "text-z-brass";
  if (isInflow) return "text-z-income";
  return "text-foreground";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start py-3 border-b border-white-6">
      <Text className="text-muted-foreground font-inter text-sm w-24 mt-0.5">{label}</Text>
      <Text className="text-foreground font-inter-medium text-sm text-right flex-1 ml-4 leading-5">
        {value}
      </Text>
    </View>
  );
}

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [recentTx, setRecentTx] = useState<TransactionRow[]>([]);
  const [spendingSummary, setSpendingSummary] = useState<{
    total_out: number;
    total_in: number;
    tx_count: number;
  } | null>(null);
  const [snapshotData, setSnapshotData] = useState<SnapshotPoint[]>([]);
  const [trendPercent, setTrendPercent] = useState<number | undefined>(undefined);
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [dailyActivity, setDailyActivity] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const db = await getDatabase();
        const [acc, txs, summary] = await Promise.all([
          getAccountById(id),
          getTransactions({ accountId: id, limit: 10 }),
          db.getFirstAsync<{ total_out: number; total_in: number; tx_count: number }>(
            `SELECT
              COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END), 0) as total_out,
              COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount ELSE 0 END), 0) as total_in,
              COUNT(*) as tx_count
            FROM transactions
            WHERE account_id = ? AND transaction_date LIKE ? AND is_excluded = 0`,
            [id, `${month}%`]
          ),
        ]);
        if (cancelled) return;
        setAccount(acc);
        setRecentTx(txs as TransactionRow[]);
        setSpendingSummary(summary);

        if (acc) {
          const [history, pulse] = await Promise.all([
            getBalanceHistory(id, acc.current_balance ?? 0),
            getSpendingPulse(id),
          ]);
          if (cancelled) return;
          setSnapshotData(history);
          if (history.length >= 2) {
            const first = history[0].balance;
            const last = history[history.length - 1].balance;
            if (first !== 0) {
              setTrendPercent(((last - first) / Math.abs(first)) * 100);
            }
          }
          setMonthlySpent(pulse.monthlySpent);
          setDailyActivity(pulse.dailyActivity);
        }
      } catch (error) {
        console.error("Failed to load account:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Eliminar cuenta",
      "Esta acción no se puede deshacer. Se eliminarán también todas las transacciones de esta cuenta.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount(id);
              router.back();
            } catch (error) {
              console.error("Delete failed:", error);
              Alert.alert("Error", "No se pudo eliminar la cuenta.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View
        className="flex-1 items-center justify-center bg-z-surface-2"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color={COLORS.brass} />
      </View>
    );
  }

  if (!account) {
    return (
      <View className="flex-1 bg-z-surface-2" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-8 h-8 items-center justify-center rounded-full bg-z-surface-2 active:bg-z-surface-3"
          >
            <X size={18} color={COLORS.sageDark} />
          </Pressable>
          <Text className="text-foreground font-inter-bold text-base">Cuenta</Text>
          <View className="w-8" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted-fg-70 font-inter text-base">
            Cuenta no encontrada
          </Text>
        </View>
      </View>
    );
  }

  const currency = (account.currency_code as CurrencyCode) ?? "COP";

  return (
    <View className="flex-1 bg-z-surface-2" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="w-8 h-8 items-center justify-center rounded-full bg-z-surface-2 active:bg-z-surface-3"
        >
          <X size={18} color={COLORS.sageDark} />
        </Pressable>
        <Text className="text-foreground font-inter-bold text-base">Detalle</Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
      >
        {/* Hero — variant by account type */}
        <View className="mx-4 mt-4">
          <AccountHero
            account={account}
            snapshotData={snapshotData}
            trendPercent={trendPercent}
            monthlySpent={monthlySpent}
            dailyActivity={dailyActivity}
          />
        </View>

        {/* Quick actions */}
        <View className="mx-4 mt-4">
          <QuickActionsBar
            account={account}
            onEdit={() => router.push(`/account/edit/${id}`)}
            onDelete={handleDelete}
          />
        </View>

        {/* Monthly spending summary */}
        {spendingSummary && spendingSummary.tx_count > 0 && (
          <View className="mx-4 mt-4">
            <Text className={`${SECTION_EYEBROW_CLASS} mb-2`}>
              Resumen del mes
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-z-surface-2 rounded-xl p-4 border border-white-6 items-center">
                <Text className="text-muted-fg-70 font-inter text-xs mb-1">
                  Gastos del mes
                </Text>
                <Text className="text-foreground font-inter-semibold text-sm">
                  {formatCurrency(spendingSummary.total_out, currency)}
                </Text>
              </View>
              <View className="flex-1 bg-z-surface-2 rounded-xl p-4 border border-white-6 items-center">
                <Text className="text-muted-fg-70 font-inter text-xs mb-1">
                  Ingresos del mes
                </Text>
                <Text className="text-z-income font-inter-semibold text-sm">
                  {formatCurrency(spendingSummary.total_in, currency)}
                </Text>
              </View>
            </View>
            <Text className="text-muted-fg-70 font-inter text-xs mt-1.5 text-center">
              {spendingSummary.tx_count} transacciones este mes
            </Text>
          </View>
        )}

        {/* Type-specific details */}
        {(account.account_type === "CREDIT_CARD" ||
          account.account_type === "LOAN") && (
          <View className="mx-4 mt-4">
            <Text className={`${SECTION_EYEBROW_CLASS} mb-2`}>
              Detalles
            </Text>
            <View className="bg-z-surface-2 rounded-xl px-4 border border-white-6">
              {account.credit_limit != null && (
                <DetailRow
                  label="Limite de credito"
                  value={formatCurrency(account.credit_limit, currency)}
                />
              )}
              {account.interest_rate != null && (
                <DetailRow
                  label="Tasa de interes"
                  value={`${account.interest_rate}%`}
                />
              )}
              {account.cutoff_day != null && (
                <DetailRow
                  label="Dia de corte"
                  value={`Dia ${account.cutoff_day}`}
                />
              )}
              {account.payment_day != null && (
                <DetailRow
                  label="Dia de pago"
                  value={`Dia ${account.payment_day}`}
                />
              )}
            </View>
          </View>
        )}

        {/* Recent transactions */}
        <View className="mx-4 mt-4">
          <Text className={`${SECTION_EYEBROW_CLASS} mb-2`}>
            Ultimas transacciones
          </Text>
          {recentTx.length === 0 ? (
            <View className="bg-z-surface-2 rounded-xl px-4 py-6 border border-white-6 items-center">
              <Text className="text-muted-fg-70 font-inter text-sm">
                Sin transacciones
              </Text>
            </View>
          ) : (
            <View className="bg-z-surface-2 rounded-xl border border-white-6 overflow-hidden">
              {recentTx.map((tx, index) => {
                const isInflow = tx.direction === "INFLOW";
                const isDebtPayment = isDebtInflow({
                  direction: tx.direction,
                  accountType: tx.account_type ?? account.account_type,
                });
                return (
                  <Pressable
                    key={tx.id}
                    className="flex-row items-center px-4 py-3 active:bg-z-surface-2-55"
                    onPress={() => router.push(`/transaction/${tx.id}`)}
                  >
                    {index > 0 && (
                      <View className="absolute top-0 left-4 right-4 h-px bg-white-6" />
                    )}
                    <View className="flex-1 min-w-0">
                      <Text
                        className="text-foreground font-inter-medium text-sm"
                        numberOfLines={1}
                      >
                        {tx.merchant_name ?? tx.description ?? "Sin descripcion"}
                      </Text>
                      {(tx.category_name_es || isDebtPayment) && (
                        <Text className="text-muted-fg-70 font-inter text-xs mt-0.5">
                          {isDebtPayment ? "Abono a deuda" : tx.category_name_es}
                        </Text>
                      )}
                    </View>
                    <Text
                      className={`font-inter-semibold text-sm ml-3 ${
                        getAmountColorClass(isDebtPayment, isInflow)
                      }`}
                    >
                      {isInflow ? "+" : "-"}
                      {formatCurrency(Math.abs(tx.amount), currency)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
