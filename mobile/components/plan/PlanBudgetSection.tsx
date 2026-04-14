import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import type { BudgetProgressRow } from "../../lib/repositories/budgets";
import { MCard } from "../ui/MCard";
import { MobileZone } from "../ui/MobileZone";
import { COLORS } from "../../lib/constants/colors";

interface PlanBudgetSectionProps {
  budgetItems: BudgetProgressRow[];
  currency: CurrencyCode;
}

export function PlanBudgetSection({
  budgetItems,
  currency,
}: PlanBudgetSectionProps) {
  if (budgetItems.length === 0) return null;

  return (
    <MobileZone eyebrow="PRESUPUESTO POR CATEGORÍA">
      <View className="gap-2">
        {budgetItems.map((item) => (
          <BudgetCategoryRow key={item.category_id} item={item} currency={currency} />
        ))}
      </View>
    </MobileZone>
  );
}

function BudgetCategoryRow({
  item,
  currency,
}: {
  item: BudgetProgressRow;
  currency: CurrencyCode;
}) {
  const pct = item.amount > 0 ? Math.min((item.spent / item.amount) * 100, 100) : 0;
  const isOver = item.spent > item.amount && item.amount > 0;
  const barColor = isOver ? COLORS.expense : item.category_color ?? COLORS.brass;

  return (
    <MCard>
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          {item.category_color && (
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.category_color }}
            />
          )}
          <Text
            className="text-[13px] font-inter-medium text-foreground"
            numberOfLines={1}
          >
            {item.category_name}
          </Text>
        </View>
        <Text
          className={`text-[12px] font-inter-semibold ${isOver ? "text-z-expense" : "text-foreground"}`}
        >
          {formatCurrency(item.spent, currency)}
          {item.amount > 0 && (
            <Text className="text-muted-foreground font-inter">
              {" "}/ {formatCurrency(item.amount, currency)}
            </Text>
          )}
        </Text>
      </View>

      {/* Progress bar */}
      {item.amount > 0 && (
        <View className="h-1.5 rounded-full bg-white-6 overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: barColor,
            }}
          />
        </View>
      )}
    </MCard>
  );
}
