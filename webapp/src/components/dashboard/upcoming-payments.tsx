"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, Check, CircleAlert } from "lucide-react";
import Link from "next/link";
import type { PendingObligation } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

interface UpcomingPaymentsProps {
  obligations: PendingObligation[];
  totalPending: number;
}

type TimeGroup = "today" | "this_week" | "this_month";

function groupByTime(obligations: PendingObligation[]): Record<TimeGroup, PendingObligation[]> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const groups: Record<TimeGroup, PendingObligation[]> = {
    today: [],
    this_week: [],
    this_month: [],
  };

  for (const o of obligations) {
    if (o.due_date <= today) {
      groups.today.push(o);
    } else if (o.due_date <= weekEndStr) {
      groups.this_week.push(o);
    } else {
      groups.this_month.push(o);
    }
  }

  return groups;
}

const groupLabels: Record<TimeGroup, string> = {
  today: "Hoy",
  this_week: "Esta semana",
  this_month: "Este mes",
};

export function UpcomingPayments({ obligations, totalPending }: UpcomingPaymentsProps) {
  if (obligations.length === 0) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <Check className="h-4 w-4" />
            <span className="text-sm">Todos los pagos del mes estan al dia</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groups = groupByTime(obligations);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          Proximos pagos
        </CardTitle>
        <Link href="/recurrentes" className="text-xs text-primary hover:underline">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {(["today", "this_week", "this_month"] as TimeGroup[]).map((group) => {
          const items = groups[group];
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className={`text-xs font-medium mb-2 ${group === "today" ? "text-red-600" : "text-muted-foreground"}`}>
                {groupLabels[group]}
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {group === "today" && <CircleAlert className="h-3.5 w-3.5 text-red-500" />}
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">
                        {formatCurrency(item.amount, item.currency_code as CurrencyCode)}
                      </span>
                      {group !== "today" && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatDate(item.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="border-t pt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total pendiente</span>
          <span className="text-sm font-semibold">
            {formatCurrency(totalPending)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
