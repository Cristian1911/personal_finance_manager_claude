"use client";

import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { DeudasHero } from "./deudas-hero";
import { DeudasGrid } from "./deudas-grid";
import { DeudasAccountsAccordion } from "./deudas-accounts-accordion";
import { DeudasSalaryBar } from "./deudas-salary-bar";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Banknote, Calculator } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";
import type { DebtStats, DebtOverview, MonthlyBreakdown } from "@zeta/shared";

interface DeudasRootProps {
  stats: DebtStats;
  overview: DebtOverview;
  salaryBreakdown: MonthlyBreakdown | null;
  currency: CurrencyCode;
  extraPaymentTrigger?: React.ReactNode;
}

export function DeudasRoot({
  stats,
  overview,
  salaryBreakdown,
  currency,
  extraPaymentTrigger,
}: DeudasRootProps) {
  /** Page-level accordion — one expanded section at a time */
  const { activeZone, toggle } = useExpandableZone<string>();

  const creditCards = overview.accounts.filter((a) => a.type === "CREDIT_CARD");
  const preferredCreditCards = creditCards.filter((a) => a.currency === currency);
  const totalCreditUsed = preferredCreditCards.reduce((s, a) => s + a.balance, 0);

  // Closest to exit — match by account name to avoid data mismatch
  const closestLoan = stats.loans.remainingMonths;
  const closestProgress = closestLoan
    ? stats.loans.progressList.find((p) => p.accountName === closestLoan.accountName)
    : null;

  // Account info for accordion
  const accountInfos = overview.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as "CREDIT_CARD" | "LOAN",
    balance: a.balance,
    currency: a.currency,
    interestRate: a.interestRate ?? 0,
    creditLimit: a.creditLimit ?? 0,
    minPayment: a.monthlyPayment ?? 0,
    paymentDay: a.paymentDay,
    otherCurrencies: a.currencyBreakdown
      ?.filter((cb) => cb.currency !== a.currency && cb.balance > 0)
      .map((cb) => ({ currency: cb.currency, balance: cb.balance })),
  }));

  return (
    <div className="space-y-3">
      <MobileHeader
        variant="main"
        title="Deudas"
        subtitle={`Lectura en ${currency}`}
      />

      {/* Hero — monthly pressure */}
      <DeudasHero
        totalMonthlyPayment={stats.totalMonthlyPayment}
        monthlyInterest={overview.monthlyInterestEstimate}
        currency={currency}
        accounts={overview.accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type as "CREDIT_CARD" | "LOAN",
          monthlyPayment: a.monthlyPayment ?? 0,
          interestRate: a.interestRate ?? 0,
          balance: a.balance,
          currency: a.currency,
        }))}
        expanded={activeZone === "hero"}
        onToggle={() => toggle("hero")}
      />

      {/* Action cards — discovery chip style */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className={cn(PANEL_INSET_CLASS, "flex items-center gap-2.5 px-3 py-3")}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-z-brass/20 bg-z-brass/10">
            <Banknote className="size-4 text-z-brass" />
          </div>
          <div className="min-w-0 flex-1">
            {extraPaymentTrigger}
          </div>
        </div>
        <Link
          href="/deudas/planificador"
          className={cn(PANEL_INSET_CLASS, "flex items-center gap-2.5 px-3 py-3 transition-colors active:bg-white/[0.03]")}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-z-brass/20 bg-z-brass/10">
            <Calculator className="size-4 text-z-brass" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-tight">Simular pagos</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Planificador</p>
          </div>
        </Link>
      </div>

      {/* Three rings: utilization + closest exit + loan payment — expandable chips */}
      {overview.totalCreditLimit > 0 && (
        <DeudasGrid
          overallUtilization={overview.overallUtilization}
          totalCreditUsed={totalCreditUsed}
          totalCreditLimit={overview.totalCreditLimit}
          closestExitName={closestLoan?.accountName ?? null}
          closestExitMonths={closestLoan?.months ?? null}
          closestExitBalance={null}
          closestExitProgress={closestProgress?.percentage ?? null}
          creditCards={creditCards.map((cc) => ({
            name: cc.name,
            balance: cc.balance,
            creditLimit: cc.creditLimit ?? 0,
            utilization: cc.creditLimit ? (cc.balance / cc.creditLimit) * 100 : 0,
            otherCurrencies: cc.currencyBreakdown
              ?.filter((cb) => cb.currency !== cc.currency && cb.balance > 0)
              .map((cb) => ({
                currency: cb.currency,
                balance: cb.balance,
                creditLimit: cb.creditLimit,
              })),
          }))}
          currency={currency}
          loanMonthlyPayment={stats.loans.monthlyPayment}
          loanPayments={stats.loans.payments}
          loanProgressList={stats.loans.progressList}
          loanRemainingList={stats.loans.remainingList}
          activeChip={activeZone?.startsWith("grid-") ? activeZone : null}
          onToggleChip={(id) => toggle(id)}
        />
      )}

      {/* Salary bar — collapsed by default (NOT expandable, hover interaction only) */}
      {salaryBreakdown && (
        <DeudasSalaryBar breakdown={salaryBreakdown} currency={currency} />
      )}

      {/* Accounts accordion */}
      <DeudasAccountsAccordion
        accounts={accountInfos}
        monthlyInterest={overview.monthlyInterestEstimate}
        currency={currency}
        sectionActive={activeZone === "accounts"}
        onActivate={() => toggle("accounts")}
      />
    </div>
  );
}
