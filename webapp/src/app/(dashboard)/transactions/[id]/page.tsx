import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, ReceiptText, ShieldCheck, Tags } from "lucide-react";
import { getTransaction } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getDestinatarios } from "@/actions/destinatarios";
import { getTagGroups, getTagsForEntity } from "@/actions/tags";
import { isTransactionLinkedToOccurrence } from "@/actions/occurrences";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { DeleteTransactionButton } from "@/components/transactions/delete-transaction-button";
import { PromoteToRecurringButton } from "@/components/transactions/promote-to-recurring-button";
import { DestinatarioPicker } from "@/components/transactions/destinatario-picker";
import { TagPicker } from "@/components/tags/tag-picker";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@/types/domain";

// ─── Deferred: edit button (needs accounts + categories) ─────────────────────

async function TransactionEditAction({ transaction }: { transaction: Transaction }) {
  const [accountsResult, categoriesResult] = await Promise.all([
    getAccounts(),
    getCategories(),
  ]);

  return (
    <TransactionFormDialog
      transaction={transaction}
      accounts={accountsResult.success ? accountsResult.data : []}
      categories={categoriesResult.success ? categoriesResult.data : []}
    />
  );
}

// ─── Deferred: promote-to-recurring button ───────────────────────────────────

async function TransactionPromoteAction({ transaction }: { transaction: Transaction }) {
  const [accountsResult, categoriesResult, isLinked] = await Promise.all([
    getAccounts(),
    getCategories(),
    isTransactionLinkedToOccurrence(transaction.id),
  ]);

  return (
    <PromoteToRecurringButton
      transaction={{
        id: transaction.id,
        account_id: transaction.account_id,
        amount: transaction.amount,
        currency_code: transaction.currency_code,
        direction: transaction.direction,
        merchant_name: transaction.merchant_name,
        clean_description: transaction.clean_description,
        category_id: transaction.category_id,
        destinatario_id: transaction.destinatario_id,
        transaction_date: transaction.transaction_date,
      }}
      isLinkedToOccurrence={isLinked}
      accounts={accountsResult.success ? accountsResult.data : []}
      categories={categoriesResult.success ? categoriesResult.data : []}
    />
  );
}

// ─── Deferred: sidebar (needs destinatarios, categories, tags) ───────────────

async function TransactionSidebar({ transaction }: { transaction: Transaction }) {
  const [destinatariosResult, categoriesResult, tagGroupsResult, transactionTags] = await Promise.all([
    getDestinatarios(),
    getCategories(),
    getTagGroups(),
    getTagsForEntity("transaction", transaction.id),
  ]);

  const destinatarios = destinatariosResult.success ? destinatariosResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const tagGroups = tagGroupsResult.success ? tagGroupsResult.data : [];

  return (
    <div className="space-y-6">
      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
              <ReceiptText className="size-4 text-z-brass" />
            </div>
            <div className="space-y-1">
              <CardTitle>Destinatario</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ajusta la asociación comercial para mejorar contexto y futuras reglas.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DestinatarioPicker
            transactionId={transaction.id}
            currentDestinatarioId={transaction.destinatario_id}
            destinatarios={destinatarios}
            rawDescription={transaction.raw_description}
            categories={categories}
          />
        </CardContent>
      </Card>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
              <Tags className="size-4 text-z-brass" />
            </div>
            <div className="space-y-1">
              <CardTitle>Etiquetas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Agrega contexto libre: viajes, personas, proyectos.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TagPicker
            entityType="transaction"
            entityId={transaction.id}
            currentTags={transactionTags}
            allTagGroups={tagGroups}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  // Only fetch the transaction — everything else streams in via Suspense
  const txResult = await getTransaction(id);
  if (!txResult.success) notFound();

  const tx = txResult.data;
  const isInflow = tx.direction === "INFLOW";
  const txStatus =
    tx.status === "POSTED"
      ? "Confirmada"
      : tx.status === "PENDING"
        ? "Pendiente"
        : "Cancelada";

  return (
    <div className="max-w-4xl space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Detalle" backHref="/transactions" />
      <PageHero
        pills={
          <>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-2 rounded-full border border-white/6 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-light hover:bg-white/5"
            >
              <ArrowLeft className="size-3.5" />
              Volver a Movimientos
            </Link>
            <Badge className={isInflow ? "bg-z-income/15 text-z-income hover:bg-z-income/15" : "bg-z-debt/15 text-z-debt hover:bg-z-debt/15"}>
              {isInflow ? "Ingreso" : "Gasto"}
            </Badge>
            <Badge variant="secondary">{txStatus}</Badge>
          </>
        }
        title={tx.merchant_name || tx.clean_description || "Transacción"}
        description={`${formatDate(tx.transaction_date, "dd MMMM yyyy")} \u00b7 ${tx.provider}`}
        actions={
          <>
            <Suspense fallback={<Skeleton className="h-9 w-20 rounded-md" />}>
              <TransactionEditAction transaction={tx} />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-9 w-28 rounded-md" />}>
              <TransactionPromoteAction transaction={tx} />
            </Suspense>
            <DeleteTransactionButton transactionId={tx.id} />
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                {isInflow ? (
                  <ArrowDownLeft className="size-4 text-z-income" />
                ) : (
                  <ArrowUpRight className="size-4 text-z-debt" />
                )}
                Monto
              </div>
            }
            value={
              <span className={isInflow ? "text-z-income" : "text-z-sage-light"}>
                {isInflow ? "+" : "-"}
                {formatCurrency(tx.amount, tx.currency_code)}
              </span>
            }
            description="Valor que realmente movió esta transacción."
          />
          <StatCard
            label="Estado"
            value={<span className="text-lg">{txStatus}</span>}
            description="Contexto actual del movimiento dentro de la base."
          />
          <StatCard
            label="Fuente"
            value={<span className="text-lg">{tx.provider}</span>}
            description="Origen con el que entró o fue registrado este movimiento."
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <ShieldCheck className="size-4 text-z-brass" />
                Qué hacer aquí
              </div>
            }
            value={
              <span className="text-sm font-normal leading-6 text-muted-foreground">
                Editar, borrar o reasignar destinatario sin salir del flujo operativo de Movimientos.
              </span>
            }
          />
        </div>
      </PageHero>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader>
            <CardTitle>Contexto del movimiento</CardTitle>
            <p className="text-sm text-muted-foreground">
              Datos base para entender de dónde viene y cómo quedó registrado.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {tx.raw_description && (
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                  Descripción original
                </p>
                <p className="mt-2 text-sm font-mono text-z-white">{tx.raw_description}</p>
              </div>
            )}

            {tx.notes && (
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                  Notas
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{tx.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Suspense fallback={<SidebarSkeleton />}>
          <TransactionSidebar transaction={tx} />
        </Suspense>
      </div>
    </div>
  );
}
