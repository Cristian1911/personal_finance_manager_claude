"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
}

interface InicioActivityProps {
  transactions: Transaction[];
}

export function InicioActivity({ transactions }: InicioActivityProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (transactions.length === 0) return null;

  const visible = transactions.slice(0, 3);

  return (
    <div>
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
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
                  "flex w-full items-center justify-between py-2 text-left transition-colors active:bg-white/[0.03]",
                  "[&+div]:border-t [&+div]:border-white/6",
                  isOpen && "border-l-2 border-l-z-brass pl-2"
                )}
              >
                <span className="min-w-0 truncate text-[13px] text-foreground">
                  {tx.description}
                </span>
                <span
                  className={cn(
                    "shrink-0 pl-3 text-[13px] font-medium tabular-nums",
                    tx.direction === "INFLOW" ? "text-z-income" : "text-foreground"
                  )}
                >
                  {tx.direction === "INFLOW" ? "+" : "-"}
                  {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                </span>
              </button>

              {/* Inline quick view */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className={cn("py-1.5 transition-opacity duration-150", isOpen ? "opacity-100" : "opacity-0")}>
                    <div className={cn(PANEL_INSET_CLASS, "border-z-brass/15 bg-black/20 p-2.5 flex items-center justify-between")}>
                      <span className="text-[11px] text-muted-foreground">
                        {tx.direction === "INFLOW" ? "Ingreso" : "Gasto"} · {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                      </span>
                      <Link
                        href={`/transactions/${tx.id}`}
                        className="text-[11px] font-semibold text-z-brass"
                      >
                        Ver detalle →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
