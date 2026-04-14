import { Text, View } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { MCardGrid, MCardGridCell } from "../ui/MCard";

interface RecurringSummaryCardProps {
  totalExpected: number;
  pendingCount: number;
  paidCount: number;
  skippedCount: number;
  currency: CurrencyCode;
}

export function RecurringSummaryCard({
  totalExpected,
  pendingCount,
  paidCount,
  skippedCount,
  currency,
}: RecurringSummaryCardProps) {
  return (
    <MCardGrid>
      <MCardGridCell borderRight borderBottom>
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Comprometido
        </Text>
        <Text className="text-lg font-inter-bold text-foreground mt-0.5">
          {formatCurrency(totalExpected, currency)}
        </Text>
      </MCardGridCell>

      <MCardGridCell borderBottom>
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Pendientes
        </Text>
        <Text className="text-lg font-inter-bold text-z-alert mt-0.5">
          {pendingCount}
        </Text>
      </MCardGridCell>

      <MCardGridCell borderRight>
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Pagados
        </Text>
        <Text className="text-lg font-inter-bold text-z-income mt-0.5">
          {paidCount}
        </Text>
      </MCardGridCell>

      <MCardGridCell>
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark">
          Omitidos
        </Text>
        <Text className="text-lg font-inter-bold text-muted-foreground mt-0.5">
          {skippedCount}
        </Text>
      </MCardGridCell>
    </MCardGrid>
  );
}
