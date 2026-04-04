"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { MCard, MCardTight, MCardHeader, MListRow } from "./mobile-card";
import Link from "next/link";
import type { CurrencyCode } from "@/types/domain";

type DigestProps = {
  firstName: string;
  availableToSpend: number;
  committedAmount: number;
  daysToNextPayment: number | null;
  attentionItems: {
    id: string;
    label: string;
    href: string;
    priority: "action" | "suggestion";
  }[];
  budgetPercent: number;
  healthScore: number;
  debtFreeMonths: number | null;
  recentTransactions: { id: string; description: string; amount: number }[];
  currency: CurrencyCode;
};

export function DashboardDigest({
  firstName,
  availableToSpend,
  committedAmount,
  daysToNextPayment,
  attentionItems,
  budgetPercent,
  healthScore,
  debtFreeMonths,
  recentTransactions,
  currency,
}: DigestProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Greeting */}
      <p className={cn(MOBILE_EYEBROW_CLASS, "px-0.5 text-[10px]")}>
        Hola {firstName}
      </p>

      {/* Hero balance card */}
      <MCard className="flex flex-col items-center gap-1 py-5 text-center">
        <p className={MOBILE_EYEBROW_CLASS}>DISPONIBLE</p>
        <p
          className="tabular-nums text-[#e8e4dc]"
          style={{ fontSize: 34, fontWeight: 800 }}
        >
          {formatCurrency(availableToSpend, currency)}
        </p>
        <p className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5 text-[9px]")}>
          {formatCurrency(committedAmount, currency)} comprometido
          {daysToNextPayment != null
            ? ` · próximo pago en ${daysToNextPayment}d`
            : ""}
        </p>
      </MCard>

      {/* Attention card */}
      {attentionItems.length > 0 && (
        <MCardTight>
          <MCardHeader>
            <p className={cn(MOBILE_EYEBROW_CLASS, "text-z-brass")}>
              ATENCION
            </p>
          </MCardHeader>
          {attentionItems.map((item) => (
            <Link key={item.id} href={item.href} className="block">
              <MListRow>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={cn(
                      "size-[5px] shrink-0 rounded-full",
                      item.priority === "action"
                        ? "bg-z-brass"
                        : "bg-red-500",
                    )}
                  />
                  <p className="min-w-0 truncate text-[12px] text-[#e8e4dc]">
                    {item.label}
                  </p>
                </div>
                <span className="ml-2 shrink-0 text-[16px] leading-none text-muted-foreground/50">
                  ›
                </span>
              </MListRow>
            </Link>
          ))}
        </MCardTight>
      )}

      {/* Metrics strip */}
      <MCard className="p-0 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-white/5">
          {/* Plan */}
          <div className="flex flex-col items-center gap-0.5 py-3">
            <p
              className={cn(
                "tabular-nums",
                budgetPercent >= 100
                  ? "text-red-500"
                  : budgetPercent >= 75
                    ? "text-amber-400"
                    : "text-emerald-500",
              )}
              style={{ fontSize: 20, fontWeight: 700 }}
            >
              {budgetPercent}%
            </p>
            <p className={MOBILE_EYEBROW_CLASS}>PLAN</p>
          </div>

          {/* Salud */}
          <div className="flex flex-col items-center gap-0.5 py-3">
            <p
              className="tabular-nums text-[#e8e4dc]"
              style={{ fontSize: 20, fontWeight: 700 }}
            >
              {healthScore}
            </p>
            <p className={MOBILE_EYEBROW_CLASS}>SALUD</p>
          </div>

          {/* Libre */}
          <div className="flex flex-col items-center gap-0.5 py-3">
            <p
              className="tabular-nums text-[#e8e4dc]"
              style={{ fontSize: 20, fontWeight: 700 }}
            >
              {debtFreeMonths != null ? `${debtFreeMonths}m` : "—"}
            </p>
            <p className={MOBILE_EYEBROW_CLASS}>LIBRE</p>
          </div>
        </div>
      </MCard>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <MCardTight>
          <MCardHeader>
            <p className={MOBILE_EYEBROW_CLASS}>RECIENTES</p>
          </MCardHeader>
          {recentTransactions.slice(0, 3).map((tx) => (
            <MListRow key={tx.id}>
              <p className="min-w-0 flex-1 truncate text-[12px] text-[#e8e4dc]">
                {tx.description}
              </p>
              <p className="ml-2 shrink-0 tabular-nums text-[12px] text-[#e8e4dc]">
                {formatCurrency(tx.amount, currency)}
              </p>
            </MListRow>
          ))}
        </MCardTight>
      )}
    </div>
  );
}
