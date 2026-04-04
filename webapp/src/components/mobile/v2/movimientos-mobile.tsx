"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { MCard, MCardTight, MListRow } from "./mobile-card";
import type { CurrencyCode } from "@/types/domain";

type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
  category_name?: string | null;
  is_income: boolean;
};

type MovimientosProps = {
  transactions: Transaction[];
  totalExpenses: number;
  totalIncome: number;
  totalCount: number;
  currency: CurrencyCode;
};

function groupByDate(transactions: Transaction[]): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = tx.date;
    const existing = groups.get(key);
    if (existing) {
      existing.push(tx);
    } else {
      groups.set(key, [tx]);
    }
  }
  return groups;
}

export function MovimientosMobile({
  transactions,
  totalExpenses,
  totalIncome,
  totalCount,
  currency,
}: MovimientosProps) {
  const grouped = groupByDate(transactions);
  const dateKeys = Array.from(grouped.keys());

  return (
    <div className="flex flex-col gap-2.5">
      {/* Summary card */}
      <MCard className="p-0 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-white/5">
          {/* Gastos */}
          <div className="flex flex-col gap-0.5 p-3 text-center">
            <p className={MOBILE_EYEBROW_CLASS}>GASTOS</p>
            <p
              className="tabular-nums text-[#e8e4dc]"
              style={{ fontSize: 13, fontWeight: 700 }}
            >
              {formatCurrency(totalExpenses, currency)}
            </p>
          </div>

          {/* Ingresos */}
          <div className="flex flex-col gap-0.5 p-3 text-center">
            <p className={MOBILE_EYEBROW_CLASS}>INGRESOS</p>
            <p
              className="tabular-nums text-emerald-500"
              style={{ fontSize: 13, fontWeight: 700 }}
            >
              {formatCurrency(totalIncome, currency)}
            </p>
          </div>

          {/* Total */}
          <div className="flex flex-col gap-0.5 p-3 text-center">
            <p className={MOBILE_EYEBROW_CLASS}>TOTAL</p>
            <p
              className="tabular-nums text-[#e8e4dc]"
              style={{ fontSize: 13, fontWeight: 700 }}
            >
              {totalCount}
            </p>
          </div>
        </div>
      </MCard>

      {/* Date-grouped lists */}
      {dateKeys.map((dateKey) => {
        const txs = grouped.get(dateKey)!;
        return (
          <div key={dateKey} className="flex flex-col gap-1.5">
            {/* Date label as eyebrow outside the card */}
            <p className={cn(MOBILE_EYEBROW_CLASS, "px-0.5")}>
              {dateKey.toUpperCase()}
            </p>

            <MCardTight>
              {txs.map((tx) => (
                <MListRow key={tx.id}>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p
                      className="truncate text-[#e8e4dc]"
                      style={{ fontSize: 11 }}
                    >
                      {tx.description}
                    </p>
                    {tx.category_name ? (
                      <p
                        className="truncate text-[#8a9a7b]"
                        style={{ fontSize: 9 }}
                      >
                        {tx.category_name}
                      </p>
                    ) : (
                      <p
                        className="truncate text-z-brass"
                        style={{ fontSize: 9 }}
                      >
                        Sin categoria
                      </p>
                    )}
                  </div>
                  <p
                    className={cn(
                      "ml-2 shrink-0 tabular-nums",
                      tx.is_income ? "text-emerald-500" : "text-[#e8e4dc]",
                    )}
                    style={{ fontSize: 11 }}
                  >
                    {formatCurrency(tx.amount, currency)}
                  </p>
                </MListRow>
              ))}
            </MCardTight>
          </div>
        );
      })}
    </div>
  );
}
