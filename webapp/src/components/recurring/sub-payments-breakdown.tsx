"use client";

import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface SubPaymentEntry {
  currency_code: string;
  amount: number;
}

export function SubPaymentsBreakdown({
  subPayments,
  className,
}: {
  subPayments: SubPaymentEntry[];
  className?: string;
}) {
  if (subPayments.length <= 1) return null;

  return (
    <div className={className}>
      {subPayments.map((sp) => (
        <span key={sp.currency_code} className="text-muted-foreground">
          {sp.currency_code}: {formatCurrency(sp.amount, sp.currency_code as CurrencyCode)}
        </span>
      ))}
    </div>
  );
}
