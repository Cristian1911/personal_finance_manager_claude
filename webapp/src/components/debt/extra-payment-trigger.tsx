"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExtraPaymentSheet } from "./extra-payment-sheet";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type { DebtAccount } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

type SourceAccount = {
  id: string;
  name: string;
  current_balance: number;
  currency_code: string;
};

interface ExtraPaymentTriggerProps {
  debtAccounts: DebtAccount[];
  sourceAccounts: SourceAccount[];
  currency: CurrencyCode;
  usdToCopRate?: number | null;
  /** "compact" renders text-only (for mobile card layout), default renders brass button */
  variant?: "default" | "compact";
}

export function ExtraPaymentTrigger({
  debtAccounts,
  sourceAccounts,
  currency,
  usdToCopRate,
  variant = "default",
}: ExtraPaymentTriggerProps) {
  const [open, setOpen] = useState(false);

  const hasActiveDebt = debtAccounts.some((a) => a.balance > 0);
  if (!hasActiveDebt) return null;

  return (
    <div>
      {variant === "compact" ? (
        <button type="button" onClick={() => setOpen(true)} className="text-left">
          <p className="text-[12px] font-semibold leading-tight">Plata extra</p>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Abonar a deuda</p>
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} className={BRASS_BUTTON_CLASS}>
          <Banknote className="size-4" />
          Tengo plata extra
        </Button>
      )}
      <ExtraPaymentSheet
        debtAccounts={debtAccounts}
        sourceAccounts={sourceAccounts}
        currency={currency}
        usdToCopRate={usdToCopRate}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
