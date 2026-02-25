import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@venti5/shared";

type TransactionRowProps = {
  id: string;
  description: string | null;
  merchant_name: string | null;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currency_code?: CurrencyCode;
  category_name_es: string | null;
  category_color: string | null;
  category_icon: string | null;
};

export function TransactionRow({
  id,
  description,
  merchant_name,
  amount,
  direction,
  currency_code = "COP",
  category_name_es,
  category_color,
  category_icon,
}: TransactionRowProps) {
  const router = useRouter();
  const displayName = merchant_name || description || "Sin descripcion";
  const isInflow = direction === "INFLOW";
  const color = category_color || "#6B7280";
  const initial = category_icon || (category_name_es?.[0] ?? "?");

  return (
    <Pressable
      className="flex-row items-center px-4 py-3 bg-white active:bg-gray-50"
      onPress={() => router.push(`/transaction/${id}`)}
    >
      {/* Category icon circle */}
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: color + "20" }}
      >
        <Text
          className="font-inter-bold text-sm"
          style={{ color }}
        >
          {initial.slice(0, 2).toUpperCase()}
        </Text>
      </View>

      {/* Center: name + category */}
      <View className="flex-1 mr-2">
        <Text
          className="text-gray-900 font-inter-semibold text-sm"
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {category_name_es && (
          <Text className="text-gray-400 font-inter text-xs mt-0.5">
            {category_name_es}
          </Text>
        )}
      </View>

      {/* Amount */}
      <Text
        className={`font-inter-bold text-sm ${
          isInflow ? "text-green-600" : "text-gray-900"
        }`}
      >
        {isInflow ? "+" : "-"}
        {formatCurrency(Math.abs(amount), currency_code)}
      </Text>
    </Pressable>
  );
}
