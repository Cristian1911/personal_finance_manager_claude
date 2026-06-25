"use client";

import { ChevronDown } from "lucide-react";
import { PeriodHero } from "@/components/cashflow-planner/period-hero";
import { EnvelopeBoard } from "@/components/cashflow-planner/envelope-board";
import { PlanFlowChart } from "./plan-flow-chart";
import type { PlanTimelineData } from "@/actions/plan-timeline";
import type { PeriodPlanData } from "@/types/cashflow-planner";
import type { Account, Category } from "@/types/domain";

/** Accounts need account_type + current_balance for the pay/confirm dialogs. */
export type PlanAccount = Pick<
  Account,
  | "id"
  | "name"
  | "icon"
  | "color"
  | "account_type"
  | "current_balance"
  | "currency_code"
  | "mask"
  | "bank_key"
>;

interface MobilePeriodoViewProps {
  planData: PeriodPlanData;
  timelineData: PlanTimelineData;
  accounts: PlanAccount[];
  categories: Pick<Category, "id" | "name" | "name_es" | "icon" | "color">[];
}

/**
 * Mobile-web Periodo surface. Thin wrapper over the shared living-timeline
 * board: hero, a collapsible "Flujo del mes" chart, then `EnvelopeBoard`
 * (which stacks to one column on narrow screens and owns all the state,
 * collapse, HOY divider, and confirm/pay/assign dialogs).
 */
export function MobilePeriodoView({
  planData,
  timelineData,
  accounts,
  categories,
}: MobilePeriodoViewProps) {
  return (
    <div className="space-y-4">
      <PeriodHero data={planData} />

      {/* Flujo del mes — collapsed by default on mobile to avoid cramping. */}
      <details className="group rounded-2xl border border-white/6 bg-z-surface-2/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark [&::-webkit-details-marker]:hidden">
          Ver flujo del mes
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3 pb-3">
          <PlanFlowChart timelineData={timelineData} currency={planData.currency} />
        </div>
      </details>

      <EnvelopeBoard data={planData} accounts={accounts} categories={categories} />
    </div>
  );
}
