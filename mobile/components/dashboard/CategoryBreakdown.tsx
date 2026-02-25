import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@venti5/shared";

export type CategorySpend = {
  category_id: string | null;
  category_name_es: string | null;
  category_color: string | null;
  total: number;
};

type CategoryBreakdownProps = {
  categories: CategorySpend[];
  currencyCode?: CurrencyCode;
};

export function CategoryBreakdown({
  categories,
  currencyCode = "COP",
}: CategoryBreakdownProps) {
  const maxTotal = categories.length > 0 ? categories[0].total : 1;

  return (
    <View className="bg-white rounded-lg shadow-sm p-4 mx-4 mt-4 mb-6">
      <Text className="text-gray-900 font-inter-bold text-base mb-4">
        Gastos por categoria
      </Text>

      {categories.length === 0 ? (
        <Text className="text-gray-400 font-inter text-sm text-center py-4">
          Sin gastos este mes
        </Text>
      ) : (
        categories.map((cat, index) => {
          const percentage = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
          const color = cat.category_color || "#6B7280";

          return (
            <View key={cat.category_id ?? `unknown-${index}`} className="mb-3">
              <View className="flex-row justify-between items-center mb-1">
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: color }}
                  />
                  <Text
                    className="text-gray-700 font-inter-medium text-sm"
                    numberOfLines={1}
                  >
                    {cat.category_name_es || "Sin categoria"}
                  </Text>
                </View>
                <Text className="text-gray-900 font-inter-semibold text-sm ml-2">
                  {formatCurrency(cat.total, currencyCode)}
                </Text>
              </View>
              <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(percentage, 2)}%`,
                    backgroundColor: color,
                  }}
                />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
