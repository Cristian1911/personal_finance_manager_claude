import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react-native";
import {
  getTransactionById,
  deleteTransaction,
} from "../../lib/repositories/transactions";
import { formatCurrency, formatDate, type CurrencyCode } from "@venti5/shared";

type TransactionDetail = {
  id: string;
  description: string | null;
  raw_description: string | null;
  merchant_name: string | null;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currency_code: string;
  transaction_date: string;
  status: string | null;
  account_id: string;
  category_id: string | null;
  category_name_es: string | null;
  category_color: string | null;
  account_name: string | null;
  account_icon: string | null;
  account_color: string | null;
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between py-3 border-b border-gray-100">
      <Text className="text-gray-500 font-inter text-sm">{label}</Text>
      <Text className="text-gray-900 font-inter-medium text-sm text-right flex-1 ml-4">
        {value}
      </Text>
    </View>
  );
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [transaction, setTransaction] = useState<TransactionDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const result = (await getTransactionById(id)) as TransactionDetail;
        setTransaction(result);
      } catch (error) {
        console.error("Failed to load transaction:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Eliminar transaccion",
      "Esta accion no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(id);
              router.back();
            } catch (error) {
              console.error("Delete failed:", error);
              Alert.alert("Error", "No se pudo eliminar la transaccion.");
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

  if (!transaction) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <X size={18} color="#6B7280" />
          </Pressable>
          <Text className="text-gray-900 font-inter-bold text-base">
            Detalle
          </Text>
          <View className="w-8" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 font-inter text-base">
            Transaccion no encontrada
          </Text>
        </View>
      </View>
    );
  }

  const isInflow = transaction.direction === "INFLOW";
  const statusLabel =
    transaction.status === "CLEARED"
      ? "Confirmada"
      : transaction.status === "PENDING"
        ? "Pendiente"
        : transaction.status === "POSTED"
          ? "Registrada"
          : transaction.status ?? "Desconocido";

  return (
    <View className="flex-1 bg-white">
      {/* Header with close + delete */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <X size={18} color="#6B7280" />
        </Pressable>
        <Text className="text-gray-900 font-inter-bold text-base">
          Detalle
        </Text>
        <Pressable
          onPress={handleDelete}
          className="w-8 h-8 items-center justify-center rounded-full bg-red-50 active:bg-red-100"
        >
          <Trash2 size={16} color="#EF4444" />
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        {/* Amount header */}
        <View className="items-center pt-6 pb-5 border-b border-gray-100 mx-4">
          <Text className="text-gray-500 font-inter text-sm mb-1">
            {isInflow ? "Ingreso" : "Gasto"}
          </Text>
          <Text
            className={`font-inter-bold text-4xl ${
              isInflow ? "text-green-600" : "text-gray-900"
            }`}
          >
            {isInflow ? "+" : "-"}
            {formatCurrency(
              Math.abs(transaction.amount),
              (transaction.currency_code as CurrencyCode) || "COP"
            )}
          </Text>
          {transaction.merchant_name && (
            <Text className="text-gray-700 font-inter-medium text-base mt-2">
              {transaction.merchant_name}
            </Text>
          )}
        </View>

        {/* Details */}
        <View className="px-4 pt-2 pb-8">
          <DetailRow
            label="Fecha"
            value={
              transaction.transaction_date
                ? formatDate(transaction.transaction_date, "dd MMM yyyy")
                : null
            }
          />
          <DetailRow label="Cuenta" value={transaction.account_name} />
          <DetailRow label="Categoria" value={transaction.category_name_es} />
          <DetailRow label="Estado" value={statusLabel} />
          <DetailRow label="Descripcion" value={transaction.description} />
          <DetailRow
            label="Descripcion original"
            value={transaction.raw_description}
          />
        </View>
      </ScrollView>
    </View>
  );
}
