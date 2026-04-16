"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildTimelineItems, type UpcomingIncomeItem } from "./timeline-model";
import { toColombiaDateString } from "@/lib/utils/date";
import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";

interface InicioAttentionTimelineProps {
  overdueReminders: AttentionOverdueReminder[];
  upcomingPayments: AttentionUpcomingPayment[];
  pendingEmails: AttentionPendingEmail[];
  upcomingIncome: UpcomingIncomeItem[];
}

export function InicioAttentionTimeline({
  overdueReminders,
  upcomingPayments,
  pendingEmails,
  upcomingIncome,
}: InicioAttentionTimelineProps) {
  const todayStr = toColombiaDateString(new Date());
  const items = buildTimelineItems({
    overdueReminders,
    upcomingPayments,
    pendingEmails,
    upcomingIncome,
    todayStr,
  });

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Por resolver
        </span>
        {items.length > 0 && (
          <Link
            href="/gestionar"
            className="text-[11px] font-medium text-z-brass hover:underline"
          >
            Ver todo →
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-4">
          <CheckCircle2 className="size-5 shrink-0 text-z-income" />
          <div>
            <p className="text-sm font-semibold text-foreground">Todo tranquilo</p>
            <p className="text-[11px] text-muted-foreground">Sin pendientes esta semana.</p>
          </div>
        </div>
      ) : (
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-none">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex min-w-[155px] shrink-0 flex-col gap-1 rounded-xl border bg-white/[0.02] p-3 transition-colors active:bg-white/[0.04]",
                item.urgency === "overdue" && "border-z-debt/30 bg-z-debt/5",
                item.urgency === "today" && "border-z-brass/30",
                item.urgency === "future" && "border-white/6",
              )}
            >
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-[0.18em]",
                  item.urgency === "overdue" && "text-z-debt",
                  item.urgency === "today" && "text-z-brass",
                  item.urgency === "future" && "text-muted-foreground",
                )}
              >
                {item.dateLabel}
              </span>
              <span className="line-clamp-2 text-xs font-semibold text-foreground">
                {item.title}
              </span>
              {item.subtitle && (
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
                    item.isIncome ? "text-z-income" : "text-z-brass",
                  )}
                >
                  {item.subtitle}
                </span>
              )}
            </Link>
          ))}
          <Link
            href="/gestionar"
            className="flex min-w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/6 bg-transparent p-3 text-muted-foreground active:bg-white/[0.03]"
          >
            <ArrowRight className="size-4" />
            <span className="text-[10px]">Ver todo</span>
          </Link>
        </div>
      )}
    </section>
  );
}
