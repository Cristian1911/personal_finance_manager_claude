import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, ReceiptText, ShieldCheck } from "lucide-react";
import { getTransaction } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getDestinatarios } from "@/actions/destinatarios";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { DeleteTransactionButton } from "@/components/transactions/delete-transaction-button";
import { DestinatarioPicker } from "@/components/transactions/destinatario-picker";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const [txResult, accountsResult, categoriesResult, destinatariosResult] =
    await Promise.all([
      getTransaction(id),
      getAccounts(),
      getCategories(),
      getDestinatarios(),
    ]);

  if (!txResult.success) notFound();

  const tx = txResult.data;
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const destinatarios = destinatariosResult.success
    ? destinatariosResult.data
    : [];
  const isInflow = tx.direction === "INFLOW";
  const txStatus =
    tx.status === "POSTED"
      ? "Confirmada"
      : tx.status === "PENDING"
        ? "Pendiente"
        : "Cancelada";

  return (
    <div className="max-w-4xl space-y-6 lg:space-y-8">
      <MobilePageHeader title="Detalle" backHref="/transactions" />
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
            <TransactionFormDialog
              transaction={tx}
              accounts={accounts}
              categories={categories}
            />
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
              transactionId={tx.id}
              currentDestinatarioId={tx.destinatario_id}
              destinatarios={destinatarios}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
