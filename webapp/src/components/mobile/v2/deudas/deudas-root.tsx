"use client";

import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { DeudasHero } from "./deudas-hero";
import { DeudasGrid } from "./deudas-grid";
import { DeudasFocus } from "./deudas-focus";
import { DeudasLoansChips } from "./deudas-loans-chips";
import { DeudasAccountsAccordion } from "./deudas-accounts-accordion";
import { DeudasSalaryBar } from "./deudas-salary-bar";
import Link from "next/link";
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
      />

      {/* Action row — extra payment + simulate */}
      <div className="flex items-center gap-2">
        {extraPaymentTrigger}
        <Link
          href="/deudas/planificador"
          className="rounded-full border border-white/6 bg-black/10 px-3.5 py-2 text-[11px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
        >
          Simular pagos
        </Link>
      </div>

      {/* Two rings: utilization + closest exit — expandable chips */}
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
          }))}
          currency={currency}
          activeChip={activeZone?.startsWith("grid-") ? activeZone : null}
          onToggleChip={(id) => toggle(id)}
        />
      )}

      {/* Focus — dominant debt */}
      <DeudasFocus stats={stats} currency={currency} />

      {/* Loan chips with progress bar */}
      <DeudasLoansChips
        stats={stats}
        currency={currency}
        sectionActive={activeZone === "loans"}
        onActivate={() => toggle("loans")}
      />

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
