import Link from "next/link";
import { Wallet, CalendarCheck, RefreshCw, Heart } from "lucide-react";
import type { PlanBudgetSummary, PlanRecurringSummary } from "@/types/plan";
import type { CurrencyCode } from "@/types/domain";

interface PlanDrillCardsProps {
  budget: PlanBudgetSummary;
  recurring: PlanRecurringSummary;
  periodoSummary: { hasActive: boolean; percentAssigned: number; unassignedCount?: number } | null;
  wishlistCount: number;
  currency: CurrencyCode;
}

interface DrillChipProps {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  caption: React.ReactNode;
}

function DrillChip({ label, href, icon: Icon, caption }: DrillChipProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[150px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/6 bg-white/[0.02] p-4 transition-colors active:bg-white/[0.04]"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <Icon className="size-10 text-z-brass/85" aria-hidden />
      <div className="text-center text-xs font-medium text-muted-foreground">{caption}</div>
    </Link>
  );
}

export function PlanDrillCards({
  budget,
  recurring,
  periodoSummary,
  wishlistCount,
}: PlanDrillCardsProps) {
  const overLimit = budget.overLimitCount ?? 0;
  const presupuestoCaption =
    overLimit > 0 ? (
      <span className="font-semibold text-z-brass">{overLimit} sobre límite</span>
    ) : (
      "dentro del límite"
    );

  const percentAssigned = periodoSummary?.percentAssigned ?? 0;
  const unassigned = periodoSummary?.unassignedCount ?? 0;
  const periodoCaption =
    percentAssigned >= 100 ? (
      "al día"
    ) : unassigned > 0 ? (
      <span className="font-semibold text-z-brass">{unassigned} pendientes</span>
    ) : (
      `${Math.round(percentAssigned)}%`
    );

  const dueSoonCount = recurring.dueSoonCount;
  const overdueCount = recurring.overdueCount;
  const recurrentesCaption = (
    <>
      {dueSoonCount} este mes
      {overdueCount > 0 && (
        <>
          {" · "}
          <span className="font-semibold text-z-brass">{overdueCount} vencidas</span>
        </>
      )}
    </>
  );

  const deseosCaption = `${wishlistCount} activo${wishlistCount !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Ir a
      </p>
      <div className="grid grid-cols-2 gap-2">
        <DrillChip
          label="Presupuesto"
          href="/plan?tab=presupuesto"
          icon={Wallet}
          caption={presupuestoCaption}
        />
        <DrillChip
          label="Periodo"
          href="/plan?tab=periodo"
          icon={CalendarCheck}
          caption={periodoCaption}
        />
        <DrillChip
          label="Recurrentes"
          href="/plan?tab=recurrentes"
          icon={RefreshCw}
          caption={recurrentesCaption}
        />
        <DrillChip
          label="Deseos"
          href="/plan?tab=deseos"
          icon={Heart}
          caption={deseosCaption}
        />
      </div>
    </div>
  );
}
