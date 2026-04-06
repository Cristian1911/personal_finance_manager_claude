"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

interface CurrencyDebtInfo {
  currency: string;
  balance: number;
  creditLimit?: number | null;
}

interface CreditCardInfo {
  name: string;
  balance: number;
  creditLimit: number;
  utilization: number;
  otherCurrencies?: CurrencyDebtInfo[];
}

interface DeudasGridProps {
  overallUtilization: number;
  totalCreditUsed: number;
  totalCreditLimit: number;
  closestExitName: string | null;
  closestExitMonths: number | null;
  closestExitBalance: number | null;
  closestExitProgress: number | null;
  creditCards?: CreditCardInfo[];
  currency: CurrencyCode;
  /** Controlled from parent page-level accordion */
  activeChip: string | null;
  onToggleChip: (id: string) => void;
}

const ringR = 22;
const ringCircumference = 2 * Math.PI * ringR;

function Ring({
  pct,
  color,
  label,
  sublabel,
}: {
  pct: number;
  color: string;
  label: string;
  sublabel?: string;
}) {
  return (
    <svg width="52" height="52" viewBox="0 0 58 58" className="mx-auto mt-1.5 mb-1">
      <circle cx="29" cy="29" r={ringR} fill="none" stroke="#2a2d28" strokeWidth="5" />
      <circle
        cx="29" cy="29" r={ringR} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${Math.round(((pct / 100) * ringCircumference) * 100) / 100} ${Math.round(ringCircumference * 100) / 100}`}
        strokeLinecap="round" transform="rotate(-90 29 29)"
      />
      <text x="29" y={sublabel ? "24" : "29"} fill={color} fontSize="13" fontWeight="700" textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
      {sublabel && (
        <text x="29" y="37" fill="var(--z-sage-dark)" fontSize="7" textAnchor="middle">
          {sublabel}
        </text>
      )}
    </svg>
  );
}

export function DeudasGrid({
  overallUtilization,
  totalCreditUsed,
  totalCreditLimit,
  closestExitName,
  closestExitMonths,
  closestExitBalance,
  closestExitProgress,
  creditCards = [],
  currency,
  activeChip,
  onToggleChip,
}: DeudasGridProps) {
  const utilizationColor =
    overallUtilization <= 30 ? "var(--z-income)"
    : overallUtilization <= 70 ? "var(--z-alert)"
    : "var(--z-debt)";

  const exitProgress = closestExitProgress ?? 0;
  const isUsoActive = activeChip === "grid-uso";
  const isSalidaActive = activeChip === "grid-salida";
  const hasActive = isUsoActive || isSalidaActive;

  return (
    <div>
      {/* Chip row */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Uso del cupo — clickable chip */}
        <button
          type="button"
          onClick={() => onToggleChip("grid-uso")}
          className={cn(
            PANEL_INSET_CLASS,
            "w-full p-3 text-center transition-colors",
            isUsoActive && "ring-1 ring-z-brass/30 bg-z-brass/[0.06]"
          )}
          aria-expanded={isUsoActive}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Uso del cupo
          </p>
          <Ring pct={overallUtilization} color={utilizationColor} label={`${overallUtilization.toFixed(0)}%`} />
          <p className="text-[10px] text-muted-foreground">
            {formatCurrency(totalCreditUsed, currency)} de {formatCurrency(totalCreditLimit, currency)}
          </p>
        </button>

        {/* Próxima salida — clickable chip */}
        <button
          type="button"
          onClick={() => onToggleChip("grid-salida")}
          className={cn(
            PANEL_INSET_CLASS,
            "w-full p-3 text-center transition-colors",
            isSalidaActive && "ring-1 ring-z-income/30 bg-z-income/[0.06]"
          )}
          aria-expanded={isSalidaActive}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Próxima salida
          </p>
          {closestExitName ? (
            <>
              <Ring pct={exitProgress} color="var(--z-income)" label={`${closestExitMonths}m`} sublabel={`${exitProgress.toFixed(0)}%`} />
              <p className="text-[10px] text-muted-foreground">
                {closestExitName}{closestExitBalance ? ` · ${formatCurrency(closestExitBalance, currency)}` : ""}
              </p>
            </>
          ) : (
            <div className="flex h-[60px] items-center justify-center text-xs text-muted-foreground">
              Sin datos
            </div>
          )}
        </button>
      </div>

      {/* Full-width expanded panel below both chips */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: hasActive ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={cn("mt-1.5 transition-opacity duration-150", hasActive ? "opacity-100 delay-75" : "opacity-0")}>
            {isUsoActive && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3 space-y-2")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
                  Uso por tarjeta
                </p>
                {creditCards.length > 0 ? (
                  creditCards.map((cc) => (
                    <div key={cc.name} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="truncate mr-2 text-z-sage-light">{cc.name}</span>
                        <span className="shrink-0 font-semibold" style={{ color: cc.utilization > 70 ? "var(--z-debt)" : cc.utilization > 30 ? "var(--z-alert)" : "var(--z-income)" }}>
                          {cc.utilization.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(cc.utilization, 100)}%`,
                            backgroundColor: cc.utilization > 70 ? "var(--z-debt)" : cc.utilization > 30 ? "var(--z-alert)" : "var(--z-income)",
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {formatCurrency(cc.balance, currency)} de {formatCurrency(cc.creditLimit, currency)}
                      </p>
                      {cc.otherCurrencies?.map((oc) => (
                        <p key={oc.currency} className="text-[10px] text-muted-foreground">
                          + {formatCurrency(oc.balance, oc.currency as CurrencyCode)} {oc.currency}
                        </p>
                      ))}
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-muted-foreground">Sin tarjetas de crédito</p>
                )}
              </div>
            )}

            {isSalidaActive && closestExitName && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-income/20 bg-black/20 p-3 space-y-2")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-income">
                  Detalle de salida
                </p>
                <p className="text-[11px] text-z-sage-light">
                  {closestExitName}
                </p>
                {exitProgress > 0 && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-z-brass" style={{ width: `${Math.min(exitProgress, 100)}%` }} />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {exitProgress.toFixed(0)}% pagado · {closestExitMonths}m restantes
                  {closestExitBalance ? ` · ${formatCurrency(closestExitBalance, currency)}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
