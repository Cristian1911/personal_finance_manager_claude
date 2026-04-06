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
}

export function ExtraPaymentTrigger({
  debtAccounts,
  sourceAccounts,
  currency,
}: ExtraPaymentTriggerProps) {
  const [open, setOpen] = useState(false);

  const hasActiveDebt = debtAccounts.some((a) => a.balance > 0);
  if (!hasActiveDebt) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)} className={BRASS_BUTTON_CLASS}>
        <Banknote className="size-4" />
        Tengo plata extra
      </Button>
      <ExtraPaymentSheet
        debtAccounts={debtAccounts}
        sourceAccounts={sourceAccounts}
        currency={currency}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
