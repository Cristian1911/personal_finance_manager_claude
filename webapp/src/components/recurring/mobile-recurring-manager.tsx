"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { useRecurringMonth } from "./use-recurring-month";
import { RecurringHeroCompact } from "./recurring-hero-compact";
import { RecurringTimeline } from "./recurring-timeline";
import { RecurringImpactDialog } from "./recurring-impact-dialog";
import {
  deleteRecurringTemplate,
  toggleRecurringTemplate,
} from "@/actions/recurring-templates";
import type { RecurringOccurrence } from "@/actions/occurrences";
import type { Account, CurrencyCode, RecurringTemplateWithRelations } from "@/types/domain";

type TabDirection = "OUTFLOW" | "INFLOW";

/** INFLOW to debt accounts is a payment (expense), not income */
function effectiveDirection(template: RecurringTemplateWithRelations): TabDirection {
  if (template.direction === "INFLOW" && isDebtAccountType(template.account.account_type)) {
    return "OUTFLOW";
  }
  return template.direction as TabDirection;
}

interface MobileRecurringManagerProps {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
  currency: CurrencyCode;
  initialOccurrences?: RecurringOccurrence[];
}

export function MobileRecurringManager({
  templates,
  accounts,
  currency,
  initialOccurrences,
}: MobileRecurringManagerProps) {
  const hook = useRecurringMonth(templates, accounts, initialOccurrences);
  const [activeTab, setActiveTab] = useState<TabDirection>("OUTFLOW");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sequential overlay state for pause/delete
  const [impactAction, setImpactAction] = useState<{
    template: RecurringTemplateWithRelations;
    action: "pause" | "delete";
  } | null>(null);

  // Compute totals per effective direction (debt payments = expense, not income)
  const totalExpenses = useMemo(
    () => templates
      .filter((t) => effectiveDirection(t) === "OUTFLOW" && t.is_active)
      .reduce((sum, t) => sum + Number(t.amount), 0),
    [templates]
  );

  const totalIncome = useMemo(
    () => templates
      .filter((t) => effectiveDirection(t) === "INFLOW" && t.is_active)
      .reduce((sum, t) => sum + Number(t.amount), 0),
    [templates]
  );

  const handlePauseRequest = (template: RecurringTemplateWithRelations) => {
    setImpactAction({ template, action: "pause" });
  };

  const handleDeleteRequest = (template: RecurringTemplateWithRelations) => {
    setImpactAction({ template, action: "delete" });
  };

  const handleImpactConfirm = async () => {
    if (!impactAction) return;
    const { template, action } = impactAction;
    if (action === "pause") {
      await toggleRecurringTemplate(template.id, false);
    } else {
      await deleteRecurringTemplate(template.id);
    }
    await hook.refreshOccurrences();
    setImpactAction(null);
  };

  return (
    <div className={cn("space-y-4 px-4", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
      {/* Hero */}
      <RecurringHeroCompact
        totalExpenses={totalExpenses}
        totalIncome={totalIncome}
        currency={currency}
        monthLabel={hook.monthLabel}
        onPrevMonth={hook.goPrevMonth}
        onNextMonth={hook.goNextMonth}
        canGoNext={true}
      />

      {/* Segmented control */}
      <div className="flex rounded-xl border border-white/6 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => { setActiveTab("OUTFLOW"); setExpandedId(null); }}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-[11px] font-semibold transition-colors",
            activeTab === "OUTFLOW"
              ? "border border-z-brass/30 bg-z-brass/15 text-z-brass"
              : "text-muted-foreground"
          )}
        >
          Gastos
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("INFLOW"); setExpandedId(null); }}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-[11px] font-semibold transition-colors",
            activeTab === "INFLOW"
              ? "border border-z-income/25 bg-z-income/12 text-z-income"
              : "text-muted-foreground"
          )}
        >
          Ingresos
        </button>
      </div>

      {/* Loading */}
      {!hook.isHydrated && (
        <div className="animate-pulse py-8 text-center text-sm text-muted-foreground">
          Cargando recurrentes...
        </div>
      )}

      {/* Timeline */}
      {hook.isHydrated && (
        <RecurringTimeline
          templates={templates}
          currency={currency}
          direction={activeTab}
          pending={hook.pending}
          completed={hook.completed}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
          onPauseRequest={handlePauseRequest}
          onDeleteRequest={handleDeleteRequest}
          getDateStatus={hook.getDateStatus}
          getEffectiveDirection={effectiveDirection}
        />
      )}

      {/* Create button */}
      <div className="flex justify-center pb-4">
        <Link
          href={`/recurrentes/new?direction=${activeTab}`}
          className={cn(
            "flex items-center gap-2 rounded-full border px-6 py-2.5 text-xs font-semibold active:opacity-70",
            activeTab === "OUTFLOW"
              ? "border-z-brass/30 text-z-brass"
              : "border-z-income/30 text-z-income"
          )}
        >
          <Plus className="size-3.5" />
          {activeTab === "OUTFLOW" ? "Nuevo gasto recurrente" : "Nuevo ingreso"}
        </Link>
      </div>

      {/* Impact dialog (controlled, outside any Sheet) */}
      {impactAction && (
        <RecurringImpactDialog
          templateId={impactAction.template.id}
          templateName={impactAction.template.merchant_name ?? "Recurrente"}
          currencyCode={(impactAction.template.currency_code ?? "COP") as CurrencyCode}
          action={impactAction.action}
          onConfirm={handleImpactConfirm}
          open={!!impactAction}
          onOpenChange={(open) => {
            if (!open) setImpactAction(null);
          }}
        />
      )}
    </div>
  );
}
