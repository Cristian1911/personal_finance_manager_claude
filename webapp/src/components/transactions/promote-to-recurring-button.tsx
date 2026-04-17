"use client";

import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { createRecurringTemplateFromTransaction } from "@/actions/recurring-templates";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type {
  Account,
  CategoryWithChildren,
  CurrencyCode,
  RecurringTemplate,
  TransactionDirection,
} from "@/types/domain";

type PromoteSourceTx = {
  id: string;
  account_id: string;
  amount: number;
  currency_code: CurrencyCode;
  direction: TransactionDirection;
  merchant_name: string | null;
  clean_description: string | null;
  category_id: string | null;
  transaction_date: string;
};

type PromoteToRecurringButtonProps = {
  transaction: PromoteSourceTx;
  /** True when a recurring_occurrences row already points to this tx. */
  isLinkedToOccurrence: boolean;
  accounts: Account[];
  categories: CategoryWithChildren[];
};

function prefillFromTransaction(tx: PromoteSourceTx): Partial<RecurringTemplate> {
  const txDate = new Date(`${tx.transaction_date}T12:00:00`);
  const dayOfMonth = txDate.getDate();
  const merchant = tx.merchant_name ?? tx.clean_description ?? "";
  const hasDistinctDescription =
    !!tx.clean_description && tx.clean_description !== tx.merchant_name;
  return {
    account_id: tx.account_id,
    amount: tx.amount,
    currency_code: tx.currency_code,
    direction: tx.direction,
    merchant_name: merchant,
    description: hasDistinctDescription ? tx.clean_description : null,
    category_id: tx.category_id,
    frequency: "MONTHLY",
    start_date: tx.transaction_date,
    day_of_month: dayOfMonth,
    day_of_week: null,
    end_date: null,
    transfer_source_account_id: null,
    sub_payments: null,
  };
}

export function PromoteToRecurringButton({
  transaction,
  isLinkedToOccurrence,
  accounts,
  categories,
}: PromoteToRecurringButtonProps) {
  const [open, setOpen] = useState(false);

  const actionOverride = useMemo(
    () => createRecurringTemplateFromTransaction.bind(null, transaction.id),
    [transaction.id],
  );

  const initialValues = useMemo(
    () => prefillFromTransaction(transaction),
    [transaction],
  );

  if (isLinkedToOccurrence) {
    return (
      <Badge
        variant="secondary"
        className="bg-white/5 text-muted-foreground hover:bg-white/5"
      >
        <CalendarClock className="mr-1.5 size-3.5" />
        Ya es recurrente
      </Badge>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={GHOST_BUTTON_CLASS}
        onClick={() => setOpen(true)}
      >
        <CalendarClock className="size-4" />
        Hacer recurrente
      </Button>
      <RecurringFormDialog
        controlledOpen={open}
        onClose={() => setOpen(false)}
        trigger={null}
        initialValues={initialValues}
        actionOverride={actionOverride}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
