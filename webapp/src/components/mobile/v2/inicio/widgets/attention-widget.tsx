"use client";

import { cn } from "@/lib/utils";
import { Verdict } from "@/components/ui/verdict";
import { ChipEyebrow } from "../widget-chip";
import { InicioAttentionTimeline } from "../inicio-attention-timeline";
import { InicioImportStrip } from "../inicio-import-strip";
import type { WidgetRender } from "../widget-grid";
import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";
import type { CurrencyCode } from "@/types/domain";
import type { UpcomingIncomeItem } from "../timeline-model";

interface AttentionWidgetProps {
  overdueReminders: AttentionOverdueReminder[];
  upcomingPayments: AttentionUpcomingPayment[];
  pendingEmails: AttentionPendingEmail[];
  upcomingIncome: UpcomingIncomeItem[];
  currency: CurrencyCode;
  daysSinceImport: number;
}

export function renderAttentionWidget(props: AttentionWidgetProps): WidgetRender {
  const {
    overdueReminders,
    upcomingPayments,
    pendingEmails,
    upcomingIncome,
    currency,
    daysSinceImport,
  } = props;

  const overdueCount = overdueReminders.length;
  const upcomingCount = upcomingPayments.length + upcomingIncome.length;
  const emailCount = pendingEmails.length;
  const total = overdueCount + upcomingCount + emailCount;

  // Brass never carries status (T1): overdue keeps the debt tone; pending
  // states bind to the alert token on the status line below (ChipTone has no
  // alert variant, so the ring/eyebrow fall back to neutral).
  const tone = overdueCount > 0 ? "debt" : "foreground";
  const eyebrowTone = overdueCount > 0 ? "debt" : "foreground";

  return {
    tone,
    accessibilityLabel: total > 0 ? `Por resolver: ${total}` : "Sin pendientes",
    chip: (
      <div className="flex h-full flex-col items-center gap-1.5 text-center">
        <ChipEyebrow tone={eyebrowTone}>Por resolver</ChipEyebrow>
        {total === 0 ? (
          <div className="flex flex-1 items-center">
            <Verdict compact state="vas-bien" />
          </div>
        ) : (
          <div className="flex flex-1 items-baseline gap-1.5">
            <span className="text-[26px] font-bold leading-none tabular-nums text-foreground">
              {total}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {total === 1 ? "item" : "items"}
            </span>
          </div>
        )}
        <p
          className={cn(
            "truncate text-[10px]",
            overdueCount > 0
              ? "text-z-debt"
              : total > 0
                ? "text-z-alert"
                : "text-muted-foreground",
          )}
        >
          {overdueCount > 0
            ? `${overdueCount} vencido${overdueCount === 1 ? "" : "s"}`
            : upcomingCount > 0
              ? `${upcomingCount} próximo${upcomingCount === 1 ? "" : "s"}`
              : emailCount > 0
                ? `${emailCount} correo${emailCount === 1 ? "" : "s"}`
                : "Sin pendientes"}
        </p>
      </div>
    ),
    detail: (
      <div className="space-y-2.5">
        <InicioImportStrip
          daysSinceImport={daysSinceImport}
          hasPendingEmails={emailCount > 0}
        />
        <InicioAttentionTimeline
          overdueReminders={overdueReminders}
          upcomingPayments={upcomingPayments}
          pendingEmails={pendingEmails}
          upcomingIncome={upcomingIncome}
          currency={currency}
        />
      </div>
    ),
  };
}
