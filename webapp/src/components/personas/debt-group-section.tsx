"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BRASS_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  INLINE_EXPAND_TOGGLE_CLASS,
  PANEL_INSET_CLASS,
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { DebtRow } from "./debt-row";
import { RecordGroupedRepaymentDialog } from "./record-grouped-repayment-dialog";
import type { PersonDebtGroup } from "@/lib/personal-debts/hierarchy";
import type { CurrencyCode } from "@/types/domain";

const PREVIEW_ROWS = 6;

interface DebtGroupSectionProps {
  group: PersonDebtGroup;
  personName: string;
  currency: CurrencyCode;
  /** Show the currency next to the title when the person owes in several. */
  showCurrency: boolean;
}

function dateSpan(first: string, last: string): string {
  if (first === last) return formatDate(first, "dd MMM");
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return sameMonth
    ? `${formatDate(first, "dd")}–${formatDate(last, "dd MMM")}`
    : `${formatDate(first, "dd MMM")} – ${formatDate(last, "dd MMM")}`;
}

/**
 * One viaje with one person: the trip is the unit you settle, the expenses
 * underneath are the receipt. Collapsed by default when nothing is pending.
 */
export function DebtGroupSection({ group, personName, currency, showCurrency }: DebtGroupSectionProps) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [repayOpen, setRepayOpen] = useState(false);

  const code = group.currency_code as CurrencyCode;
  const settled = group.outstanding <= 0;
  const pct = group.principal > 0 ? Math.min(100, Math.round((group.repaid / group.principal) * 100)) : 0;
  const rows = showAll ? group.items : group.items.slice(0, PREVIEW_ROWS);
  const hiddenCount = group.items.length - rows.length;
  const activeIds = group.items.filter((i) => i.status === "active").map((i) => i.id);

  return (
    <div className={cn(PANEL_INSET_CLASS, "overflow-hidden")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-base"
          aria-hidden
        >
          {group.modo.emoji ?? <MapPin className="size-4 text-z-brass" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-medium text-z-sage-light">{group.modo.name}</span>
            {showCurrency && (
              <span className="shrink-0 rounded-full border border-white/6 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {group.currency_code}
              </span>
            )}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {group.count} {group.count === 1 ? "gasto" : "gastos"} · {dateSpan(group.first_on, group.last_on)}
            {group.repaid > 0 && !settled && ` · abonó ${formatCurrency(group.repaid, code)}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block text-sm font-semibold tabular-nums",
              settled ? "text-z-income" : group.direction === "borrowed" ? "text-z-debt" : "text-z-brass",
            )}
          >
            {settled ? "Al día" : formatCurrency(group.outstanding, code)}
          </span>
          <span className="block text-[11px] tabular-nums text-muted-foreground">
            de {formatCurrency(group.principal, code)}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Progress + actions stay visible: the trip is what you settle, the
          rows are only the receipt. */}
      <div className="space-y-2.5 px-3 pb-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/6" aria-hidden>
          <div
            className={cn("h-full rounded-full", settled ? "bg-z-income" : "bg-z-brass")}
            style={{ width: `${Math.max(settled ? 100 : 2, pct)}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!settled && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(BRASS_GHOST_BUTTON_CLASS)}
              onClick={() => setRepayOpen(true)}
            >
              {group.direction === "borrowed" ? "Pagar" : "Registrar pago"}
            </Button>
          )}
          <Button asChild size="sm" variant="ghost" className={cn(GHOST_BUTTON_CLASS)}>
            <Link href={`/modos/${group.modo.id}`}>Ver viaje</Link>
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/6">
          <div className="divide-y divide-white/6">
            {rows.map((item) => (
              <DebtRow
                key={item.id}
                item={item}
                currency={currency}
                hideNote={group.modo.name}
                defaultAccountId={group.origin_account_id}
                muted={item.status !== "active"}
              />
            ))}
          </div>
          {(hiddenCount > 0 || showAll) && group.items.length > PREVIEW_ROWS && (
            <button
              type="button"
              className={INLINE_EXPAND_TOGGLE_CLASS}
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Ver menos" : `Ver todos (${group.items.length})`}
            </button>
          )}
        </div>
      )}

      {repayOpen && (
        <RecordGroupedRepaymentDialog
          open={repayOpen}
          onOpenChange={setRepayOpen}
          debtIds={activeIds}
          personName={personName}
          scopeLabel={group.modo.name}
          outstandingAmount={group.outstanding}
          currency={code}
          direction={group.direction}
          defaultAccountId={group.origin_account_id}
        />
      )}
    </div>
  );
}
