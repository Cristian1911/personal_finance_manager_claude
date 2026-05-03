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
import { X, Pencil, Trash2 } from "lucide-react-native";
import {
  getAccountById,
  deleteAccount,
  type AccountRow,
} from "../../lib/repositories/accounts";
import { getTransactions } from "../../lib/repositories/transactions";
import { getDatabase } from "../../lib/db/database";
import { ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { isDebtInflow } from "../../lib/transaction-semantics";
import { AccountBalanceCard } from "../../components/accounts/AccountBalanceCard";

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
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [recentTx, setRecentTx] = useState<TransactionRow[]>([]);
  const [spendingSummary, setSpendingSummary] = useState<{
    total_out: number;
    total_in: number;
    tx_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
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
        setAccount(acc);
        setRecentTx(txs as TransactionRow[]);
        setSpendingSummary(summary);
      } catch (error) {
        console.error("Failed to load account:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Eliminar cuenta",
      "Esta accion no se puede deshacer. Se eliminaran tambien todas las transacciones de esta cuenta.",
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
      <View className="flex-1 items-center justify-center bg-z-surface-2">
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!account) {
    return (
      <View className="flex-1 bg-z-surface-2">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-8 h-8 items-center justify-center rounded-full bg-z-surface-2 active:bg-z-surface-3"
          >
            <X size={18} color="#6B7280" />
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

  const typeDef = ACCOUNT_TYPES.find((t) => t.value === account.account_type);
  const Icon = typeDef?.icon;
  const color = account.color ?? "#6B7280";
  const currency = (account.currency_code as CurrencyCode) ?? "COP";

  return (
    <View className="flex-1 bg-z-surface-2">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="w-8 h-8 items-center justify-center rounded-full bg-z-surface-2 active:bg-z-surface-3"
        >
          <X size={18} color="#6B7280" />
        </Pressable>
        <Text className="text-foreground font-inter-bold text-base">Detalle</Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push(`/account/edit/${id}`)}
            className="w-8 h-8 items-center justify-center rounded-full bg-z-surface-2 active:bg-z-surface-3"
          >
            <Pencil size={16} color="#6B7280" />
          </Pressable>
          <Pressable
            onPress={handleDelete}
            className="w-8 h-8 items-center justify-center rounded-full bg-red-50 active:bg-red-100"
          >
            <Trash2 size={16} color="#EF4444" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Hero */}
        <View className="items-center pt-6 pb-5 border-b border-white-6 mx-4">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: color + "20" }}
          >
            {Icon && <Icon size={30} color={color} />}
          </View>
          <Text className="text-foreground font-inter-bold text-xl">
            {account.name}
          </Text>
          {account.institution_name && (
            <Text className="text-muted-foreground font-inter text-sm mt-1">
              {account.institution_name}
            </Text>
          )}
          <View className="bg-z-surface-2 rounded-full px-3 py-1 mt-2">
            <Text className="text-muted-foreground font-inter-medium text-xs">
              {typeDef?.label ?? account.account_type}
            </Text>
          </View>
        </View>

        {/* Balance card with utilization */}
        <View className="mx-4 mt-4">
          <AccountBalanceCard account={account} />
        </View>

        {/* Monthly spending summary */}
        {spendingSummary && spendingSummary.tx_count > 0 && (
          <View className="mx-4 mt-4">
            <Text className="text-muted-foreground font-inter-semibold text-xs uppercase mb-2">
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
            <Text className="text-muted-foreground font-inter-semibold text-xs uppercase mb-2">
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
        <View className="mx-4 mt-4 mb-8">
          <Text className="text-muted-foreground font-inter-semibold text-xs uppercase mb-2">
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
                      <View className="absolute top-0 left-4 right-4 h-px bg-z-surface-2" />
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
