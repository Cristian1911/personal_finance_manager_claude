"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Calculator, ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  PANEL_INSET_CLASS,
  MOBILE_EYEBROW_CLASS,
  BRASS_BUTTON_CLASS,
  BRASS_GHOST_BUTTON_CLASS,
} from "@/lib/constants/styles";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";
import { Expand } from "@/components/mobile/v2/expand";
import { estimateMonthlyInterest } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";
import type { DebtAccount, DebtStats, DebtInsight } from "@zeta/shared";
import type { DebtCountdownData } from "@/actions/debt-countdown";

const INSIGHT_COLOR: Record<DebtInsight["type"], string> = {
  warning: "border-z-alert/25 text-z-alert",
  info: "border-z-brass/25 text-z-brass",
  success: "border-z-income/25 text-z-income",
};

interface DeudasPlanLensProps {
  countdown: DebtCountdownData | null;
  stats: DebtStats;
  accounts: DebtAccount[];
  insights: DebtInsight[];
  currency: CurrencyCode;
  /** Opens the shared extra-payment sheet (rendered once in DeudasLensRoot). */
  onAbonar?: () => void;
}

export function DeudasPlanLens({
  countdown,
  stats,
  accounts,
  insights,
  currency,
  onAbonar,
}: DeudasPlanLensProps) {
  const closestLoan = stats.loans.remainingMonths;
  const closestAccount = closestLoan
    ? accounts.find((a) => a.name === closestLoan.accountName) ?? null
    : null;
  const closestProgress = closestLoan
    ? stats.loans.progressList.find((p) => p.accountName === closestLoan.accountName)
    : null;
  const closestPayment = closestLoan
    ? stats.loans.payments.find((p) => p.accountName === closestLoan.accountName)
    : null;

  return (
    <div className="space-y-3">
      {/* Horizon hero — Plata extra link anchored here (C3) */}
      <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
        <p className={MOBILE_EYEBROW_CLASS}>Libre de deudas</p>
        {countdown ? (
          <>
            <p className="mt-2 text-[28px] font-[680] capitalize leading-none tracking-[-0.04em] text-z-brass">
              {formatMonthLabel(parseMonth(countdown.projectedDate))}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {countdown.monthsToFree} meses al ritmo actual
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-z-brass/80"
                style={{ width: `${countdown.progressPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {countdown.progressPercent.toFixed(0)}% del camino recorrido
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Completa cuotas mínimas en tus cuentas para proyectar tu fecha.
          </p>
        )}
        {onAbonar && (
          <button
            type="button"
            onClick={onAbonar}
            className={cn(
              BRASS_GHOST_BUTTON_CLASS,
              "mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold"
            )}
          >
            ¿Tienes plata extra? Abónala
            <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>

      {/* Próximo hito — countdown ring, expands with the payoff math (B1) */}
      {countdown && <MilestoneCard countdown={countdown} currency={currency} />}

      {/* Más cerca de cerrar — per-debt detail on tap (B1) */}
      {closestLoan && (
        <ClosestLoanCard
          accountName={closestLoan.accountName}
          months={closestLoan.months}
          account={closestAccount}
          percentage={closestProgress?.percentage ?? null}
          monthlyPayment={closestPayment?.amount ?? null}
          currency={currency}
          onAbonar={onAbonar}
        />
      )}

      {/* Insights — supporting numbers + CTA on tap (B1) */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <InsightCard
              key={insight.accountId ? `${insight.title}-${insight.accountId}` : `${insight.type}-${i}`}
              insight={insight}
              account={
                insight.accountId
                  ? accounts.find((a) => a.id === insight.accountId) ?? null
                  : null
              }
              currency={currency}
              onAbonar={onAbonar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function HeaderChevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
        open && "rotate-180"
      )}
    />
  );
}

function DetailCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-[#111] px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-bold tabular-nums">{children}</div>
    </div>
  );
}

function AbonarButton({ onAbonar }: { onAbonar?: () => void }) {
  if (!onAbonar) return null;
  return (
    <button
      type="button"
      onClick={onAbonar}
      className={cn(
        BRASS_BUTTON_CLASS,
        "flex h-9 w-full items-center justify-center rounded-md text-xs font-semibold"
      )}
    >
      Abonar a esta deuda
    </button>
  );
}

function MilestoneCard({
  countdown,
  currency,
}: {
  countdown: DebtCountdownData;
  currency: CurrencyCode;
}) {
  const [open, setOpen] = useState(false);
  const scenario = countdown.extraPaymentScenario;

  return (
    <div className={cn(PANEL_INSET_CLASS, open && "border-z-brass/30")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <MilestoneRing
          months={countdown.monthsToFree}
          fillPct={countdown.progressPercent / 100}
          tone="brass"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-z-sage-light">Próximo hito</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {countdown.monthsToFree} meses para tu última cuota
          </p>
        </div>
        <HeaderChevron open={open} />
      </button>
      <Expand open={open}>
        <div className="space-y-2 px-3.5 pb-3.5">
          <div className="grid grid-cols-2 gap-2">
            <DetailCell label="Meses restantes">{countdown.monthsToFree}</DetailCell>
            <DetailCell label="Fecha proyectada">
              <span className="capitalize">
                {formatMonthLabel(parseMonth(countdown.projectedDate))}
              </span>
            </DetailCell>
          </div>
          {scenario && (
            <div className="flex items-center gap-2.5 rounded-xl border border-white/6 bg-[#111] px-3 py-2">
              <Zap className="size-4 shrink-0 text-z-income" />
              <p className="text-[11px] leading-snug text-z-sage-light">
                Con{" "}
                <span className="font-semibold tabular-nums text-z-income">
                  {formatCurrency(scenario.extraAmount, currency)}
                </span>{" "}
                extra/mes terminarías {scenario.monthsSaved} meses antes
              </p>
            </div>
          )}
          <Link
            href="/deudas/planificador"
            className={cn(
              BRASS_GHOST_BUTTON_CLASS,
              "flex h-9 w-full items-center justify-center gap-2 rounded-md border text-xs font-semibold"
            )}
          >
            <Calculator className="size-3.5" />
            Simular pagos
          </Link>
        </div>
      </Expand>
    </div>
  );
}

function ClosestLoanCard({
  accountName,
  months,
  account,
  percentage,
  monthlyPayment,
  currency,
  onAbonar,
}: {
  accountName: string;
  months: number;
  account: DebtAccount | null;
  percentage: number | null;
  monthlyPayment: number | null;
  currency: CurrencyCode;
  onAbonar?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDetail = account != null;

  return (
    <div className={cn(PANEL_INSET_CLASS, open && "border-z-brass/30")}>
      <button
        type="button"
        onClick={() => hasDetail && setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
        disabled={!hasDetail}
      >
        <MilestoneRing months={months} fillPct={(percentage ?? 0) / 100} tone="income" />
        <div className="min-w-0 flex-1">
          <p className={cn(MOBILE_EYEBROW_CLASS, "mb-1")}>Más cerca de cerrar</p>
          <p className="truncate text-sm font-semibold text-z-sage-light">{accountName}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
            {percentage != null ? `${percentage.toFixed(0)}% pagado` : ""}
            {monthlyPayment ? ` · ${formatCurrency(monthlyPayment, currency)}/mes` : ""}
          </p>
        </div>
        {hasDetail && <HeaderChevron open={open} />}
      </button>
      {hasDetail && (
        <Expand open={open}>
          <div className="space-y-2 px-3.5 pb-3.5">
            <div className="grid grid-cols-2 gap-2">
              <DetailCell label="Saldo restante">
                <span className="text-z-debt">
                  {formatCurrency(account.balance, account.currency)}
                </span>
              </DetailCell>
              <DetailCell label="Tasa">
                {account.interestRate != null
                  ? `${account.interestRate.toFixed(1)}% EA`
                  : "—"}
              </DetailCell>
              <DetailCell label="Cuota mensual">
                {monthlyPayment != null ? formatCurrency(monthlyPayment, currency) : "—"}
              </DetailCell>
              <DetailCell label="Pagado">
                {percentage != null ? (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/6">
                      <span
                        className="block h-full rounded-full bg-z-income"
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </span>
                    <span className="text-xs text-z-income">{percentage.toFixed(0)}%</span>
                  </span>
                ) : (
                  "—"
                )}
              </DetailCell>
            </div>
            <AbonarButton onAbonar={onAbonar} />
          </div>
        </Expand>
      )}
    </div>
  );
}

function InsightCard({
  insight,
  account,
  currency,
  onAbonar,
}: {
  insight: DebtInsight;
  account: DebtAccount | null;
  currency: CurrencyCode;
  onAbonar?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const expandable = account != null;
  const monthlyInterest = account
    ? estimateMonthlyInterest(account.balance, account.interestRate)
    : 0;

  const header = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">{insight.title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{insight.description}</p>
      </div>
      {expandable && <HeaderChevron open={open} />}
    </>
  );

  return (
    <div className={cn(PANEL_INSET_CLASS, "border", INSIGHT_COLOR[insight.type])}>
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex w-full items-start gap-3 p-3 text-left"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-start gap-3 p-3">{header}</div>
      )}
      {expandable && (
        <Expand open={open}>
          <div className="space-y-2 px-3 pb-3">
            <div className="grid grid-cols-3 gap-2">
              <DetailCell label="Saldo actual">
                <span className="text-xs text-z-debt">
                  {formatCurrency(account.balance, account.currency)}
                </span>
              </DetailCell>
              <DetailCell label="Tasa">
                <span className="text-xs">
                  {account.interestRate != null
                    ? `${account.interestRate.toFixed(1)}% EA`
                    : "—"}
                </span>
              </DetailCell>
              <DetailCell label="Interés / mes">
                <span className="text-xs">
                  {monthlyInterest > 0 ? `≈ ${formatCurrency(monthlyInterest, currency)}` : "—"}
                </span>
              </DetailCell>
            </div>
            <AbonarButton onAbonar={onAbonar} />
          </div>
        </Expand>
      )}
    </div>
  );
}

function MilestoneRing({
  months,
  fillPct,
  tone = "income",
}: {
  months: number;
  fillPct: number;
  tone?: "income" | "brass";
}) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fillPct));
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" className="stroke-white/6" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          className={tone === "income" ? "stroke-z-income" : "stroke-z-brass"}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
          tone === "income" ? "text-z-income" : "text-z-brass"
        )}
      >
        {months}m
      </div>
    </div>
  );
}
