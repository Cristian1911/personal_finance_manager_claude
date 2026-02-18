"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpecializedAccountForm } from "@/components/accounts/specialized-account-form";
import type { Account } from "@/types/domain";
import type { AccountFormDefaults } from "@/types/account-form";
import type { ParsedStatement } from "@/types/import";

function parseMonthName(monthName: string | undefined): number | undefined {
  if (!monthName) return undefined;
  const months: Record<string, number> = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12
  };
  const normalized = monthName.toLowerCase().replace(".", "").substring(0, 3);
  return months[normalized];
}

function deriveDefaults(stmt: ParsedStatement): AccountFormDefaults {
  const bank = stmt.bank.charAt(0).toUpperCase() + stmt.bank.slice(1);
  const mask = stmt.card_last_four ?? stmt.account_number?.slice(-4);

  let name: string;
  let accountType: string;
  let defaults: AccountFormDefaults = {
    institution_name: bank,
    mask: mask ?? undefined,
    color: "#6366f1",
    current_balance: stmt.summary?.final_balance ?? 0,
    currency_code: stmt.currency,
  };

  if (stmt.statement_type === "credit_card") {
    accountType = "CREDIT_CARD";
    name = `${bank} Tarjeta${mask ? ` ****${mask}` : ""}`;

    // Pre-fill cutoff day from statement period end date
    if (stmt.period_to) {
      const periodDate = new Date(stmt.period_to);
      defaults.cutoff_day = periodDate.getDate();
    }

    // Pre-fill from credit card metadata
    const meta = stmt.credit_card_metadata;
    if (meta) {
      if (meta.credit_limit != null) {
        defaults.credit_limit = meta.credit_limit;
      }
      if (meta.interest_rate != null) {
        defaults.interest_rate = meta.interest_rate;
      }
      if (meta.payment_due_date) {
        const paymentDate = new Date(meta.payment_due_date);
        defaults.payment_day = paymentDate.getDate();
      }
      if (meta.total_payment_due != null) {
        defaults.current_balance = meta.total_payment_due;
      }
    }
  } else if (stmt.statement_type === "loan") {
    accountType = "LOAN";
    name = `${bank} Préstamo${mask ? ` ****${mask}` : ""}`;

    const meta = stmt.loan_metadata;
    if (meta) {
      if (meta.remaining_balance != null) defaults.current_balance = meta.remaining_balance;
      if (meta.initial_amount != null) defaults.loan_amount = meta.initial_amount;
      if (meta.interest_rate != null) defaults.interest_rate = meta.interest_rate;
      if (meta.total_payment_due != null) defaults.monthly_payment = meta.total_payment_due;
      if (meta.payment_due_date) {
        const paymentDate = new Date(meta.payment_due_date);
        defaults.payment_day = paymentDate.getDate();
      }
    }
  } else {
    accountType = "SAVINGS";
    name = `${bank} Ahorros${mask ? ` ****${mask}` : ""}`;
    // Current balance is the final balance from the statement
    defaults.current_balance = stmt.summary?.final_balance ?? 0;
  }

  return {
    ...defaults,
    name,
    account_type: accountType,
  };
}

export function CreateAccountDialog({
  statement,
  open,
  onOpenChange,
  onCreated,
}: {
  statement: ParsedStatement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (account: Account) => void;
}) {
  const defaults = deriveDefaults(statement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear cuenta desde extracto</DialogTitle>
        </DialogHeader>
        <SpecializedAccountForm
          defaultValues={defaults}
          onSuccess={(account) => {
            onCreated(account);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
