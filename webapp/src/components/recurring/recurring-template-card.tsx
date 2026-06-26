"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Pause, Trash2, Check, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryIcon } from "@/components/categories/category-icon";
import { getTemplateStats, type TemplateStats } from "@/actions/template-stats";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import type { CurrencyCode, RecurringTemplateWithRelations } from "@/types/domain";

type OccurrenceStatus = "paid" | "pending" | "skipped" | null;

interface RecurringTemplateCardProps {
  template: RecurringTemplateWithRelations;
  currency: CurrencyCode;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPauseRequest: (template: RecurringTemplateWithRelations) => void;
  onDeleteRequest: (template: RecurringTemplateWithRelations) => void;
  occurrenceStatus: OccurrenceStatus;
}

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  WEEKLY: 52, BIWEEKLY: 26, MONTHLY: 12, QUARTERLY: 4, ANNUAL: 1, ONCE: 1,
};

function yearlyEstimate(amount: number, frequency: string): number {
  return frequency === "ONCE" ? amount : amount * (FREQUENCY_MULTIPLIER[frequency] ?? 12);
}

function frequencyShortLabel(f: string): string {
  const labels: Record<string, string> = {
    ONCE: "Una vez", WEEKLY: "Semanal", BIWEEKLY: "Quincenal",
    MONTHLY: "Mensual", QUARTERLY: "Trimestral", ANNUAL: "Anual",
  };
  return labels[f] ?? f;
}

export function RecurringTemplateCard({
  template,
  currency,
  isExpanded,
  onToggleExpand,
  onPauseRequest,
  onDeleteRequest,
  occurrenceStatus,
}: RecurringTemplateCardProps) {
  const router = useRouter();
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const amount = Number(template.amount);
  const isOnce = template.frequency === "ONCE";
  // "Abono a deuda" = an INFLOW that reduces the debt; an OUTFLOW on a debt
  // account is a recurring charge billed to the card, not an abono.
  const isDebtPayment =
    isDebtAccountType(template.account.account_type) &&
    template.direction === "INFLOW";
  const isIncome = template.direction === "INFLOW" && !isDebtPayment;

  function handleExpand() {
    onToggleExpand();
    if (!isExpanded && !stats) {
      setLoadingStats(true);
      getTemplateStats(template.id).then((result) => {
        if (result.success) setStats(result.data);
        setLoadingStats(false);
      });
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/6 bg-white/[0.03] transition-all",
        isExpanded && "border-z-brass/20"
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={handleExpand}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left active:bg-white/[0.02]"
      >
        {/* Category icon */}
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: (template.category?.color ?? "hsl(var(--z-sage-dark))") + "20",
            color: template.category?.color ?? "hsl(var(--z-sage-dark))",
          }}
        >
          {template.category?.icon ? (
            <CategoryIcon icon={template.category.icon} className="size-3.5" />
          ) : (
            <Tag className="size-3.5" />
          )}
        </span>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-semibold">{template.merchant_name}</p>
            {isOnce && (
              <span className="shrink-0 rounded bg-z-brass/15 px-1.5 py-px text-[8px] font-semibold text-z-brass">
                UNA VEZ
              </span>
            )}
            {occurrenceStatus === "paid" && (
              <Check className="size-3 shrink-0 text-z-income" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {template.account.name} · {frequencyShortLabel(template.frequency)}
          </p>
        </div>

        {/* Amount + yearly */}
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold tabular-nums">
            {formatCurrency(amount, currency)}
          </p>
          {!isOnce && (
            <p className="text-[9px] tabular-nums text-muted-foreground">
              {formatCurrency(yearlyEstimate(amount, template.frequency), currency)}/año
            </p>
          )}
        </div>
      </button>

      {/* Expanded section */}
      {isExpanded && (
        <div className="space-y-3 border-t border-white/6 px-3 py-3">
          {/* Stats chips */}
          <div className="grid grid-cols-3 gap-1">
            {loadingStats ? (
              <>
                <div className="h-12 animate-pulse rounded-lg bg-white/4" />
                <div className="h-12 animate-pulse rounded-lg bg-white/4" />
                <div className="h-12 animate-pulse rounded-lg bg-white/4" />
              </>
            ) : stats ? (
              isOnce ? (
                <>
                  <StatChip label="% ingreso" value={stats.impactPercent != null ? `${stats.impactPercent.toFixed(1)}%` : "—"} />
                  <StatChip label="Margen después" value={stats.marginAfter != null ? formatCurrency(stats.marginAfter, currency) : "—"} />
                  <StatChip label="Estado" value={occurrenceStatus === "paid" ? "Pagado ✓" : "Pendiente"} />
                </>
              ) : (
                <>
                  <StatChip label="Este año" value={formatCurrency(stats.ytdTotal, currency)} />
                  <StatChip label="Anual est." value={formatCurrency(stats.annualEstimate, currency)} />
                  <StatChip
                    label="Racha"
                    value={`${stats.streak} mes${stats.streak !== 1 ? "es" : ""}`}
                    note={stats.isConsistent ? "Consistente ✓" : undefined}
                  />
                </>
              )
            ) : null}
          </div>

          {/* Action buttons */}
          <div className={cn(
            "grid gap-1.5",
            isOnce ? "grid-cols-2" : isIncome ? "grid-cols-2" : "grid-cols-3"
          )}>
            <ActionButton
              label="Editar"
              icon={<Pencil className="size-3.5" />}
              className="bg-z-brass/10 border-z-brass/20 text-z-brass"
              onClick={() => router.push(`/recurrentes/${template.id}/edit`)}
            />
            {!isIncome && !isOnce && (
              <ActionButton
                label="Pausar"
                icon={<Pause className="size-3.5" />}
                className="bg-z-alert/8 border-z-alert/15 text-z-alert"
                onClick={() => onPauseRequest(template)}
              />
            )}
            <ActionButton
              label="Eliminar"
              icon={<Trash2 className="size-3.5" />}
              className="bg-z-debt/8 border-z-debt/15 text-z-debt"
              onClick={() => onDeleteRequest(template)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-2 text-center">
      <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
      {note && <p className="text-[8px] text-z-income">{note}</p>}
    </div>
  );
}

function ActionButton({
  label, icon, className, onClick,
}: {
  label: string; icon: React.ReactNode; className: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn("flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[11px] font-semibold active:opacity-70", className)}
    >
      {icon}
      {label}
    </button>
  );
}
