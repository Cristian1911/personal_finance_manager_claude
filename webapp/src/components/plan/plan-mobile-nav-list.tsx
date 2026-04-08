import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MCardTight, MListRow } from "@/components/mobile/v2/mobile-card";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import type { PlanTab } from "@/components/plan/plan-tab-nav";

const PLAN_TABS: { key: PlanTab; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "presupuesto", label: "Presupuesto" },
  { key: "periodo", label: "Periodo" },
  { key: "recurrentes", label: "Recurrentes" },
  { key: "deseos", label: "Deseos" },
];

export function PlanMobileNavList({ activeTab }: { activeTab: PlanTab }) {
  const otherTabs = PLAN_TABS.filter((t) => t.key !== activeTab);

  return (
    <div className="mt-6 space-y-2 lg:hidden">
      <p className={MOBILE_EYEBROW_CLASS}>Más en Plan</p>
      <MCardTight>
        {otherTabs.map((tab) => (
          <Link key={tab.key} href={tab.key === "resumen" ? "/plan" : `/plan?tab=${tab.key}`}>
            <MListRow>
              <span className="text-sm font-medium">{tab.label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </MListRow>
          </Link>
        ))}
      </MCardTight>
    </div>
  );
}
