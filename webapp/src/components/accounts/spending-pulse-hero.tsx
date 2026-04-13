"use client";

import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import type { Account, CurrencyCode } from "@/types/domain";
import type { DailyPoint } from "./account-detail-types";

interface SpendingPulseHeroProps {
  account: Account;
  monthlySpent: number;
  dailyActivity: DailyPoint[];
}

export function SpendingPulseHero({
  account,
  monthlySpent,
  dailyActivity,
}: SpendingPulseHeroProps) {
  const cc = (account.currency_code ?? "COP") as CurrencyCode;

  // Use last 30 data points for sparkline
  const sparkData = useMemo(
    () => dailyActivity.slice(-30),
    [dailyActivity]
  );

  return (
    <div className="space-y-3">
      {/* Balance row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(account.current_balance ?? 0, cc)}
          </p>
          <p className="text-xs text-z-muted mt-0.5">
            {account.institution_name ?? ""}{" "}
            {account.mask ? `• ${account.mask}` : ""}
          </p>
        </div>

        {/* Monthly spend badge */}
        <div className="rounded-xl border border-z-brass/20 bg-z-brass/8 px-3 py-1.5 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-z-brass/70">
            Este mes
          </p>
          <p className="text-sm font-bold text-z-brass">
            {formatCurrency(monthlySpent, cc)}
          </p>
        </div>
      </div>

      {/* 30-day sparkline */}
      {sparkData.length >= 2 && (
        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="spendingPulseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--z-brass)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--z-brass)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="amount"
                stroke="var(--z-brass)"
                strokeWidth={1.5}
                fill="url(#spendingPulseFill)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
