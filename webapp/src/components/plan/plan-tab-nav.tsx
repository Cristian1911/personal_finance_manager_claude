"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const PLAN_TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "presupuesto", label: "Presupuesto" },
  { key: "periodo", label: "Periodo" },
  { key: "recurrentes", label: "Recurrentes" },
  { key: "deseos", label: "Deseos" },
] as const;

export type PlanTab = (typeof PLAN_TABS)[number]["key"];

export function PlanTabNav({ activeTab }: { activeTab: PlanTab }) {
  const searchParams = useSearchParams();
  const month = searchParams.get("month");

  function buildHref(tabKey: string) {
    const params = new URLSearchParams();
    if (tabKey !== "resumen") params.set("tab", tabKey);
    if (month) params.set("month", month);
    const qs = params.toString();
    return qs ? `/plan?${qs}` : "/plan";
  }

  return (
    <nav className="hidden gap-1 overflow-x-auto scrollbar-none rounded-xl border border-white/6 bg-black/10 p-1 lg:flex">
      {PLAN_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={buildHref(tab.key)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
            activeTab === tab.key
              ? "bg-z-brass/15 text-z-brass"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function usePlanTab(): PlanTab {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const validTabs: PlanTab[] = ["resumen", "presupuesto", "periodo", "recurrentes", "deseos"];
  return validTabs.includes(tab as PlanTab) ? (tab as PlanTab) : "resumen";
}
