"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryIcon } from "@/components/categories/category-icon";
import { TagChip } from "@/components/tags/tag-chip";
import type { CurrencyCode } from "@/types/domain";

interface RecentTransactionMobile {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
  account_name: string;
  account_color: string | null;
  category_name: string | null;
  category_icon: string | null;
  tags: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
}

interface InicioActivityProps {
  transactions: RecentTransactionMobile[];
}

export function InicioActivity({ transactions }: InicioActivityProps) {
  if (transactions.length === 0) return null;

  const visible = transactions.slice(0, 3);

  return (
    <div>
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-z-sage-dark">
        Reciente
      </p>

      <div className="space-y-0.5">
        {visible.map((tx) => (
          <Link
            key={tx.id}
            href={`/transactions/${tx.id}`}
            className="flex gap-2 rounded-xl px-1 py-2 transition-colors active:bg-white/[0.03]"
          >
            {/* Direction icon */}
            <div
              className={cn(
                "mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-md",
                tx.direction === "INFLOW"
                  ? "bg-green-500/12 text-z-income"
                  : "bg-orange-500/12 text-z-expense"
              )}
            >
              {tx.direction === "INFLOW" ? (
                <ArrowDownLeft className="size-3" />
              ) : (
                <ArrowUpRight className="size-3" />
              )}
            </div>

            {/* Description + meta */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{tx.description}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span
                  className="inline-block size-[5px] shrink-0 rounded-full"
                  style={{ backgroundColor: tx.account_color ?? undefined }}
                />
                <span className="truncate">{tx.account_name}</span>
                <span className="text-white/15">·</span>
                {tx.category_icon ? (
                  <span className="inline-flex items-center gap-0.5 truncate">
                    <CategoryIcon icon={tx.category_icon} className="size-3 shrink-0" />
                    {tx.category_name}
                  </span>
                ) : (
                  <span className="text-z-brass">Sin cat.</span>
                )}
              </p>
              {tx.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {tx.tags.map((t) => (
                    <TagChip
                      key={t.id}
                      tag={{ id: t.id, name: t.name, color: t.color } as any}
                      groupColor={t.group_color}
                      size="sm"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Amount */}
            <span
              className={cn(
                "shrink-0 text-xs font-medium tabular-nums",
                tx.direction === "INFLOW" && "text-z-income"
              )}
            >
              {tx.direction === "INFLOW" ? "+" : "-"}
              {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/transactions"
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
      >
        Ver todos
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
