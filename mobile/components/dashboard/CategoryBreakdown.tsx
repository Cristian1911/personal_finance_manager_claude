import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";

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
    <View className="bg-z-surface-2-55 rounded-lg p-4 mx-4 mt-4 mb-6">
      <Text className="text-foreground font-inter-bold text-base mb-4">
        Gastos por categoría
      </Text>

      {categories.length === 0 ? (
        <Text className="text-muted-fg-50 font-inter text-sm text-center py-4">
          Sin gastos este mes
        </Text>
      ) : (
        categories.map((cat, index) => {
          const percentage = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
          const color = cat.category_color || COLORS.sageDark;

          return (
            <View key={cat.category_id ?? `unknown-${index}`} className="mb-3">
              <View className="flex-row justify-between items-center mb-1">
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: color }}
                  />
                  <Text
                    className="text-foreground font-inter-medium text-sm"
                    numberOfLines={1}
                  >
                    {cat.category_name_es || "Sin categoría"}
                  </Text>
                </View>
                <Text className="text-foreground font-inter-semibold text-sm ml-2">
                  {formatCurrency(cat.total, currencyCode)}
                </Text>
              </View>
              <View className="h-2 bg-black-10 rounded-full overflow-hidden">
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
