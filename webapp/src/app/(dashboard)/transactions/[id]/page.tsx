import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTransaction } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getDestinatarios } from "@/actions/destinatarios";
import { getTagsForEntity } from "@/actions/tags";
import {
  getAccountIdsWithPendingOccurrences,
  isTransactionLinkedToOccurrence,
} from "@/actions/occurrences";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { TransactionDetailClient } from "./transaction-detail-client";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  // Fire the tx-independent list fetches immediately so they don't wait on
  // `getTransaction`. On cold cache this turns a serial waterfall into
  // `max(tx, lists)` instead of their sum.
  const listFetchesPromise = Promise.all([
    getAccounts(),
    getCategories(),
    getDestinatarios(),
    getAccountIdsWithPendingOccurrences(),
  ]);

  const txResult = await getTransaction(id);
  if (!txResult.success) notFound();
  const tx = txResult.data;

  const [
    [accountsResult, categoriesResult, destinatariosResult, linkableAccountIds],
    initialTags,
    isLinkedToOccurrence,
  ] = await Promise.all([
    listFetchesPromise,
    getTagsForEntity("transaction", tx.id),
    isTransactionLinkedToOccurrence(tx.id),
  ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const destinatarios = destinatariosResult.success ? destinatariosResult.data : [];

  const currentDestinatarioName = tx.destinatario_id
    ? destinatarios.find((d) => d.id === tx.destinatario_id)?.name ?? null
    : null;

  return (
    <div className="mx-auto w-full max-w-xl lg:max-w-4xl">
      <MobileHeader variant="sub" title="Detalle" backHref="/transactions" />
      <TransactionDetailClient
        transaction={tx}
        currentDestinatarioName={currentDestinatarioName}
        accounts={accounts}
        categories={categories}
        initialTags={initialTags}
        isLinkedToOccurrence={isLinkedToOccurrence}
        linkableAccountIds={linkableAccountIds}
      />
    </div>
  );
}
