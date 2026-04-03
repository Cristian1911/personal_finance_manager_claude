// webapp/src/components/mobile/cards/mobile-upcoming-payments.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { ChevronRight, Check } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";
import { toISODateString } from "@/lib/utils/date";

interface Payment {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  currencyCode: string;
  accountName?: string;
  frequency?: string;
}

interface MobileUpcomingPaymentsProps {
  payments: Payment[];
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

const URGENCY_LABEL = {
  overdue: "Vencido",
  today: "Hoy",
  soon: "",
  later: "",
};

export function MobileUpcomingPayments({ payments }: MobileUpcomingPaymentsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = toISODateString(new Date());
  const visible = payments.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-white/6 bg-[#111] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Próximos pagos
        </p>
        {payments.length > 3 && (
          <Link
            href="/recurrentes"
            className="flex items-center gap-0.5 text-[11px] text-z-brass hover:underline"
          >
            Ver todos <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="space-y-1">
        {visible.map((payment) => {
          const urgency = getUrgency(payment.dueDate, today);
          const isExpanded = expandedId === payment.id;

          return (
            <div key={payment.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/3"
                onClick={() => setExpandedId(isExpanded ? null : payment.id)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", URGENCY_DOT[urgency])} />
                  <span className="truncate text-xs text-z-sage-light">{payment.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-semibold text-z-sage-lightest">
                    {formatCurrency(payment.amount, payment.currencyCode as CurrencyCode)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px]",
                      urgency === "overdue" || urgency === "today"
                        ? "font-medium text-z-debt"
                        : "text-muted-foreground"
                    )}
                  >
                    {URGENCY_LABEL[urgency] || formatDate(payment.dueDate, "dd MMM")}
                  </span>
                </div>
              </button>

              {/* Per-item expansion */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div
                    className={cn(
                      "rounded-lg bg-black/20 p-3 mt-1 mb-1 transition-opacity duration-150",
                      isExpanded ? "opacity-100 delay-75" : "opacity-0"
                    )}
                  >
                    <div className="space-y-1 text-[11px] text-z-sage-light">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monto</span>
                        <span>{formatCurrency(payment.amount, payment.currencyCode as CurrencyCode)}</span>
                      </div>
                      {payment.accountName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cuenta</span>
                          <span>{payment.accountName}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha</span>
                        <span>{formatDate(payment.dueDate, "dd MMM yyyy")}</span>
                      </div>
                      {payment.frequency && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frecuencia</span>
                          <span>{payment.frequency}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Link
                        href="/recurrentes"
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-[11px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
                      >
                        Ver detalles <ChevronRight className="h-3 w-3" />
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
