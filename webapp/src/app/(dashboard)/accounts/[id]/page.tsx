import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getAccount,
  getAccounts,
  getAccountTransactions,
  getAccountSpendingPulse,
  getAccountBalanceHistory,
} from "@/actions/accounts";
import { getStatementSnapshots, type StatementSnapshot } from "@/actions/statement-snapshots";
import { AccountHero } from "@/components/accounts/account-hero";
import { QuickActionsBar } from "@/components/accounts/quick-actions-bar";
import { RecentTransactions } from "@/components/accounts/recent-transactions";
import { StatementSnapshotsCard } from "@/components/accounts/statement-snapshots-card";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

const TYPES_WITH_HISTORY = new Set(["CREDIT_CARD", "LOAN", "SAVINGS"]);
const SPENDING_PULSE_TYPES = new Set(["CHECKING", "CASH", "OTHER"]);

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  // First batch: account + all accounts + transactions (all independent)
  const [accountResult, allAccountsResult, txResult] = await Promise.all([
    getAccount(id),
    getAccounts(),
    getAccountTransactions(id, { limit: 10 }),
  ]);

  if (!accountResult.success || !accountResult.data) return notFound();
  const account = accountResult.data;
  const allAccounts = allAccountsResult.success ? allAccountsResult.data : [];

  // Second batch: type-conditional fetches + transaction-based balance history
  const [snapshotsResult, spendingPulse, balanceHistory] = await Promise.all([
    TYPES_WITH_HISTORY.has(account.account_type)
      ? getStatementSnapshots(id)
      : Promise.resolve({ success: true as const, data: [] as StatementSnapshot[] }),
    SPENDING_PULSE_TYPES.has(account.account_type) ||
    (account.account_type === "CHECKING" && !account.debit_card_mask)
      ? getAccountSpendingPulse(id)
      : Promise.resolve({ monthlySpent: 0, dailyActivity: [] }),
    getAccountBalanceHistory(id, account.current_balance ?? 0),
  ]);

  // Snapshots still needed for StatementSnapshotsCard
  const snapshots = snapshotsResult.success ? (snapshotsResult.data ?? []) : [];

  // Trend: compare first and last points of transaction-based balance history
  let trendPercent: number | undefined;
  if (balanceHistory.length >= 2) {
    const first = balanceHistory[0].balance;
    const last = balanceHistory[balanceHistory.length - 1].balance;
    if (first !== 0) trendPercent = ((last - first) / Math.abs(first)) * 100;
  }

  // Most recent snapshot (snapshots are sorted period_to DESC from the action)
  const lastSnapshot = snapshots[0];

  // Transaction data
  const txData = txResult.success
    ? txResult.data
    : { transactions: [], hasMore: false };

  return (
    <>
      <MobileHeader variant="sub" title={account.name} backHref="/accounts" />
      <div className={PAGE_STACK_CLASS}>
        {/* Desktop back link */}
        <div className="hidden md:block">
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1.5 text-xs text-z-white/40 hover:text-z-white/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Cuentas
          </Link>
        </div>

        {/* Hero + Quick Actions: side-by-side on desktop, stacked on mobile */}
        <div className="flex flex-col md:flex-row md:items-start md:gap-6">
          <div className="flex-1 min-w-0">
            <AccountHero
              account={account}
              snapshotData={balanceHistory}
              trendPercent={trendPercent}
              monthlySpent={spendingPulse.monthlySpent}
              dailyActivity={spendingPulse.dailyActivity}
            />
          </div>
          <div className="mt-4 md:mt-0">
            <QuickActionsBar account={account} allAccounts={allAccounts} />
          </div>
        </div>

        {/* Missing debit card banner */}
        {account.account_type === "CHECKING" && !account.debit_card_mask && (
          <div className="rounded-lg border border-z-brass/20 bg-z-brass/5 px-4 py-3 text-center">
            <p className="text-xs text-z-brass">
              Agrega tu tarjeta débito para ver la vista de tarjeta
            </p>
          </div>
        )}

        <RecentTransactions
          accountId={id}
          initialTransactions={txData.transactions}
          initialHasMore={txData.hasMore}
        />

        {TYPES_WITH_HISTORY.has(account.account_type) && (
          <StatementSnapshotsCard
            accountId={id}
            count={snapshots.length}
            lastPeriod={lastSnapshot?.period_to ?? undefined}
          />
        )}
      </div>
    </>
  );
}
