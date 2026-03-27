"use client";

import { useState } from "react";
import {
  Home,
  Utensils,
  Car,
  HeartPulse,
  Sparkles,
  Shield,
  Briefcase,
  Tag,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { RecurringConfirmInline } from "./recurring-confirm-inline";
import type { OccurrenceItem, DateStatus } from "./use-recurring-month";
import type { CurrencyCode } from "@/types/domain";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SourceAccount {
  id: string;
  name: string;
}

interface PaymentTimelineProps {
  pendingByDate: Map<string, OccurrenceItem[]>;
  getDateStatus: (date: string) => DateStatus;
  onConfirm: (
    item: OccurrenceItem,
    overrides?: {
      actualAmount?: number;
      paymentDate?: string;
      sourceAccountId?: string | null;
    }
  ) => void;
  busyItems: Record<string, boolean>;
  selectedDate: string | null;
  sourceAccounts: SourceAccount[];
  onSkip: (item: OccurrenceItem) => void;
}

/* ------------------------------------------------------------------ */
/*  Icon map                                                           */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  utensils: Utensils,
  car: Car,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  shield: Shield,
  briefcase: Briefcase,
  tag: Tag,
};

function CategoryIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = ICON_MAP[icon] ?? Tag;
  return <Icon className={className} />;
}

/* ------------------------------------------------------------------ */
/*  Date group styling                                                 */
/* ------------------------------------------------------------------ */

function dateGroupStyle(status: DateStatus): React.CSSProperties {
  switch (status) {
    case "past":
      return {
        borderColor: "color-mix(in srgb, var(--z-debt) 50%, transparent)",
        borderLeftColor: "var(--z-debt)",
        borderLeftWidth: 4,
        backgroundColor: "color-mix(in srgb, var(--z-debt) 20%, transparent)",
      };
    case "today":
      return {
        borderColor: "color-mix(in srgb, var(--z-alert) 50%, transparent)",
        borderLeftColor: "var(--z-alert)",
        borderLeftWidth: 4,
        backgroundColor: "color-mix(in srgb, var(--z-alert) 20%, transparent)",
      };
    case "future":
      return {};
  }
}

function dateLabelClasses(status: DateStatus) {
  switch (status) {
    case "past":
      return "text-z-debt font-semibold";
    case "today":
      return "text-z-alert font-semibold";
    case "future":
      return "text-muted-foreground";
  }
}

const STATUS_ORDER: Record<DateStatus, number> = { past: 0, today: 1, future: 2 };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PaymentTimeline({
  pendingByDate,
  getDateStatus,
  onConfirm,
  busyItems,
  selectedDate,
  sourceAccounts,
  onSkip,
}: PaymentTimelineProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Sort dates: past first, then today, then future
  const sortedDates = Array.from(pendingByDate.keys())
    .filter((date) => (selectedDate ? date === selectedDate : true))
    .map((date) => ({ date, order: STATUS_ORDER[getDateStatus(date)] }))
    .sort((a, b) => a.order - b.order || a.date.localeCompare(b.date))
    .map(({ date }) => date);

  if (sortedDates.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {selectedDate
          ? "No hay pagos pendientes en esta fecha"
          : "No hay pagos pendientes este mes"}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedDates.map((date) => {
        const items = pendingByDate.get(date)!;
        const status = getDateStatus(date);

        return (
          <div
            key={date}
            className={cn(
              "overflow-hidden rounded-lg border",
              status === "future" && "border-border bg-background"
            )}
            style={dateGroupStyle(status)}
          >
            {/* Date header */}
            <div className="px-3 py-1.5">
              <span
                className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  dateLabelClasses(status)
                )}
              >
                {status === "today" && "Hoy — "}
                {formatDate(date, "EEEE d MMM")}
              </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-border/50">
              {items.map((item) => {
                const isExpanded = expandedKey === item.key;

                return (
                  <div key={item.key}>
                    {/* Payment row */}
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/50"
                      onClick={() =>
                        setExpandedKey(isExpanded ? null : item.key)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedKey(isExpanded ? null : item.key);
                        }
                      }}
                    >
                      {/* Category icon */}
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: item.categoryColor + "20" }}
                      >
                        <CategoryIcon
                          icon={item.categoryIcon}
                          className="size-3.5"
                        />
                      </span>

                      {/* Merchant + account */}
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-sm font-medium">
                          {item.merchant}
                        </span>
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {item.accountName}
                          {item.accountLastFour &&
                            ` ****${item.accountLastFour}`}
                        </span>
                      </div>

                      {/* Amount */}
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatCurrency(
                          item.plannedAmount,
                          item.currencyCode as CurrencyCode
                        )}
                      </span>

                      {/* Confirm indicator */}
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {isExpanded ? "Cerrar" : "Confirmar ▸"}
                      </span>
                    </div>

                    {/* Inline confirm panel */}
                    {isExpanded && (
                      <RecurringConfirmInline
                        item={item}
                        onConfirm={(amount, paymentDate, sourceId) => {
                          onConfirm(item, {
                            actualAmount: amount,
                            paymentDate,
                            sourceAccountId: sourceId ?? null,
                          });
                          setExpandedKey(null);
                        }}
                        onSkip={() => {
                          onSkip(item);
                          setExpandedKey(null);
                        }}
                        onCancel={() => setExpandedKey(null)}
                        isPending={!!busyItems[item.key]}
                        sourceAccounts={sourceAccounts}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
