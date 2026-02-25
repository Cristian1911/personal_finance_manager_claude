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
import { ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { formatCurrency, type CurrencyCode } from "@venti5/shared";

type TransactionRow = {
  id: string;
  description: string | null;
  merchant_name: string | null;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  category_name_es: string | null;
};

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 bg-white rounded-xl p-4 items-center">
      <Text className="text-gray-400 font-inter text-xs mb-1">{label}</Text>
      <Text className="text-gray-900 font-inter-semibold text-sm text-center">
        {value}
      </Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-3 border-b border-gray-100">
      <Text className="text-gray-500 font-inter text-sm">{label}</Text>
      <Text className="text-gray-900 font-inter-medium text-sm text-right flex-1 ml-4">
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [acc, txs] = await Promise.all([
          getAccountById(id),
          getTransactions({ accountId: id, limit: 10 }),
        ]);
        setAccount(acc);
        setRecentTx(txs as TransactionRow[]);
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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!account) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <X size={18} color="#6B7280" />
          </Pressable>
          <Text className="text-gray-900 font-inter-bold text-base">Cuenta</Text>
          <View className="w-8" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 font-inter text-base">
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
  const isDebt =
    account.account_type === "CREDIT_CARD" ||
    account.account_type === "LOAN";

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <X size={18} color="#6B7280" />
        </Pressable>
        <Text className="text-gray-900 font-inter-bold text-base">Detalle</Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push(`/account/edit/${id}`)}
            className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
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
        <View className="items-center pt-6 pb-5 border-b border-gray-100 mx-4">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: color + "20" }}
          >
            {Icon && <Icon size={30} color={color} />}
          </View>
          <Text className="text-gray-900 font-inter-bold text-xl">
            {account.name}
          </Text>
          {account.institution_name && (
            <Text className="text-gray-500 font-inter text-sm mt-1">
              {account.institution_name}
            </Text>
          )}
          <View className="bg-gray-100 rounded-full px-3 py-1 mt-2">
            <Text className="text-gray-600 font-inter-medium text-xs">
              {typeDef?.label ?? account.account_type}
            </Text>
          </View>
        </View>

        {/* 3 info cards */}
        <View className="flex-row gap-3 mx-4 mt-4">
          <InfoCard
            label="Balance"
            value={formatCurrency(account.current_balance, currency)}
          />
          <InfoCard
            label="Tipo"
            value={typeDef?.shortLabel ?? account.account_type}
          />
          <InfoCard label="Moneda" value={account.currency_code} />
        </View>

        {/* Type-specific details */}
        {(account.account_type === "CREDIT_CARD" ||
          account.account_type === "LOAN") && (
          <View className="mx-4 mt-4">
            <Text className="text-gray-500 font-inter-semibold text-xs uppercase mb-2">
              Detalles
            </Text>
            <View className="bg-white rounded-xl px-4 border border-gray-100">
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
          <Text className="text-gray-500 font-inter-semibold text-xs uppercase mb-2">
            Ultimas transacciones
          </Text>
          {recentTx.length === 0 ? (
            <View className="bg-white rounded-xl px-4 py-6 border border-gray-100 items-center">
              <Text className="text-gray-400 font-inter text-sm">
                Sin transacciones
              </Text>
            </View>
          ) : (
            <View className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {recentTx.map((tx, index) => {
                const isInflow = tx.direction === "INFLOW";
                return (
                  <Pressable
                    key={tx.id}
                    className="flex-row items-center px-4 py-3 active:bg-gray-50"
                    onPress={() => router.push(`/transaction/${tx.id}`)}
                  >
                    {index > 0 && (
                      <View className="absolute top-0 left-4 right-4 h-px bg-gray-100" />
                    )}
                    <View className="flex-1 min-w-0">
                      <Text
                        className="text-gray-900 font-inter-medium text-sm"
                        numberOfLines={1}
                      >
                        {tx.merchant_name ?? tx.description ?? "Sin descripcion"}
                      </Text>
                      {tx.category_name_es && (
                        <Text className="text-gray-400 font-inter text-xs mt-0.5">
                          {tx.category_name_es}
                        </Text>
                      )}
                    </View>
                    <Text
                      className={`font-inter-semibold text-sm ml-3 ${
                        isInflow ? "text-green-600" : "text-gray-900"
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
