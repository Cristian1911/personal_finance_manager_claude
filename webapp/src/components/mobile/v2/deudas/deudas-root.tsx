"use client";

import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { DeudasHero } from "./deudas-hero";
import { DeudasGrid } from "./deudas-grid";
import { DeudasAccountsAccordion } from "./deudas-accounts-accordion";
import { DeudasSalaryBar } from "./deudas-salary-bar";
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

      {/* Action chips */}
      {(() => {
        const chipClass = "inline-flex items-center gap-2 rounded-full border border-white/6 bg-white/[0.03] px-3 py-1.5 text-xs transition-colors";
        return (
          <div className="flex flex-wrap gap-2 px-1">
            <div className={chipClass}>
              <Banknote className="size-3.5 text-z-brass" />
              {extraPaymentTrigger}
            </div>
            <Link
              href="/deudas/planificador"
              className={`${chipClass} active:bg-white/[0.06]`}
            >
              <Calculator className="size-3.5 text-z-brass" />
              <span>Simular pagos</span>
            </Link>
          </div>
        );
      })()}

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
