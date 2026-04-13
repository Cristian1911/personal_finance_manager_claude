import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { FlipZone } from "./flip-zone";
import { SpendingPulseHero } from "./spending-pulse-hero";
import { BalanceGraphHero } from "./balance-graph-hero";
import type { Account } from "@/types/domain";
import type { SnapshotPoint, DailyPoint } from "./account-detail-types";

interface AccountHeroProps {
  account: Account;
  snapshotData: SnapshotPoint[];
  trendPercent?: number;
  monthlySpent?: number;
  dailyActivity?: DailyPoint[];
}

function getHeroVariant(account: Account): "flip" | "pulse" | "graph" {
  const t = account.account_type;
  if (t === "CREDIT_CARD" || t === "SAVINGS") return "flip";
  if (t === "CHECKING" && account.debit_card_mask) return "flip";
  if (t === "LOAN" || t === "INVESTMENT") return "graph";
  // CHECKING without debit card, CASH, OTHER
  return "pulse";
}

export function AccountHero({
  account,
  snapshotData,
  trendPercent,
  monthlySpent,
  dailyActivity,
}: AccountHeroProps) {
  const variant = getHeroVariant(account);

  return (
    <div className={cn(PANEL_SURFACE_CLASS, "p-5")}>
      {/* Account name + subtitle */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-z-white">{account.name}</h1>
        {account.institution_name && (
          <p className="text-xs text-z-sage-dark mt-0.5">
            {account.institution_name}
          </p>
        )}
      </div>

      {/* Hero variant */}
      {variant === "flip" && (
        <FlipZone
          account={account}
          snapshotData={snapshotData}
          trendPercent={trendPercent}
        />
      )}

      {variant === "pulse" && (
        <SpendingPulseHero
          account={account}
          monthlySpent={monthlySpent ?? 0}
          dailyActivity={dailyActivity ?? []}
        />
      )}

      {variant === "graph" && (
        <BalanceGraphHero
          account={account}
          snapshotData={snapshotData}
          trendPercent={trendPercent}
        />
      )}
    </div>
  );
}
