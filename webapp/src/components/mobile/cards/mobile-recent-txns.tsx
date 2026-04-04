"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface RecentTransaction {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
}

export function MobileRecentTxns({ transactions }: { transactions: RecentTransaction[] }) {
  const visible = transactions.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/4 bg-[#111] px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[7px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Recientes
        </p>
        <Link href="/transactions" className="text-[9px] text-z-brass hover:underline">
          Todos ›
        </Link>
      </div>

      <div>
        {visible.map((tx) => (
          <Link
            key={tx.id}
            href={`/transactions/${tx.id}`}
            className="flex items-center justify-between py-1 transition-colors hover:bg-white/3 active:bg-white/5 -mx-1 px-1 rounded"
          >
            <span className="truncate text-[10px] text-muted-foreground">{tx.description}</span>
            <span
              className={cn(
                "shrink-0 ml-2 text-[10px]",
                tx.direction === "INFLOW" ? "text-z-income font-semibold" : "text-z-sage-light"
              )}
            >
              {tx.direction === "INFLOW" ? "+" : "-"}
              {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
