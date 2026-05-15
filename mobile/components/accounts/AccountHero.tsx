import { useMemo } from "react";
import { View, Text } from "react-native";
import { FlipZone } from "./FlipZone";
import { SpendingPulseHero } from "./SpendingPulseHero";
import { BalanceGraphHero } from "./BalanceGraphHero";
import type { AccountRow } from "../../lib/repositories/accounts";
import type {
  SnapshotPoint,
  DailyPoint,
} from "../../lib/repositories/accounts-detail";

type Variant = "flip" | "pulse" | "graph";

const DEBT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

function getHeroVariant(account: AccountRow): Variant {
  const t = account.account_type;
  if (t === "CREDIT_CARD" || t === "SAVINGS") return "flip";
  if (t === "CHECKING" && account.debit_card_mask) return "flip";
  if (t === "LOAN" || t === "INVESTMENT") return "graph";
  return "pulse";
}

type Props = {
  account: AccountRow;
  snapshotData: SnapshotPoint[];
  trendPercent?: number;
  monthlySpent?: number;
  dailyActivity?: DailyPoint[];
};

export function AccountHero({
  account,
  snapshotData,
  trendPercent,
  monthlySpent,
  dailyActivity,
}: Props) {
  const variant = getHeroVariant(account);
  const isDebt = DEBT_TYPES.has(account.account_type);

  // For debt accounts, present balance + history as positive magnitudes so
  // the chart "decays" when payments reduce the debt. Memoize to keep stable
  // references for downstream useMemo dep arrays (GraphFace SVG path math).
  const displayAccount = useMemo<AccountRow>(
    () =>
      isDebt
        ? { ...account, current_balance: Math.abs(account.current_balance ?? 0) }
        : account,
    [account, isDebt],
  );
  const displaySnapshotData = useMemo(
    () =>
      isDebt
        ? snapshotData.map((p) => ({ ...p, balance: Math.abs(p.balance) }))
        : snapshotData,
    [snapshotData, isDebt],
  );
  const displayTrendPercent =
    isDebt && trendPercent !== undefined ? -trendPercent : trendPercent;
  const goodDirection: "up" | "down" = isDebt ? "down" : "up";

  return (
    <View className="rounded-2xl border border-white-6 bg-z-surface-2 p-5">
      <View className="mb-4">
        <Text
          className="text-z-white font-inter-semibold text-lg"
          numberOfLines={1}
        >
          {account.name}
        </Text>
        {account.institution_name ? (
          <Text className="text-z-sage-dark font-inter text-xs mt-0.5">
            {account.institution_name}
          </Text>
        ) : null}
      </View>
      {variant === "flip" && (
        <FlipZone
          account={displayAccount}
          snapshotData={displaySnapshotData}
          trendPercent={displayTrendPercent}
          goodDirection={goodDirection}
        />
      )}
      {variant === "pulse" && (
        <SpendingPulseHero
          account={displayAccount}
          monthlySpent={monthlySpent ?? 0}
          dailyActivity={dailyActivity ?? []}
        />
      )}
      {variant === "graph" && (
        <BalanceGraphHero
          account={displayAccount}
          snapshotData={displaySnapshotData}
          trendPercent={displayTrendPercent}
          goodDirection={goodDirection}
        />
      )}
    </View>
  );
}
