import Link from "next/link";
import type { PlanBudgetSummary, PlanRecurringSummary } from "@/types/plan";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface DrillCard {
  title: string;
  hint: string;
  hintColor: string;
  href: string;
}

interface PlanDrillCardsProps {
  budget: PlanBudgetSummary;
  recurring: PlanRecurringSummary;
  periodoSummary: { hasActive: boolean; percentAssigned: number } | null;
  wishlistCount: number;
  currency: CurrencyCode;
}

export function PlanDrillCards({
  budget,
  recurring,
  periodoSummary,
  wishlistCount,
  currency,
}: PlanDrillCardsProps) {
  const budgetPct = budget.totalBudgeted > 0
    ? Math.round((budget.totalSpent / budget.totalBudgeted) * 100)
    : 0;

  const cards: DrillCard[] = [
    {
      title: "Presupuesto",
      hint: budget.overLimitCount > 0
        ? `${budgetPct}% · ${budget.overLimitCount} sobre límite`
        : `${budgetPct}% gastado`,
      hintColor: budget.overLimitCount > 0 ? "text-red-400" : "text-emerald-400",
      href: "/plan?tab=presupuesto",
    },
    {
      title: "Periodo",
      hint: periodoSummary?.hasActive
        ? `${periodoSummary.percentAssigned}% asignado`
        : "Sin periodo activo",
      hintColor: periodoSummary?.hasActive ? "text-emerald-400" : "text-muted-foreground",
      href: "/plan?tab=periodo",
    },
    {
      title: "Recurrentes",
      hint: `${formatCurrency(recurring.totalMonthlyExpenses, currency)}/mes`,
      hintColor: "text-amber-400",
      href: "/plan?tab=recurrentes",
    },
    {
      title: "Deseos",
      hint: `${wishlistCount} item${wishlistCount !== 1 ? "s" : ""}`,
      hintColor: "text-muted-foreground",
      href: "/plan?tab=deseos",
    },
  ];

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Ir a
      </p>
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="flex items-center justify-between rounded-xl border border-white/6 bg-z-surface-2/60 px-4 py-3 transition-colors active:bg-z-surface-2"
        >
          <div>
            <p className="text-[13px] font-semibold">{card.title}</p>
            <p className={`text-[11px] ${card.hintColor}`}>{card.hint}</p>
          </div>
          <span className="text-muted-foreground">›</span>
        </Link>
      ))}
    </div>
  );
}
