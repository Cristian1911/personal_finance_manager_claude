"use client";

import { CheckCircle2 } from "lucide-react";
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

  const tone = overdueCount > 0 ? "debt" : total > 0 ? "brass" : "foreground";
  const eyebrowTone = overdueCount > 0 ? "debt" : "foreground";

  return {
    tone,
    accessibilityLabel: total > 0 ? `Por resolver: ${total}` : "Sin pendientes",
    chip: (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
        <ChipEyebrow tone={eyebrowTone}>Por resolver</ChipEyebrow>
        {total === 0 ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-z-income" aria-hidden />
            <span className="text-[12px] font-semibold text-foreground">Al día</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[22px] font-bold leading-none tabular-nums text-foreground">
              {total}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {total === 1 ? "item" : "items"}
            </span>
          </div>
        )}
        <p className="w-full truncate text-[10px] text-muted-foreground">
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
