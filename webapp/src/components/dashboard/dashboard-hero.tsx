import { formatCurrency } from "@/lib/utils/currency";
import { freshnessMap } from "@/lib/utils/dashboard";
import { KPIWidget } from "@/components/ui/kpi-widget";
import { Button } from "@/components/ui/button";
import { StatusHeadline } from "./status-headline";
import {
  Banknote,
  CalendarClock,
  FileUp,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { DashboardHeroData } from "@/actions/charts";
import type { AllocationData } from "@/actions/allocation";
import type { CurrencyCode } from "@/types/domain";

interface DashboardHeroProps {
  data: DashboardHeroData;
  allocationData: AllocationData | null;
  debtFreeBanner?: React.ReactNode;
}

export function DashboardHero({ data, allocationData, debtFreeBanner }: DashboardHeroProps) {
  const { totalLiquid, totalPending, availableToSpend, freshness, pendingObligations, currency, hasOtherCurrencies } = data;
  const f = freshnessMap[freshness];
  const code = currency as CurrencyCode;
  const hasPendingObligations = pendingObligations.length > 0;

  const freshnessLabel =
    freshness === "fresh"
      ? "Base al día"
      : freshness === "stale"
        ? "Revisión recomendada"
        : "Necesita actualización";

  const freshnessBadgeClass =
    freshness === "fresh"
      ? "border-z-income/30 bg-z-income/10 text-z-income"
      : freshness === "stale"
        ? "border-z-alert/30 bg-z-alert/10 text-z-alert"
        : "border-z-debt/30 bg-z-debt/10 text-z-debt";

  const guidanceCopy = hasPendingObligations
    ? `Tienes ${pendingObligations.length} ${pendingObligations.length === 1 ? "pago" : "pagos"} por ${formatCurrency(totalPending, code)} que pueden mover tu margen antes de cerrar el mes.`
    : freshness === "outdated"
      ? "Tu foto actual ya no es lo bastante confiable para decidir con seguridad. Actualiza saldos o importa un extracto antes de tomar decisiones grandes."
      : freshness === "stale"
        ? "Tu margen se ve estable, pero conviene revisar saldos antes de mover presupuesto o tomar una compra relevante."
        : "Tu margen está listo para ayudarte a decidir el siguiente paso sin perderte entre métricas.";

  const primaryAction = hasPendingObligations
    ? {
        href: "/recurrentes",
        label: "Revisar pagos",
        icon: CalendarClock,
      }
    : {
        href: "/import",
        label: "Importar extracto",
        icon: FileUp,
      };

  const secondaryAction =
    freshness === "outdated"
      ? {
          href: "#quick-update-values",
          label: "Actualizar valores",
          icon: RefreshCw,
        }
      : {
          href: "/transactions",
          label: "Ver movimientos",
          icon: Receipt,
        };
  const PrimaryActionIcon = primaryAction.icon;
  const SecondaryActionIcon = secondaryAction.icon;

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/6 bg-[radial-gradient(circle_at_top_left,rgba(63,70,50,0.32),transparent_52%),linear-gradient(180deg,rgba(30,34,30,0.96),rgba(18,20,18,0.98))] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/6 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-light">
            Estado del mes
          </span>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${freshnessBadgeClass}`}>
            {freshnessLabel}
          </span>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-z-sage-dark">
              Disponible para gastar en {data.currency}
            </p>
            <p className={`text-4xl font-bold tracking-tight md:text-5xl ${availableToSpend < 0 ? "text-z-debt" : "text-z-sage-light"}`}>
              {formatCurrency(availableToSpend, code)}
            </p>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {guidanceCopy}
            </p>
            {hasOtherCurrencies && (
              <p className="text-xs text-muted-foreground">
                Tienes cuentas en otras monedas no incluidas en estos totales.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-z-brass text-z-ink shadow-none hover:bg-z-brass/90"
            >
              <Link href={primaryAction.href}>
                <PrimaryActionIcon className="size-4" />
                {primaryAction.label}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/8 bg-black/10 text-z-sage-light shadow-none hover:bg-white/5 hover:text-z-sage-light"
            >
              <Link href={secondaryAction.href}>
                <SecondaryActionIcon className="size-4" />
                {secondaryAction.label}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPIWidget
          label="Saldo total"
          value={formatCurrency(totalLiquid, code)}
          icon={<Wallet className="size-4" />}
          semanticColor="neutral"
          className="bg-black/15 ring-1 ring-white/5"
        />
        <KPIWidget
          label="Fijos pendientes"
          value={formatCurrency(totalPending, code)}
          trend={{ direction: "flat", text: `${pendingObligations.length} ${pendingObligations.length === 1 ? "pago" : "pagos"}` }}
          icon={<Receipt className="size-4" />}
          semanticColor="expense"
          className="bg-black/15 ring-1 ring-white/5"
        />
        <KPIWidget
          label="Libre"
          value={formatCurrency(availableToSpend, code)}
          icon={<Banknote className="size-4" />}
          semanticColor={availableToSpend < 0 ? "debt" : "income"}
          className="bg-black/15 ring-1 ring-white/5"
        />
        </div>

        <div className="space-y-3">
          <StatusHeadline allocationData={allocationData} />
          {debtFreeBanner}
        </div>

        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${f.dot}`} />
          <span className="text-xs text-muted-foreground">{f.label}</span>
        </div>
      </div>
    </div>
  );
}
