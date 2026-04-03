// webapp/src/components/mobile/cards/mobile-recent-txns.tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

interface RecentTransaction {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
}

interface MobileRecentTxnsProps {
  transactions: RecentTransaction[];
}

export function MobileRecentTxns({ transactions }: MobileRecentTxnsProps) {
  const visible = transactions.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-white/6 bg-[#111] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Últimos movimientos
        </p>
        <Link
          href="/transactions"
          className="flex items-center gap-0.5 text-[11px] text-z-brass hover:underline"
        >
          Ver todos <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-0.5">
        {visible.map((tx) => (
          <Link
            key={tx.id}
            href={`/transactions/${tx.id}`}
            className="flex items-center justify-between rounded-lg px-1 py-1.5 transition-colors hover:bg-white/3 active:bg-white/5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5">
                {tx.direction === "INFLOW" ? (
                  <ArrowDownLeft className="h-3 w-3 text-z-income" />
                ) : (
                  <ArrowUpRight className="h-3 w-3 text-z-expense" />
                )}
              </div>
              <span className="truncate text-xs text-z-sage-light">{tx.description}</span>
            </div>
            <span
              className={cn(
                "shrink-0 ml-2 text-xs font-medium",
                tx.direction === "INFLOW" ? "text-z-income" : "text-foreground"
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
