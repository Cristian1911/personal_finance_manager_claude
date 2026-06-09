import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export interface DebtAccountRowData {
  id: string;
  name: string;
  type: "CREDIT_CARD" | "LOAN";
  balance: number;
  currency: CurrencyCode;
  creditLimit: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  cutoffDay: number | null;
  /** Loans only — months remaining at current payment pace. */
  remainingMonths?: number | null;
  otherCurrencies?: { currency: string; balance: number }[];
}

/**
 * Canonical compact debt account card — the ONE representation of a debt
 * account. Consumed by the /deudas Cuentas lens; exported for accounts
 * surfaces to adopt (kills the divergent duplicate cards).
 */
export function DebtAccountRow({
  account,
  href,
}: {
  account: DebtAccountRowData;
  href?: string;
}) {
  const isCC = account.type === "CREDIT_CARD";
  const utilization =
    isCC && account.creditLimit && account.creditLimit > 0
      ? Math.min(100, (account.balance / account.creditLimit) * 100)
      : null;

  const metaParts: string[] = [];
  if (account.monthlyPayment && account.monthlyPayment > 0) {
    metaParts.push(
      isCC
        ? `cuota ${formatCurrency(account.monthlyPayment, account.currency)}`
        : `${formatCurrency(account.monthlyPayment, account.currency)}/mes`
    );
  }
  if (isCC && account.cutoffDay) metaParts.push(`corte día ${account.cutoffDay}`);
  if (!isCC && account.remainingMonths) metaParts.push(`faltan ${account.remainingMonths} meses`);
  if (account.interestRate && account.interestRate > 0) {
    metaParts.push(`${account.interestRate.toFixed(1)}% EA`);
  }

  const body = (
    <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-z-sage-light">
          {account.name}
        </p>
        <p
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            account.balance > 0 ? "text-z-debt" : "text-z-income"
          )}
        >
          {formatCurrency(account.balance, account.currency)}
        </p>
      </div>

      {utilization != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/6">
          <div
            className={cn(
              "h-full rounded-full",
              utilization > 60 ? "bg-z-debt/80" : "bg-z-brass/80"
            )}
            style={{ width: `${utilization}%` }}
          />
        </div>
      )}

      {(metaParts.length > 0 || account.otherCurrencies?.length) && (
        <p className="mt-2 truncate text-[10px] text-muted-foreground">
          {metaParts.join(" · ")}
          {account.otherCurrencies?.map(
            (oc) => ` · ${formatCurrency(oc.balance, oc.currency as CurrencyCode)} ${oc.currency}`
          )}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block active:opacity-80">
        {body}
      </Link>
    );
  }
  return body;
}
