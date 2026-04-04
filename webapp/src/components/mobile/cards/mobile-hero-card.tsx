"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { ChevronRight } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

type ExpandedSection = "math" | "saldo" | "fijos" | "proximo" | null;

interface HeroAccount {
  id: string;
  name: string;
  currentBalance: number;
  currencyCode: CurrencyCode;
}

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  currencyCode: CurrencyCode;
}

interface NextPayment {
  name: string;
  amount: number;
  dueDate: string;
  currencyCode: CurrencyCode;
}

export interface MobileHeroCardProps {
  availableToSpend: number;
  totalBalance: number;
  pendingFixed: number;
  totalSpent: number;
  currency: CurrencyCode;
  daysToNextPayment: number | null;
  liquidAccounts: HeroAccount[];
  fixedExpenses: FixedExpense[];
  nextPayment: NextPayment | null;
}

function abbreviate(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${amount}`;
}

export function MobileHeroCard({
  availableToSpend,
  totalBalance,
  pendingFixed,
  totalSpent,
  currency,
  daysToNextPayment,
  liquidAccounts,
  fixedExpenses,
  nextPayment,
}: MobileHeroCardProps) {
  const [expanded, setExpanded] = useState<ExpandedSection>(null);

  function toggle(section: ExpandedSection) {
    setExpanded((prev) => (prev === section ? null : section));
  }

  const isNegative = availableToSpend < 0;

  return (
    <div className="rounded-[18px] border border-white/6 bg-[linear-gradient(160deg,#1a2518,#0d1117)] p-3.5">
      {/* Hero number — tappable for math */}
      <button
        type="button"
        className="w-full text-center"
        onClick={() => toggle("math")}
        aria-expanded={expanded === "math"}
      >
        <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-z-sage-dark">
          Disponible
        </p>
        <p
          className={cn(
            "mt-0.5 text-[32px] font-extrabold leading-tight tracking-tight",
            isNegative ? "text-z-debt" : "text-z-sage-lightest"
          )}
        >
          {formatCurrency(availableToSpend, currency)}
        </p>
      </button>

      {/* Math expansion */}
      <CollapsePanel visible={expanded === "math"}>
        <div className="rounded-xl bg-black/20 p-3 text-xs">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cómo se calcula
          </p>
          <div className="space-y-1">
            <div className="flex justify-between text-z-sage-light">
              <span>Saldo total</span>
              <span>{formatCurrency(totalBalance, currency)}</span>
            </div>
            <div className="flex justify-between text-z-expense">
              <span>− Gastos fijos</span>
              <span>{formatCurrency(pendingFixed, currency)}</span>
            </div>
            <div className="flex justify-between text-z-expense">
              <span>− Ya gastado</span>
              <span>{formatCurrency(totalSpent, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-1.5 font-semibold text-z-sage-lightest">
              <span>= Disponible</span>
              <span>{formatCurrency(availableToSpend, currency)}</span>
            </div>
          </div>
          <Link
            href="/accounts"
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-[11px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
          >
            Ver cuentas <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CollapsePanel>

      {/* Proportion bar */}
      <div className="mx-3 mt-2.5">
        <div className="flex h-[3px] gap-[1px] overflow-hidden rounded-sm">
          <button
            type="button"
            className="transition-opacity hover:opacity-80"
            style={{ flex: Math.max(totalBalance, 1) }}
            onClick={() => toggle("saldo")}
            aria-label="Ver saldo por cuenta"
          >
            <div className={cn("h-full rounded-l-sm bg-z-sage-light", expanded === "saldo" && "ring-1 ring-z-sage-light ring-offset-1 ring-offset-[#0d1117]")} />
          </button>
          <button
            type="button"
            className="transition-opacity hover:opacity-80"
            style={{ flex: Math.max(pendingFixed, 1) }}
            onClick={() => toggle("fijos")}
            aria-label="Ver gastos fijos"
          >
            <div className={cn("h-full rounded-r-sm bg-z-brass", expanded === "fijos" && "ring-1 ring-z-brass ring-offset-1 ring-offset-[#0d1117]")} />
          </button>
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
          <button type="button" onClick={() => toggle("saldo")} className="flex items-center gap-1 hover:text-z-sage-light transition-colors">
            <span className="inline-block h-1.5 w-1.5 rounded-[1px] bg-z-sage-light" />
            Saldo {abbreviate(totalBalance)}
          </button>
          <button type="button" onClick={() => toggle("fijos")} className="flex items-center gap-1 hover:text-z-brass transition-colors">
            <span className="inline-block h-1.5 w-1.5 rounded-[1px] bg-z-brass" />
            Fijos {abbreviate(pendingFixed)}
          </button>
          <button type="button" onClick={() => toggle("proximo")} className="hover:text-z-sage-light transition-colors">
            Prox. {daysToNextPayment != null ? `${daysToNextPayment}d` : "—"}
          </button>
        </div>
      </div>

      {/* Saldo expansion */}
      <CollapsePanel visible={expanded === "saldo"}>
        <div className="rounded-xl bg-black/20 p-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-z-brass">
            Saldo por cuenta
          </p>
          {liquidAccounts.length > 0 ? (
            <div className="space-y-1">
              {liquidAccounts.map((acc) => (
                <div key={acc.id} className="flex justify-between text-xs text-z-sage-light">
                  <span className="mr-2 truncate">{acc.name}</span>
                  <span className="shrink-0">{formatCurrency(acc.currentBalance, acc.currencyCode)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin cuentas líquidas</p>
          )}
        </div>
      </CollapsePanel>

      {/* Fijos expansion */}
      <CollapsePanel visible={expanded === "fijos"}>
        <div className="rounded-xl bg-black/20 p-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-z-brass">
            Gastos fijos del período
          </p>
          {fixedExpenses.length > 0 ? (
            <>
              <div className="space-y-1">
                {fixedExpenses.map((exp) => (
                  <div key={exp.id} className="flex justify-between text-xs text-z-sage-light">
                    <span className="mr-2 truncate">{exp.name}</span>
                    <span className="shrink-0">{formatCurrency(exp.amount, exp.currencyCode)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between border-t border-white/10 pt-1.5 text-xs font-semibold text-z-sage-lightest">
                <span>Total fijos</span>
                <span>{formatCurrency(pendingFixed, currency)}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sin gastos fijos registrados</p>
          )}
        </div>
      </CollapsePanel>

      {/* Próximo expansion */}
      <CollapsePanel visible={expanded === "proximo"}>
        <div className="rounded-xl bg-black/20 p-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-z-brass">
            Próximo pago
          </p>
          {nextPayment ? (
            <div className="space-y-1 text-xs text-z-sage-light">
              <div className="flex justify-between">
                <span>Nombre</span>
                <span>{nextPayment.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Monto</span>
                <span>{formatCurrency(nextPayment.amount, nextPayment.currencyCode)}</span>
              </div>
              <div className="flex justify-between">
                <span>Fecha</span>
                <span>{formatDate(nextPayment.dueDate, "dd MMM yyyy")}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin pagos próximos</p>
          )}
        </div>
      </CollapsePanel>
    </div>
  );
}

// ─── Shared collapse panel ───────────────────────────────────────────────────

function CollapsePanel({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: visible ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "mt-2 transition-opacity duration-150",
            visible ? "opacity-100 delay-75" : "opacity-0"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
