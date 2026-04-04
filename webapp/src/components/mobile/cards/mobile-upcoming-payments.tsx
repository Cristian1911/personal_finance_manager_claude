"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, toISODateString } from "@/lib/utils/date";
import { ChevronRight } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

interface Payment {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  currencyCode: string;
  accountName?: string;
  frequency?: string;
}

function getUrgency(dueDate: string, today: string): "overdue" | "today" | "soon" | "later" {
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  const diff = (new Date(dueDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 3) return "soon";
  return "later";
}

const URGENCY_DOT = {
  overdue: "bg-z-debt",
  today: "bg-z-debt",
  soon: "bg-z-brass",
  later: "bg-z-sage-dark",
};

/** Shorten "Bancolombia VISA ****7022" → "VISA 7022" */
function shortName(name: string): string {
  const match = name.match(/(VISA|AMEX|Mastercard|MC)\s*\**(\d{4})$/i);
  if (match) return `${match[1].toUpperCase()} ${match[2]}`;
  // Fallback: if name has "****", take last segment
  const parts = name.split(" ");
  if (parts.length > 2) return parts.slice(-2).join(" ").replace(/\*+/g, "");
  return name;
}

export function MobileUpcomingPayments({ payments }: { payments: Payment[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = toISODateString(new Date());
  const visible = payments.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/4 bg-[#111] px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[7px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Pagos
        </p>
        {payments.length > 3 && (
          <Link href="/recurrentes" className="text-[9px] text-z-brass hover:underline">
            Todos ›
          </Link>
        )}
      </div>

      <div>
        {visible.map((payment) => {
          const urgency = getUrgency(payment.dueDate, today);
          const isExpanded = expandedId === payment.id;

          return (
            <div key={payment.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between py-1 text-left transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : payment.id)}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={cn("h-1 w-1 shrink-0 rounded-full", URGENCY_DOT[urgency])} />
                  <span className="truncate text-[10px] text-z-sage-light">{shortName(payment.name)}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="text-[10px] font-semibold text-z-sage-lightest">
                    {formatCurrency(payment.amount, payment.currencyCode as CurrencyCode)}
                  </span>
                  <span className={cn(
                    "text-[8px]",
                    urgency === "overdue" || urgency === "today" ? "font-medium text-z-debt" : "text-muted-foreground"
                  )}>
                    {urgency === "overdue" ? "Vencido" : urgency === "today" ? "Hoy" : formatDate(payment.dueDate, "d MMM")}
                  </span>
                </div>
              </button>

              {/* Per-item expansion */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className={cn("rounded-lg bg-black/20 p-2.5 mb-1 transition-opacity duration-150", isExpanded ? "opacity-100 delay-75" : "opacity-0")}>
                    <div className="space-y-0.5 text-[10px] text-z-sage-light">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monto</span>
                        <span>{formatCurrency(payment.amount, payment.currencyCode as CurrencyCode)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha</span>
                        <span>{formatDate(payment.dueDate, "dd MMM yyyy")}</span>
                      </div>
                    </div>
                    <Link
                      href="/recurrentes"
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-1 text-[10px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
                    >
                      Ver detalles <ChevronRight className="h-3 w-3" />
                    </Link>
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
