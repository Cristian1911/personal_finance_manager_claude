import { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import type { AccountRow } from "../../lib/repositories/accounts";
import type { DailyPoint } from "../../lib/repositories/accounts-detail";

type Props = {
  account: AccountRow;
  monthlySpent: number;
  dailyActivity: DailyPoint[];
};

export function SpendingPulseHero({
  account,
  monthlySpent,
  dailyActivity,
}: Props) {
  const cc = (account.currency_code as CurrencyCode) ?? "COP";

  // Use last 30 data points for the sparkline
  const sparkData = useMemo(
    () => dailyActivity.slice(-30),
    [dailyActivity],
  );

  const w = 320;
  const h = 40;
  const sparkPath = useMemo(() => {
    if (sparkData.length < 2) return "";
    const max = Math.max(...sparkData.map((p) => p.amount), 0);
    const span = max || 1;
    const stepX = w / (sparkData.length - 1);
    return sparkData
      .map((p, i) => {
        const x = i * stepX;
        const y = h - (p.amount / span) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [sparkData]);

  const areaPath = sparkPath
    ? `${sparkPath} L${w.toFixed(1)},${h} L0,${h} Z`
    : "";

  return (
    <View className="gap-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 min-w-0">
          <Text className="text-z-white font-inter-bold text-2xl tabular-nums">
            {formatCurrency(account.current_balance ?? 0, cc)}
          </Text>
          <Text
            className="text-z-sage-dark font-inter text-xs mt-0.5"
            numberOfLines={1}
          >
            {account.institution_name ?? ""}
            {account.debit_card_mask ? ` • ${account.debit_card_mask}` : ""}
          </Text>
        </View>
        <View className="rounded-xl border border-z-brass-20 bg-z-brass-8 px-3 py-1.5 items-end">
          <Text
            className="text-z-brass-70 font-inter-semibold text-[10px] uppercase"
            style={{ letterSpacing: 1.8 }}
          >
            Este mes
          </Text>
          <Text className="text-z-brass font-inter-bold text-sm tabular-nums">
            -{formatCurrency(monthlySpent, cc)}
          </Text>
        </View>
      </View>
      {sparkData.length >= 2 && (
        <View style={{ height: h }}>
          <Svg
            width="100%"
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLORS.brass} stopOpacity={0.2} />
                <Stop offset="1" stopColor={COLORS.brass} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#pulseFill)" />
            <Path
              d={sparkPath}
              stroke={COLORS.brass}
              strokeWidth={1.5}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      )}
    </View>
  );
}
