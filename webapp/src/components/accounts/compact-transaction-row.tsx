import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { TransactionWithAccount, CurrencyCode } from "@/types/domain";

interface CompactTransactionRowProps {
  transaction: TransactionWithAccount;
  onClick?: () => void;
}

export function CompactTransactionRow({
  transaction,
  onClick,
}: CompactTransactionRowProps) {
  const isInflow = transaction.direction === "INFLOW";
  const description =
    transaction.destinatario?.name ??
    transaction.clean_description ??
    transaction.merchant_name ??
    "—";
  const categoryName =
    transaction.category?.name_es ?? transaction.category?.name ?? null;

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors",
        onClick && "hover:bg-white/[0.03] cursor-pointer"
      )}
    >
      {/* Left: description + meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-z-white/90">
          {description}
        </p>
        <p className="mt-0.5 text-xs text-z-sage-dark">
          {transaction.transaction_date
            ? formatDate(transaction.transaction_date, "dd MMM")
            : ""}
          {categoryName && (
            <>
              {" · "}
              <span className="text-z-sage-dark">{categoryName}</span>
            </>
          )}
        </p>
      </div>

      {/* Right: amount */}
      <span
        className={cn(
          "ml-3 shrink-0 text-sm font-semibold tabular-nums",
          isInflow ? "text-z-income" : "text-z-white/80"
        )}
      >
        {isInflow ? "+" : "-"}
        {formatCurrency(
          transaction.amount ?? 0,
          (transaction.currency_code ?? "COP") as CurrencyCode
        )}
      </span>
    </Wrapper>
  );
}
