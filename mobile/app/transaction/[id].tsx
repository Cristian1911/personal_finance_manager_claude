import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { getTransactionById } from "../../lib/repositories/transactions";
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

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Detalle" }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </>
    );
  }

  if (!transaction) {
    return (
      <>
        <Stack.Screen options={{ title: "Detalle" }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-gray-400 font-inter text-base">
            Transaccion no encontrada
          </Text>
        </View>
      </>
    );
  }

  const isInflow = transaction.direction === "INFLOW";
  const statusLabel =
    transaction.status === "CLEARED"
      ? "Confirmada"
      : transaction.status === "PENDING"
        ? "Pendiente"
        : transaction.status ?? "Desconocido";

  return (
    <>
      <Stack.Screen
        options={{
          title: "Detalle",
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#111827",
        }}
      />
      <ScrollView className="flex-1 bg-white">
        {/* Amount header */}
        <View className="items-center pt-8 pb-6 border-b border-gray-100">
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
        <View className="px-4 pt-2">
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
          <DetailRow label="Direccion" value={transaction.direction} />
        </View>
      </ScrollView>
    </>
  );
}
