import Link from "next/link";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { MobileZone } from "@/components/mobile/v2/mobile-zone";
import type { AllocationData } from "@/actions/allocation";

interface PlanDistributionProps {
  allocation: AllocationData | null;
}

const barColors = {
  needs: "bg-z-income",
  wants: "bg-z-brass",
  savings: "bg-[#98a96d]",
} as const;

export function PlanDistribution({ allocation }: PlanDistributionProps) {
  if (!allocation) return null;

  const rows = [
    { label: "Necesario", pct: allocation.needs.percent, color: barColors.needs },
    { label: "Deseos", pct: allocation.wants.percent, color: barColors.wants },
    { label: "Ahorro", pct: allocation.savings.percent, color: barColors.savings },
  ];

  return (
    <MobileZone>
      <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Distribución
          </p>
          <span className="rounded-full border border-white/8 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            50/30/20
          </span>
        </div>

        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2.5">
              <span className="w-[72px] shrink-0 text-[12px] font-semibold">
                {row.label}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-[#1e221d] overflow-hidden">
                <div
                  className={cn("h-full rounded-full", row.color)}
                  style={{ width: `${Math.min(row.pct, 100)}%` }}
                />
              </div>
              <span className="w-[36px] shrink-0 text-right text-[12px] font-semibold">
                {Math.round(row.pct)}%
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 text-[10px] text-z-brass">
          <Link href="/settings" className="hover:underline">
            Tipo: 50/30/20 · Cambiar →
          </Link>
        </div>
      </div>
    </MobileZone>
  );
}
