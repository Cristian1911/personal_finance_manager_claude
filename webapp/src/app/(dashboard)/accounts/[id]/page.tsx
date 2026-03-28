import { connection } from "next/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, DatabaseZap, History } from "lucide-react";
import { getAccount } from "@/actions/accounts";
import { getStatementSnapshots } from "@/actions/statement-snapshots";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { DeleteAccountButton } from "@/components/accounts/delete-account-button";
import { ReconcileBalanceDialog } from "@/components/accounts/reconcile-balance-dialog";
import { StatementHistoryTimeline } from "@/components/accounts/statement-history-timeline";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants/account-types";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";

// Server Component — chart component is already "use client", no ssr: false needed
const BalanceHistoryChart = dynamic(
  () => import("@/components/charts/balance-history-chart").then((m) => ({ default: m.BalanceHistoryChart })),
  { loading: () => <div className="h-[300px] w-full rounded-xl bg-muted animate-pulse" /> }
);

const TYPES_WITH_HISTORY = ["CREDIT_CARD", "LOAN", "SAVINGS"];

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  // Fetch account and snapshots in parallel — snapshots return empty for non-history types (cheap)
  const [result, snapshotsResult] = await Promise.all([
    getAccount(id),
    getStatementSnapshots(id),
  ]);

  if (!result.success) notFound();

  const account = result.data;
  const showHistory = TYPES_WITH_HISTORY.includes(account.account_type);
  const snapshots = showHistory && snapshotsResult?.success ? snapshotsResult.data : [];
  const latestSnapshot = snapshots[0] ?? null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title={account.name} backHref="/accounts" />
      <PageHero
        pills={<>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-2 rounded-full border border-white/6 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-light hover:bg-white/5"
          >
            <ArrowLeft className="size-3.5" />
            Volver a Cuentas
          </Link>
          <Badge className="border-z-brass/30 bg-z-brass/10 text-z-brass hover:bg-z-brass/10">
            {ACCOUNT_TYPE_LABELS[account.account_type]}
          </Badge>
          {account.show_in_dashboard ? (
            <Badge className="border-z-olive-deep/40 bg-z-olive-deep/20 text-z-sage-light hover:bg-z-olive-deep/20">
              Visible en Inicio
            </Badge>
          ) : null}
        </>}
        title={account.name}
        description={account.institution_name
          ? `${account.institution_name}${account.mask ? ` · ••${account.mask}` : ""}`
          : "Cuenta sin institución explícita"}
        actions={<>
          <ReconcileBalanceDialog
            accountId={account.id}
            accountName={account.name}
            accountType={account.account_type}
            currentBalance={account.current_balance}
            currencyBalances={account.currency_balances}
            currencyCode={account.currency_code}
          />
          <AccountFormDialog account={account} />
          <DeleteAccountButton accountId={account.id} />
        </>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Saldo actual"
            value={<span className="text-z-sage-light">{formatCurrency(account.current_balance, account.currency_code)}</span>}
            description="La cifra base que hoy sostiene esta cuenta dentro del sistema."
          />
          <StatCard
            label="Moneda"
            value={account.currency_code}
            description="Unidad usada para leer el balance y su historial."
          />
          <StatCard
            label={<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark"><History className="size-4 text-z-brass" />Extractos guardados</div>}
            value={showHistory ? snapshots.length : 0}
            description={showHistory
              ? latestSnapshot
                ? `Último corte: ${formatDate((latestSnapshot.period_to ?? latestSnapshot.created_at).slice(0, 10), "dd MMM yyyy")}`
                : "Aún no hay cortes guardados"
              : "Este tipo de cuenta no usa historial de extractos"}
          />
          <StatCard
            label={<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark"><DatabaseZap className="size-4 text-z-brass" />Qué puedes hacer aquí</div>}
            value=""
            description="Ajustar saldo, editar la cuenta y revisar cómo han evolucionado sus cortes."
          />
        </div>
      </PageHero>

      {showHistory ? (
        <div className="space-y-6">
          <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <CardHeader>
              <CardTitle>Historial de balance</CardTitle>
              <p className="text-sm text-muted-foreground">
                Úsalo para entender tendencia y detectar cuándo la base dejó de estar fresca.
              </p>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Card className="h-64 animate-pulse border-white/6 bg-black/10"><CardContent className="flex items-center justify-center h-full"><div className="h-4 w-32 rounded bg-muted" /></CardContent></Card>}>
                <BalanceHistoryChart snapshots={snapshots} currency={account.currency_code} />
              </Suspense>
            </CardContent>
          </Card>

          <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <CardHeader>
              <CardTitle>Historial de extractos</CardTitle>
              <p className="text-sm text-muted-foreground">
                Referencia rápida de cortes, periodos y consistencia del historial importado.
              </p>
            </CardHeader>
            <CardContent>
              <StatementHistoryTimeline
                snapshots={snapshots}
                currency={account.currency_code}
                accountType={account.account_type}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader>
            <CardTitle>Esta cuenta no usa historial de extractos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Puedes seguir ajustando saldo manualmente y volver al sistema principal para revisar su impacto.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild className={BRASS_BUTTON_CLASS}>
              <Link href="/accounts">Volver a cuentas</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className={GHOST_BUTTON_CLASS}
            >
              <Link href="/dashboard">Ver impacto en Inicio</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
