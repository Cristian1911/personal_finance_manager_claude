"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { Archive, ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { ArchivedObligation } from "@/actions/debt";
import {
  PANEL_INSET_CLASS,
  MOBILE_EYEBROW_CLASS,
  BRASS_BUTTON_CLASS,
  BRASS_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
} from "@/lib/constants/styles";
import { Expand } from "@/components/mobile/v2/expand";
import { BankBadge } from "@/components/debt/bank-badge";
import { ExchangeRateNudge } from "@/components/debt/exchange-rate-nudge";
import type { CurrencyCode } from "@/types/domain";
import type { DebtAccount, DebtOverview, DebtStats } from "@zeta/shared";
import type { PersonasSummary, ExchangeRateInfo } from "./deudas-lens-root";

interface DeudasCuentasLensProps {
  overview: DebtOverview;
  stats: DebtStats;
  personasSummary: PersonasSummary | null;
  exchangeRate: ExchangeRateInfo | null;
  currency: CurrencyCode;
  /** Fully paid, archived obligations — streamed promise (non-critical data). */
  archived?: Promise<ArchivedObligation[]>;
  /** Opens the shared extra-payment sheet (rendered once in DeudasLensRoot). */
  onAbonar?: () => void;
}

export function DeudasCuentasLens({
  overview,
  stats,
  personasSummary,
  exchangeRate,
  currency,
  archived,
  onAbonar,
}: DeudasCuentasLensProps) {
  const remainingByName = new Map(
    stats.loans.remainingList.map((e) => [e.accountName, e.months])
  );
  const progressById = new Map(
    stats.loans.progressList.map((e) => [e.accountId, e.percentage])
  );

  const creditCards = overview.accounts.filter((a) => a.type === "CREDIT_CARD");
  const loans = overview.accounts.filter((a) => a.type === "LOAN");

  const secondaryCurrencies = overview.debtByCurrency.filter(
    (d) => d.currency !== currency && d.totalDebt > 0
  );

  return (
    <div className="space-y-3">
      {/* Deudas con personas — first-class, at the top (E1) */}
      {personasSummary && personasSummary.activeCount > 0 && (
        <PersonasCard summary={personasSummary} currency={currency} />
      )}

      {/* Header tiles feeding a shared breakdown panel (D2) */}
      <HeaderTiles overview={overview} creditCards={creditCards} currency={currency} />

      {/* Account list grouped by type — tick gauges + bank badges (F1b) */}
      {creditCards.length > 0 && (
        <>
          <GroupDivider label="Tarjetas de crédito" />
          <div className="space-y-2">
            {creditCards.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                paidPct={null}
                remainingMonths={null}
                onAbonar={onAbonar}
              />
            ))}
          </div>
        </>
      )}
      {loans.length > 0 && (
        <>
          <GroupDivider label="Préstamos" />
          <div className="space-y-2">
            {loans.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                paidPct={progressById.get(a.id) ?? null}
                remainingMonths={remainingByName.get(a.name) ?? null}
                onAbonar={onAbonar}
              />
            ))}
          </div>
        </>
      )}

      {/* Closed obligations — history, collapsed by default, streamed */}
      {archived && (
        <Suspense fallback={null}>
          <ClosedObligationsResolver promise={archived} />
        </Suspense>
      )}

      {/* Multi-currency context */}
      {exchangeRate && secondaryCurrencies.length > 0 && (
        <ExchangeRateNudge
          rate={exchangeRate.rate}
          avg30d={exchangeRate.avg30d}
          percentVsAvg={exchangeRate.percentVsAvg}
          from={exchangeRate.from}
          to={currency}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Obligaciones cerradas — paid-off history
// ──────────────────────────────────────────────────────────────────────────────

function ClosedObligationsResolver({ promise }: { promise: Promise<ArchivedObligation[]> }) {
  const archived = use(promise);
  if (archived.length === 0) return null;
  return <ClosedObligations archived={archived} />;
}

function ClosedObligations({ archived }: { archived: ArchivedObligation[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(PANEL_INSET_CLASS, open && "border-z-brass/30")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <Archive className="size-4 shrink-0 text-z-income" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-z-sage-light">Obligaciones cerradas</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {archived.length} pagada{archived.length !== 1 ? "s" : ""} por completo
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <Expand open={open}>
        <div className="space-y-1.5 px-3.5 pb-3.5">
          {archived.map((a) => (
            <Link
              key={a.id}
              href={`/accounts/${a.id}`}
              className="flex items-center gap-2.5 rounded-xl border border-white/6 bg-[#111] px-3 py-2 active:opacity-80"
            >
              <BankBadge name={a.name} className="size-7 text-[11px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-z-sage-light">{a.name}</p>
                {a.archivedAt && (
                  <p className="mt-0.5 text-[9px] text-muted-foreground">
                    cerrada el {formatDate(a.archivedAt.slice(0, 10))}
                  </p>
                )}
              </div>
              {a.totalPaid > 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold tabular-nums text-z-income">
                    {formatCurrency(a.totalPaid, a.currency)}
                  </p>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">pagado en total</p>
                </div>
              )}
            </Link>
          ))}
        </div>
      </Expand>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// E1 · Deudas con personas
// ──────────────────────────────────────────────────────────────────────────────

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

function PersonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-z-surface bg-z-surface-3 text-[10px] font-bold text-z-sage-light",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

function PersonasCard({
  summary,
  currency,
}: {
  summary: PersonasSummary;
  currency: CurrencyCode;
}) {
  const [open, setOpen] = useState(false);
  const avatarNames = [
    ...summary.owedToMe.map((p) => p.name),
    ...summary.iOwe.map((p) => p.name),
  ].slice(0, 3);

  return (
    <div className={cn(PANEL_INSET_CLASS, open && "border-z-brass/30")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        {avatarNames.length > 0 ? (
          <span className="flex shrink-0">
            {avatarNames.map((n, i) => (
              <PersonAvatar key={`${n}-${i}`} name={n} className={i > 0 ? "-ml-2" : ""} />
            ))}
          </span>
        ) : (
          <Users className="size-5 shrink-0 text-z-brass" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-z-sage-light">Deudas con personas</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {summary.activeCount} activa{summary.activeCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {summary.owedToMeTotal > 0 && (
            <>
              <p className="text-[10px] text-muted-foreground">te deben</p>
              <p className="text-sm font-bold tabular-nums text-z-income">
                {formatCurrency(summary.owedToMeTotal, currency)}
              </p>
            </>
          )}
          {summary.iOweTotal > 0 && (
            <>
              <p className={cn("text-[10px] text-muted-foreground", summary.owedToMeTotal > 0 && "mt-1")}>
                debes
              </p>
              <p className="text-sm font-bold tabular-nums text-z-debt">
                {formatCurrency(summary.iOweTotal, currency)}
              </p>
            </>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <Expand open={open}>
        <div className="space-y-1.5 px-3.5 pb-3.5">
          {summary.owedToMe.map((p, i) => (
            <div
              key={`otm-${i}`}
              className="flex items-center gap-2.5 rounded-xl border border-white/6 bg-[#111] px-3 py-2"
            >
              <PersonAvatar name={p.name} className="size-6 border-0 text-[9px]" />
              <span className="min-w-0 flex-1 truncate text-xs text-z-sage-light">
                {p.name} te debe
              </span>
              <span className="text-xs font-semibold tabular-nums text-z-income">
                {formatCurrency(p.amount, currency)}
              </span>
            </div>
          ))}
          {summary.iOwe.map((p, i) => (
            <div
              key={`io-${i}`}
              className="flex items-center gap-2.5 rounded-xl border border-white/6 bg-[#111] px-3 py-2"
            >
              <PersonAvatar name={p.name} className="size-6 border-0 text-[9px]" />
              <span className="min-w-0 flex-1 truncate text-xs text-z-sage-light">
                Le debes a {p.name}
              </span>
              <span className="text-xs font-semibold tabular-nums text-z-debt">
                {formatCurrency(p.amount, currency)}
              </span>
            </div>
          ))}
          <Link
            href="/deudas-personales"
            className={cn(
              BRASS_GHOST_BUTTON_CLASS,
              "mt-1 flex h-9 w-full items-center justify-center rounded-md border text-xs font-semibold"
            )}
          >
            Ver deudas con personas
          </Link>
        </div>
      </Expand>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// D2 · Header tiles + shared breakdown panel
// ──────────────────────────────────────────────────────────────────────────────

const STACK_COLORS = ["bg-z-debt", "bg-z-brass", "bg-z-alert", "bg-z-income"];

function HeaderTiles({
  overview,
  creditCards,
  currency,
}: {
  overview: DebtOverview;
  creditCards: DebtAccount[];
  currency: CurrencyCode;
}) {
  const [open, setOpen] = useState<"cupo" | "deuda" | null>(null);
  const toggle = (k: "cupo" | "deuda") => setOpen(open === k ? null : k);

  const cardsWithLimit = creditCards.filter((a) => a.creditLimit && a.creditLimit > 0);
  const debtParts = overview.accounts.filter((a) => a.balance > 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => toggle("cupo")}
          aria-expanded={open === "cupo"}
          className={cn(
            PANEL_INSET_CLASS,
            "flex items-center justify-between p-3.5 text-left transition-colors",
            open === "cupo" && "border-z-brass/30"
          )}
        >
          <div className="flex flex-col items-start gap-2">
            <p className={MOBILE_EYEBROW_CLASS}>Uso del cupo</p>
            <UtilizationRing percentage={overview.overallUtilization} />
          </div>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 self-start text-muted-foreground transition-transform duration-200",
              open === "cupo" && "rotate-180"
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => toggle("deuda")}
          aria-expanded={open === "deuda"}
          className={cn(
            PANEL_INSET_CLASS,
            "flex items-center justify-between p-3.5 text-left transition-colors",
            open === "deuda" && "border-z-brass/30"
          )}
        >
          <div className="flex min-w-0 flex-col items-start gap-2">
            <p className={MOBILE_EYEBROW_CLASS}>Deuda total</p>
            <div>
              <p className="text-[17px] font-[680] tabular-nums tracking-[-0.03em] text-z-debt">
                {formatCurrency(overview.totalDebt, currency)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {debtParts.length} cuenta{debtParts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 self-start text-muted-foreground transition-transform duration-200",
              open === "deuda" && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Shared panel fed by the active tile */}
      <Expand open={open !== null}>
        <div className={cn(PANEL_INSET_CLASS, "bg-black/20 p-3.5")}>
          <p className={cn(MOBILE_EYEBROW_CLASS, "mb-3")}>
            {open === "cupo" ? "Cupo por tarjeta" : "Composición de la deuda"}
          </p>
          {open === "cupo" ? (
            <div className="space-y-3">
              {cardsWithLimit.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Agrega el cupo de tus tarjetas para ver el desglose.
                </p>
              )}
              {cardsWithLimit.map((a) => {
                const pct = Math.min(100, (a.balance / (a.creditLimit ?? 1)) * 100);
                const hot = pct >= 75;
                return (
                  <div key={a.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-[11px] font-semibold text-z-sage-light">
                        {a.name}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-semibold tabular-nums",
                          hot ? "text-z-alert" : "text-z-sage-light"
                        )}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/6">
                      <div
                        className={cn("h-full rounded-full", hot ? "bg-z-alert" : "bg-z-brass")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                      {formatCurrencyCompact(a.balance, a.currency)} de{" "}
                      {formatCurrencyCompact(a.creditLimit ?? 0, a.currency)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                {debtParts.map((a, i) => (
                  <div
                    key={a.id}
                    className={cn("rounded-sm", STACK_COLORS[i % STACK_COLORS.length])}
                    style={{ width: `${(a.balance / Math.max(1, overview.totalDebt)) * 100}%` }}
                  />
                ))}
              </div>
              <div className="space-y-1.5">
                {debtParts.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        STACK_COLORS[i % STACK_COLORS.length]
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-z-sage-light">
                      {a.name}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-z-sage-light">
                      {formatCurrency(a.balance, a.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Expand>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// F1b · Grouped account rows — bank badge + segmented tick gauge
// ──────────────────────────────────────────────────────────────────────────────

function GroupDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-white/6" />
      <span className={MOBILE_EYEBROW_CLASS}>{label}</span>
      <span className="h-px flex-1 bg-white/6" />
    </div>
  );
}

const TICK_COUNT = 14;

function TickGauge({ pct, hot, paid }: { pct: number; hot: boolean; paid: boolean }) {
  const filled = Math.round((Math.min(100, pct) / 100) * TICK_COUNT);
  return (
    <div className="flex flex-1 items-center gap-0.5" aria-hidden>
      {Array.from({ length: TICK_COUNT }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 flex-1 rounded-[1.5px]",
            i < filled
              ? paid
                ? "bg-z-income"
                : hot
                  ? "bg-z-alert"
                  : "bg-z-brass"
              : "bg-white/8"
          )}
        />
      ))}
    </div>
  );
}

function AccountRow({
  account,
  paidPct,
  remainingMonths,
  onAbonar,
}: {
  account: DebtAccount;
  paidPct: number | null;
  remainingMonths: number | null;
  onAbonar?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isCC = account.type === "CREDIT_CARD";
  const usagePct =
    isCC && account.creditLimit && account.creditLimit > 0
      ? Math.min(100, (account.balance / account.creditLimit) * 100)
      : null;
  const gaugePct = isCC ? usagePct : paidPct;
  const gaugeLabel = isCC ? "uso" : "pagado";
  const hot = isCC && (usagePct ?? 0) >= 75;

  const metaParts: string[] = [];
  if (account.monthlyPayment && account.monthlyPayment > 0) {
    metaParts.push(`cuota ${formatCurrency(account.monthlyPayment, account.currency)}`);
  }
  if (account.interestRate && account.interestRate > 0) {
    metaParts.push(`${account.interestRate.toFixed(1)}% EA`);
  }
  if (!isCC && remainingMonths) metaParts.push(`faltan ${remainingMonths} meses`);

  const otherCurrencies = account.currencyBreakdown?.filter(
    (cb) => cb.currency !== account.currency && cb.balance > 0
  );

  return (
    <div className={cn(PANEL_INSET_CLASS, open && "border-z-brass/30")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <BankBadge name={account.name} institutionName={account.institutionName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-z-sage-light">
            {account.name}
          </p>
          {gaugePct != null && (
            <div className="mt-1.5 flex items-center gap-2">
              <TickGauge pct={gaugePct} hot={hot} paid={!isCC} />
              <span
                className={cn(
                  "shrink-0 text-[10px] font-bold tabular-nums",
                  !isCC ? "text-z-income" : hot ? "text-z-alert" : "text-z-brass"
                )}
              >
                {gaugePct.toFixed(0)}%
              </span>
              <span className="shrink-0 text-[9px] text-muted-foreground">{gaugeLabel}</span>
            </div>
          )}
          {metaParts.length > 0 && (
            <p className="mt-1 truncate text-[10px] tabular-nums text-muted-foreground">
              {metaParts.join(" · ")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-sm font-bold tabular-nums",
              account.balance > 0 ? "text-z-debt" : "text-z-income"
            )}
          >
            {formatCurrency(account.balance, account.currency)}
          </p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">
            {isCC ? "usado" : "saldo"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <Expand open={open}>
        <div className="space-y-2 px-3 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {isCC ? (
              <>
                <RowCell label="Usado" tone="debt">
                  {formatCurrency(account.balance, account.currency)}
                </RowCell>
                <RowCell label="Cupo">
                  {account.creditLimit
                    ? formatCurrency(account.creditLimit, account.currency)
                    : "—"}
                </RowCell>
                <RowCell label="Disponible" tone="income">
                  {account.creditLimit
                    ? formatCurrency(
                        Math.max(0, account.creditLimit - account.balance),
                        account.currency
                      )
                    : "—"}
                </RowCell>
                <RowCell label="Tasa">
                  {account.interestRate != null
                    ? `${account.interestRate.toFixed(1)}% EA`
                    : "—"}
                </RowCell>
                <RowCell label="Cuota del mes">
                  {account.monthlyPayment
                    ? formatCurrency(account.monthlyPayment, account.currency)
                    : "—"}
                </RowCell>
                <RowCell label="Corte">
                  {account.cutoffDay ? `día ${account.cutoffDay}` : "—"}
                </RowCell>
              </>
            ) : (
              <>
                <RowCell label="Saldo restante" tone="debt">
                  {formatCurrency(account.balance, account.currency)}
                </RowCell>
                <RowCell label="Pagado" tone="income">
                  {paidPct != null ? `${paidPct.toFixed(0)}%` : "—"}
                </RowCell>
                <RowCell label="Tasa">
                  {account.interestRate != null
                    ? `${account.interestRate.toFixed(1)}% EA`
                    : "—"}
                </RowCell>
                <RowCell label="Cuota mensual">
                  {account.monthlyPayment
                    ? formatCurrency(account.monthlyPayment, account.currency)
                    : "—"}
                </RowCell>
              </>
            )}
          </div>
          {otherCurrencies && otherCurrencies.length > 0 && (
            <p className="text-[10px] tabular-nums text-muted-foreground">
              También debes{" "}
              {otherCurrencies
                .map((oc) => `${formatCurrency(oc.balance, oc.currency as CurrencyCode)} ${oc.currency}`)
                .join(" · ")}
            </p>
          )}
          <div className="flex gap-2">
            {onAbonar && (
              <button
                type="button"
                onClick={onAbonar}
                className={cn(
                  BRASS_BUTTON_CLASS,
                  "flex h-9 flex-1 items-center justify-center rounded-md text-xs font-semibold"
                )}
              >
                {isCC ? "Pagar tarjeta" : "Abonar"}
              </button>
            )}
            <Link
              href={`/transactions?accountId=${account.id}`}
              className={cn(
                GHOST_BUTTON_CLASS,
                "flex h-9 flex-1 items-center justify-center rounded-md border text-xs font-semibold"
              )}
            >
              Ver movimientos
            </Link>
          </div>
        </div>
      </Expand>
    </div>
  );
}

function RowCell({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "debt" | "income";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-[#111] px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[13px] font-bold tabular-nums",
          tone === "debt" && "text-z-debt",
          tone === "income" && "text-z-income"
        )}
      >
        {children}
      </p>
    </div>
  );
}

function UtilizationRing({ percentage }: { percentage: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, percentage) / 100);
  const hot = percentage > 60;
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" className="stroke-white/6" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          className={hot ? "stroke-z-debt" : "stroke-z-brass"}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
          hot ? "text-z-debt" : "text-z-brass"
        )}
      >
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
}
