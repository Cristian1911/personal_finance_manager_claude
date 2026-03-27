import { formatCurrency } from "@/lib/utils/currency";
import type { AllocationData } from "@/actions/allocation";
import type { CurrencyCode } from "@/types/domain";

interface StatusHeadlineProps {
  allocationData: AllocationData | null;
}

export function StatusHeadline({ allocationData }: StatusHeadlineProps) {
  if (!allocationData) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          Importa tu extracto para ver tu estado
        </p>
      </div>
    );
  }

  const spentPercent =
    ((allocationData.needs.amount + allocationData.wants.amount) /
      allocationData.income) *
    100;

  let dotColor: string;
  let ariaLabel: string;
  let copy: string;

  if (spentPercent > 100) {
    const overAmount =
      allocationData.needs.amount +
      allocationData.wants.amount -
      allocationData.income;
    dotColor = "bg-z-debt";
    ariaLabel = "Por encima del presupuesto";
    copy = `Te pasaste del presupuesto — ${formatCurrency(overAmount, allocationData.currency as CurrencyCode)} por encima`;
  } else if (spentPercent >= 90) {
    dotColor = "bg-z-alert";
    ariaLabel = "Cerca del limite";
    copy = "Cerca del limite — queda poco margen este mes";
  } else {
    dotColor = "bg-z-income";
    ariaLabel = "Gastos dentro del presupuesto";
    copy = "Vas bien este mes — gastos dentro del presupuesto";
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <span
        className={`inline-block h-2 w-2 rounded-full shrink-0 ${dotColor}`}
        aria-label={ariaLabel}
      />
      <p className="text-[15px] text-muted-foreground leading-relaxed">
        {copy}
      </p>
    </div>
  );
}
