"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createRecurringTemplateFromTransaction } from "@/actions/recurring-templates";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";

// Dialog + form are ~580 lines; defer until the user clicks "Hacer recurrente".
const RecurringFormDialog = dynamic(
  () =>
    import("@/components/recurring/recurring-form-dialog").then(
      (m) => m.RecurringFormDialog,
    ),
  { ssr: false },
);
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
  destinatario_id: string | null;
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
    !!tx.clean_description && tx.clean_description !== merchant;
  return {
    account_id: tx.account_id,
    amount: tx.amount,
    currency_code: tx.currency_code,
    direction: tx.direction,
    merchant_name: merchant,
    description: hasDistinctDescription ? tx.clean_description : null,
    category_id: tx.category_id,
    destinatario_id: tx.destinatario_id,
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
  // Auto-open when navigated here with ?promote=1 (e.g. from the Vincular
  // picker on /transactions). Only opens for unlinked tx.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shouldAutoOpen = searchParams.get("promote") === "1" && !isLinkedToOccurrence;
  const [open, setOpen] = useState(shouldAutoOpen);

  const actionOverride = useMemo(
    () => createRecurringTemplateFromTransaction.bind(null, transaction.id),
    [transaction.id],
  );

  const initialValues = useMemo(
    () => prefillFromTransaction(transaction),
    [transaction],
  );

  // Strip ?promote=1 on close so refresh/back doesn't re-trigger the dialog.
  const handleClose = useCallback(() => {
    setOpen(false);
    if (searchParams.get("promote") === "1") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("promote");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const handleSuccess = useCallback(
    (saved: RecurringTemplate | undefined) => {
      toast.success("Recurrente creada", {
        description: "Se programó el próximo pago en Recurrentes.",
        action: saved
          ? {
              label: "Ver",
              onClick: () => router.push(`/recurrentes/${saved.id}/edit`),
            }
          : undefined,
      });
    },
    [router],
  );

  if (isLinkedToOccurrence) {
    return (
      <Link href="/recurrentes" className="contents">
        <Badge
          variant="secondary"
          className="cursor-pointer bg-z-surface-3/60 text-z-sage-dark transition-colors hover:bg-z-surface-3/80"
        >
          <CalendarClock className="size-3.5" aria-hidden="true" />
          Ya es recurrente
        </Badge>
      </Link>
    );
  }

  return (
    <>
      <Button
        type="button"
        className={BRASS_BUTTON_CLASS}
        onClick={() => setOpen(true)}
      >
        <CalendarClock className="size-4" aria-hidden="true" />
        Hacer recurrente
      </Button>
      <RecurringFormDialog
        controlledOpen={open}
        onClose={handleClose}
        onSuccess={handleSuccess}
        trigger={null}
        initialValues={initialValues}
        actionOverride={actionOverride}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
