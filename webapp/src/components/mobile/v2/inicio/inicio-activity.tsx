"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryIcon } from "@/components/categories/category-icon";
import { TagChip } from "@/components/tags/tag-chip";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (transactions.length === 0) return null;

  const visible = transactions.slice(0, 3);

  return (
    <div>
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-z-sage-dark">
        Reciente
      </p>

      <div>
        {visible.map((tx) => {
          const isOpen = expandedId === tx.id;
          return (
            <div key={tx.id}>
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : tx.id)}
                className={cn(
                  "flex w-full gap-2 px-1 py-2 text-left transition-colors active:bg-white/[0.03]",
                  isOpen && "border-l-2 border-l-z-brass pl-2"
                )}
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
                    <span className="text-white/15">&middot;</span>
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
                          tag={{ name: t.name, color: t.color }}
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
              </button>

              {/* Inline expand */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className={cn("py-1.5 transition-opacity duration-150", isOpen ? "opacity-100" : "opacity-0")}>
                    <div className={cn(PANEL_INSET_CLASS, "border-z-brass/15 bg-black/20 p-2.5 flex items-center justify-between")}>
                      <span className="text-[11px] text-muted-foreground">
                        {tx.direction === "INFLOW" ? "Ingreso" : "Gasto"} &middot; {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                      </span>
                      <Link
                        href={`/transactions/${tx.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
                      >
                        <Pencil className="size-2.5" />
                        Ver detalle
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 text-center">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
        >
          Ver todos
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
