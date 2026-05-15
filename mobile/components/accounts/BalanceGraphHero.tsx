import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { GraphFace, filterByRange } from "./GraphFace";
import { RangePills, type RangeValue } from "./RangePills";
import { TrendChip } from "../ui/TrendChip";
import type { AccountRow } from "../../lib/repositories/accounts";
import type { SnapshotPoint } from "../../lib/repositories/accounts-detail";

type Props = {
  account: AccountRow;
  snapshotData: SnapshotPoint[];
  trendPercent?: number;
  goodDirection?: "up" | "down";
};

export function BalanceGraphHero({
  account,
  snapshotData,
  trendPercent,
  goodDirection = "up",
}: Props) {
  const [range, setRange] = useState<RangeValue>(90);
  const filtered = useMemo(
    () => filterByRange(snapshotData, range),
    [snapshotData, range],
  );
  const cc = (account.currency_code as CurrencyCode) ?? "COP";
  const isDebt = account.account_type === "LOAN";
  const strokeColor = isDebt ? COLORS.brass : COLORS.sageLight;

  return (
    <View className="gap-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-baseline gap-2 flex-1 min-w-0">
          <Text
            className="text-z-white font-inter-bold text-2xl tabular-nums"
            numberOfLines={1}
          >
            {formatCurrency(account.current_balance ?? 0, cc)}
          </Text>
          <TrendChip percent={trendPercent} goodDirection={goodDirection} />
        </View>
        <View className="ml-2 max-w-[160px]">
          <RangePills value={range} onChange={setRange} />
        </View>
      </View>
      {filtered.length >= 2 ? (
        <GraphFace
          data={snapshotData}
          filteredData={filtered}
          currencyCode={cc}
          range={range}
          height={120}
          strokeColor={strokeColor}
          showHeader={false}
        />
      ) : (
        <View className="h-[120px] items-center justify-center rounded-xl border border-white-6 bg-z-surface-2-55">
          <Text className="text-z-sage-dark font-inter text-sm">
            Sin datos suficientes
          </Text>
        </View>
      )}
    </View>
  );
}
