import { connection } from "next/server";
import { Suspense } from "react";
import { getTransactions } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { QuickCaptureBar } from "@/components/transactions/quick-capture-bar";
import { Pagination } from "@/components/transactions/pagination";
import { MonthSelector } from "@/components/month-selector";
import { MobileMovimientos } from "@/components/mobile/mobile-movimientos";
import { parseMonth, formatMonthParam, formatMonthLabel } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  ListFilter,
  Tags,
} from "lucide-react";

const PurchaseDecisionCard = dynamic(
  () => import("@/components/dashboard/purchase-decision-card").then((m) => ({ default: m.PurchaseDecisionCard })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" /> }
);

function buildFiltersHref(params: Record<string, string | undefined>, keepMonthOnly = false) {
  const next = new URLSearchParams();
  if (params.month) {
    next.set("month", params.month);
  }

  if (!keepMonthOnly) {
    for (const [key, value] of Object.entries(params)) {
      if (!value || key === "month" || key === "page") continue;
      next.set(key, value);
    }
  }

  const query = next.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;

  const [transactionsResult, accountsResult, categoriesResult, outflowCategoriesResult] =
    await Promise.all([
      getTransactions(params),
      getAccounts(),
      getCategories(),
      getCategories("OUTFLOW"),
    ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const outflowCategories = outflowCategoriesResult.success ? outflowCategoriesResult.data ?? [] : [];
  const month = params.month;
  const target = parseMonth(month);
  const defaultMonth = month ?? formatMonthParam(target);
  const monthLabel = formatMonthLabel(target);
  const activeFilterCount = [
    params.search,
    params.accountId,
    params.direction,
    params.dateFrom,
    params.dateTo,
    params.amountMin,
    params.amountMax,
    params.showExcluded === "true" ? "true" : undefined,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;
  const visibleTransactions = transactionsResult.data.filter((tx) => !tx.is_excluded);
  const summaryCurrency = (visibleTransactions[0]?.currency_code ?? "COP");
  const inflowVisible = visibleTransactions
    .filter((tx) => tx.direction === "INFLOW")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const outflowVisible = visibleTransactions
    .filter((tx) => tx.direction === "OUTFLOW")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const uncategorizedVisible = visibleTransactions.filter(
    (tx) => tx.direction === "OUTFLOW" && !tx.category_id
  ).length;
  const scopeLabel =
    transactionsResult.totalPages > 1
      ? "en esta página"
      : hasActiveFilters
        ? "en esta vista"
        : "visibles";
  const clearHref = buildFiltersHref(params, true);
  const actionCard = uncategorizedVisible > 0
    ? {
        eyebrow: "Atención operativa",
        title: `${uncategorizedVisible} ${uncategorizedVisible === 1 ? "movimiento visible sigue sin categoría" : "movimientos visibles siguen sin categoría"}`,
        body: "Ordénalos ahora para que el detalle diario no termine distorsionando presupuesto, reglas y destinatarios.",
        href: "/categorizar",
        cta: "Categorizar ahora",
      }
    : hasActiveFilters
      ? {
          eyebrow: "Vista refinada",
          title: `${activeFilterCount} ${activeFilterCount === 1 ? "filtro activo" : "filtros activos"} para revisar sin ruido`,
          body: "Úsalo para inspeccionar una cuenta, un tipo o un rango. Cuando termines, vuelve a la vista amplia del período.",
          href: clearHref,
          cta: "Volver a la vista amplia",
        }
      : {
          eyebrow: "Siguiente paso",
          title: "El detalle está limpio para operar y luego decidir",
          body: "Usa Movimientos para revisar, capturar y corregir. Cuando quieras evaluar implicaciones más amplias, baja a Plan.",
          href: "/plan",
          cta: "Abrir Plan",
        };

  return (
    <div className="space-y-6">
      {/* Mobile: intentional header + controls + date-grouped feed */}
      <div className="lg:hidden">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Movimientos
              </p>
              <div>
                <h1 className="text-2xl font-semibold">Tu flujo operativo del período</h1>
                <p className="text-sm text-muted-foreground">
                  Revisa, clasifica y corrige antes de convertir el detalle en ruido.
                </p>
              </div>
            </div>
            <div className="rounded-full border border-white/6 bg-z-surface-2 px-3 py-1 text-xs text-muted-foreground">
              {monthLabel}
            </div>
          </div>

          <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <CardHeader className="space-y-2 pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                {actionCard.eyebrow}
              </p>
              <CardTitle className="text-lg leading-tight">{actionCard.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {actionCard.body}
              </p>
              <div className="flex items-center gap-2">
                <TransactionFilters accounts={accounts} />
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light"
                >
                  <Link href={actionCard.href}>
                    {uncategorizedVisible > 0 ? <Tags className="size-4" /> : <ArrowRight className="size-4" />}
                    {actionCard.cta}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/10 px-4 py-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Vista actual</p>
              <p className="font-medium">
                {transactionsResult.count} movimientos {scopeLabel}
              </p>
            </div>
            <Suspense>
              <MonthSelector />
            </Suspense>
          </div>
        </div>

        <MobileMovimientos
          transactions={transactionsResult.data}
          categories={categories}
        />
      </div>

      {/* Desktop: full table with filters, quick capture, etc. */}
      <div className="hidden lg:block space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Movimientos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Tu flujo operativo del período</h1>
            <p className="text-muted-foreground">
              {transactionsResult.count} movimientos {scopeLabel} · revisa, clasifica y corrige antes de decidir
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Suspense>
              <MonthSelector />
            </Suspense>
            <TransactionFormDialog accounts={accounts} categories={categories} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_24rem]">
          <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <CardHeader className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Vista actual
              </p>
              <CardTitle className="text-2xl leading-tight">
                El detalle diario ya está listo para operar sin perder contexto
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Usa esta vista para revisar movimientos concretos. El trabajo estratégico ya vive en Plan; aquí lo importante es limpiar y entender el flujo real.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Movimientos</p>
                  <p className="mt-2 text-2xl font-semibold">{transactionsResult.count}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{scopeLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <ArrowDownLeft className="size-4 text-z-income" />
                    Ingresos
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-z-income">
                    {formatCurrency(inflowVisible, summaryCurrency)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">en la vista actual</p>
                </div>
                <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <ArrowUpRight className="size-4 text-z-expense" />
                    Gastos
                  </div>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatCurrency(outflowVisible, summaryCurrency)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">en la vista actual</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-z-brass text-z-ink hover:bg-z-brass/90">
                  <Link href={actionCard.href}>
                    {actionCard.cta}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light"
                >
                  <Link href="/plan">Ver impacto en Plan</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <CardHeader className="space-y-2 pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                {actionCard.eyebrow}
              </p>
              <CardTitle className="text-xl leading-tight">{actionCard.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {actionCard.body}
              </p>
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Sin categoría en pantalla</p>
                <p className="mt-2 text-2xl font-semibold">{uncategorizedVisible}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {uncategorizedVisible > 0
                    ? "Conviene limpiarlos antes de cerrar el período."
                    : hasActiveFilters
                      ? "La vista está afinada y lista para revisión puntual."
                      : "No hay frentes obvios en el detalle visible."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Suspense>
          <TransactionFilters accounts={accounts} />
        </Suspense>

        <QuickCaptureBar accounts={accounts} categories={categories} />

        <PurchaseDecisionCard
          accounts={accounts}
          categories={outflowCategories}
          defaultMonth={defaultMonth}
        />

        <TransactionTable transactions={transactionsResult.data} categories={categories} />

        <Suspense>
          <Pagination
            page={transactionsResult.page}
            totalPages={transactionsResult.totalPages}
            count={transactionsResult.count}
          />
        </Suspense>
      </div>
    </div>
  );
}
