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
import { normalizeAccountMaskSuffix } from "@/lib/utils/account-mask";


function deriveDefaults(stmt: ParsedStatement): AccountFormDefaults {
  const bank = stmt.bank.charAt(0).toUpperCase() + stmt.bank.slice(1);
  const mask =
    stmt.card_last_four ??
    normalizeAccountMaskSuffix(
      stmt.account_number ?? stmt.investment_metadata?.investment_account_number ?? null,
    );

  let name: string;
  let accountType: string;
  const defaults: AccountFormDefaults = {
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
      if (meta.disbursement_date) {
        const disbDate = new Date(meta.disbursement_date);
        defaults.loan_start_month = disbDate.getUTCMonth() + 1;
        defaults.loan_start_year = disbDate.getUTCFullYear();
      }
    }
  } else if (stmt.statement_type === "investment") {
    accountType = "INVESTMENT";
    const meta = stmt.investment_metadata;
    const fund = meta?.fund_name
      ? meta.fund_name.charAt(0).toUpperCase() + meta.fund_name.slice(1).toLowerCase()
      : "Inversión";
    name = `${bank} ${fund}${mask ? ` ****${mask}` : ""}`;
    if (meta) {
      if (meta.new_balance != null) defaults.current_balance = meta.new_balance;
      // The fund reports its period return annualized — that is the account's expected rate.
      if (meta.period_return_pct != null) defaults.expected_return_rate = meta.period_return_pct;
      // First statement of a new fund: the opening additions are the initial investment.
      if (meta.additions != null && (meta.previous_balance ?? 0) === 0) {
        defaults.initial_investment = meta.additions;
      }
      if (meta.maturity_date) {
        const maturity = new Date(`${meta.maturity_date}T12:00:00`);
        defaults.maturity_month = maturity.getUTCMonth() + 1;
        defaults.maturity_year = maturity.getUTCFullYear();
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
