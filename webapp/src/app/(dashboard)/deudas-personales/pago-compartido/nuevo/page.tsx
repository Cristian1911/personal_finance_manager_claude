import { connection } from "next/server";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import {
  SharedPaymentForm,
  type ExistingTransactionInput,
} from "@/components/personas/shared-payment-form";
import { getPreferredCurrency } from "@/actions/profile";
import { getTransaction } from "@/actions/transactions";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS, PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/domain";

export default async function NuevoPagoCompartidoPage({
  searchParams,
}: {
  searchParams: Promise<{ from_tx?: string }>;
}) {
  await connection();
  const { from_tx } = await searchParams;
  const currency = await getPreferredCurrency();

  // Existing mode: prefill from a recorded transaction. The createSharedPayment
  // action re-validates server-side; here we only prefill when the tx is a
  // splittable OUTFLOW (not already linked to a person / split).
  let existingTransaction: ExistingTransactionInput | undefined;
  if (from_tx) {
    const res = await getTransaction(from_tx);
    if (
      res.success &&
      res.data.direction === "OUTFLOW" &&
      !res.data.personal_debt_id &&
      !res.data.split_group_id
    ) {
      const tx = res.data;
      existingTransaction = {
        id: tx.id,
        amount: tx.amount,
        currencyCode: (tx.currency_code as CurrencyCode) ?? currency,
        transactionDate: tx.transaction_date,
        description: tx.merchant_name || tx.clean_description || tx.raw_description || null,
      };
    }
  }

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader
        variant="sub"
        title="Pago compartido"
        backHref="/deudas-personales"
        backStyle="exit"
      />
      <div className={cn("px-4", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
        <SharedPaymentForm currency={currency} existingTransaction={existingTransaction} />
      </div>
    </div>
  );
}
