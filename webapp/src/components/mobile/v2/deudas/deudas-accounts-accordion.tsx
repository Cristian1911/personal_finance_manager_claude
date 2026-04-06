"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { StateChip } from "@/components/mobile/v2/state-chip";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

interface OtherCurrencyDebt {
  currency: string;
  balance: number;
}

interface DebtAccountInfo {
  id: string;
  name: string;
  type: "CREDIT_CARD" | "LOAN";
  balance: number;
  currency: string;
  interestRate: number;
  creditLimit: number;
  minPayment: number;
  paymentDay: number | null;
  otherCurrencies?: OtherCurrencyDebt[];
}

interface DeudasAccountsAccordionProps {
  accounts: DebtAccountInfo[];
  monthlyInterest: number;
  currency: CurrencyCode;
  sectionActive: boolean;
  onActivate: () => void;
}

export function DeudasAccountsAccordion({
  accounts,
  currency,
  sectionActive,
  onActivate,
}: DeudasAccountsAccordionProps) {
  const { activeZone: internalActive, toggle: internalToggle } = useExpandableZone<string>();

  // When the section is deactivated by the parent, force all accounts closed
  const activeZone = sectionActive ? internalActive : null;

  const toggle = (id: string) => {
    // Tell the parent this section is now active
    if (!sectionActive) onActivate();
    internalToggle(id);
  };

  if (accounts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
        Cuentas de deuda
      </p>

      {accounts.map((acct) => {
        const isOpen = activeZone === acct.id;
        const monthlyInterest = (acct.balance * acct.interestRate) / 100 / 12;
        const payment = acct.minPayment;

        return (
          <button
            key={acct.id}
            type="button"
            onClick={() => toggle(acct.id)}
            className={cn(
              "w-full rounded-2xl border p-3 text-left transition-colors",
              isOpen
                ? "border-z-brass/22 bg-gradient-to-b from-z-brass/[0.06] to-transparent"
                : "border-white/6 bg-[#171916]"
            )}
            aria-expanded={isOpen}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="text-[13px] font-semibold">{acct.name}</strong>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatCurrency(acct.balance, currency)} · {acct.interestRate.toFixed(1)}% EA
                </p>
                {acct.otherCurrencies?.map((oc) => (
                  <p key={oc.currency} className="text-[10px] text-amber-400">
                    + {formatCurrency(oc.balance, oc.currency as CurrencyCode)} {oc.currency}
                  </p>
                ))}
              </div>
              <StateChip
                label={isOpen ? "Abierta" : acct.balance <= 0 ? "Libre" : "Ver"}
                variant={isOpen ? "warn" : acct.balance <= 0 ? "sage" : "brass"}
              />
            </div>

            {/* Expanded detail */}
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div
                  className={cn(
                    "mt-2.5 grid gap-1.5 transition-opacity duration-150",
                    isOpen ? "opacity-100 delay-75" : "opacity-0"
                  )}
                >
                  <div className={cn(PANEL_INSET_CLASS, "border-white/8 bg-black/20 p-2.5")}>
                    <strong className="text-[11px] font-semibold">
                      Cuota {formatCurrency(payment, currency)}
                    </strong>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatCurrency(monthlyInterest, currency)} en intereses
                    </p>
                  </div>
                  {acct.paymentDay && (
                    <div className={cn(PANEL_INSET_CLASS, "border-white/8 bg-black/20 p-2.5")}>
                      <strong className="text-[11px] font-semibold">
                        Corte día {acct.paymentDay}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
