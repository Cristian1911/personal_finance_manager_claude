"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronRight } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

type ExpandedSection = "math" | "saldo" | "fijos" | "proximo" | null;

interface HeroAccount {
  id: string;
  name: string;
  currentBalance: number;
  currencyCode: string;
}

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  currencyCode: string;
}

interface NextPayment {
  name: string;
  amount: number;
  dueDate: string;
  currencyCode: string;
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

function getCapacityMessage(available: number): string {
  if (available <= 0) return "Sin margen — revisa tus gastos";
  if (available < 100_000) return "Compras pequeñas ✓";
  if (available < 500_000) return "Margen moderado";
  return "Buen margen este período";
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

  const code = currency;
  const isNegative = availableToSpend < 0;

  return (
    <div className="rounded-[18px] border border-white/6 bg-[linear-gradient(160deg,#1a2518,#0d1117)] p-4">
      {/* Hero number — tappable for math */}
      <button
        type="button"
        className="w-full text-left"
        onClick={() => toggle("math")}
        aria-expanded={expanded === "math"}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Disponible para gastar
        </p>
        <p
          className={cn(
            "mt-1 text-[30px] font-bold leading-tight tracking-tight",
            isNegative ? "text-z-debt" : "text-z-sage-lightest"
          )}
        >
          {formatCurrency(availableToSpend, code)}
        </p>
        <p className={cn("mt-1 text-xs", isNegative ? "text-z-debt/70" : "text-z-sage-dark")}>
          {getCapacityMessage(availableToSpend)}
        </p>
      </button>

      {/* Math expansion */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded === "math" ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "pt-3 transition-opacity duration-150",
              expanded === "math" ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            <div className="rounded-xl bg-black/20 p-3 text-xs">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cómo se calcula
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-z-sage-light">
                  <span>Saldo total</span>
                  <span>{formatCurrency(totalBalance, code)}</span>
                </div>
                <div className="flex justify-between text-z-expense">
                  <span>− Gastos fijos</span>
                  <span>{formatCurrency(pendingFixed, code)}</span>
                </div>
                <div className="flex justify-between text-z-expense">
                  <span>− Ya gastado</span>
                  <span>{formatCurrency(totalSpent, code)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1.5 font-semibold text-z-sage-lightest">
                  <span>= Disponible</span>
                  <span>{formatCurrency(availableToSpend, code)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat chips */}
      <div className="mt-3 flex gap-2">
        <ChipButton
          label="Saldo"
          value={formatCurrency(totalBalance, code)}
          active={expanded === "saldo"}
          onClick={() => toggle("saldo")}
        />
        <ChipButton
          label="Fijos"
          value={formatCurrency(pendingFixed, code)}
          active={expanded === "fijos"}
          onClick={() => toggle("fijos")}
        />
        <ChipButton
          label="Prox."
          value={daysToNextPayment != null ? `${daysToNextPayment}d` : "—"}
          active={expanded === "proximo"}
          onClick={() => toggle("proximo")}
        />
      </div>

      {/* Saldo expansion */}
      <ChipDetail visible={expanded === "saldo"}>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-z-brass">
          Saldo por cuenta
        </p>
        {liquidAccounts.length > 0 ? (
          <div className="space-y-1">
            {liquidAccounts.map((acc) => (
              <div key={acc.id} className="flex justify-between text-xs text-z-sage-light">
                <span className="truncate mr-2">{acc.name}</span>
                <span className="shrink-0">
                  {formatCurrency(acc.currentBalance, acc.currencyCode as CurrencyCode)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin cuentas líquidas</p>
        )}
        <Link
          href="/accounts"
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-[11px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
        >
          Ver cuentas <ChevronRight className="h-3 w-3" />
        </Link>
      </ChipDetail>

      {/* Fijos expansion */}
      <ChipDetail visible={expanded === "fijos"}>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-z-brass">
          Gastos fijos del período
        </p>
        {fixedExpenses.length > 0 ? (
          <>
            <div className="space-y-1">
              {fixedExpenses.map((exp) => (
                <div key={exp.id} className="flex justify-between text-xs text-z-sage-light">
                  <span className="truncate mr-2">{exp.name}</span>
                  <span className="shrink-0">
                    {formatCurrency(exp.amount, exp.currencyCode as CurrencyCode)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between border-t border-white/10 pt-1.5 text-xs font-semibold text-z-sage-lightest">
              <span>Total fijos</span>
              <span>{formatCurrency(pendingFixed, code)}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sin gastos fijos registrados</p>
        )}
      </ChipDetail>

      {/* Próximo expansion */}
      <ChipDetail visible={expanded === "proximo"}>
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
              <span>{formatCurrency(nextPayment.amount, nextPayment.currencyCode as CurrencyCode)}</span>
            </div>
            <div className="flex justify-between">
              <span>Fecha</span>
              <span>{nextPayment.dueDate}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin pagos próximos</p>
        )}
      </ChipDetail>
    </div>
  );
}

function ChipButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center rounded-xl bg-black/20 px-2 py-1.5 transition-colors",
        active && "bg-z-brass/10 ring-1 ring-z-brass/30"
      )}
      aria-expanded={active}
    >
      <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-[13px] font-semibold", active ? "text-z-brass" : "text-z-sage-light")}>
        {value}
      </span>
    </button>
  );
}

function ChipDetail({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: visible ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "rounded-xl bg-black/20 p-3 mt-2 transition-opacity duration-150",
            visible ? "opacity-100 delay-75" : "opacity-0"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
