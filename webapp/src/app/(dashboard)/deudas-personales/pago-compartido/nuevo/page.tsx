import { connection } from "next/server";
import { SharedPaymentCreator } from "@/components/personas/shared-payment-creator";
import type { ExistingTransactionInput } from "@/components/personas/shared-payment-form";
import { getPreferredCurrency } from "@/actions/profile";
import { getTransaction } from "@/actions/transactions";
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
    <SharedPaymentCreator currency={currency} existingTransaction={existingTransaction} />
  );
}
