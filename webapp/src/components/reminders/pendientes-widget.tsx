import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReminderItem } from "./reminder-item";
import { ReminderQuickAdd } from "./reminder-quick-add";
import type { FinancialReminder } from "@/types/domain";

interface PendientesWidgetProps {
  reminders: FinancialReminder[];
}

export function PendientesWidget({ reminders }: PendientesWidgetProps) {
  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-z-sage-dark" />
          <CardTitle className="text-sm font-semibold">Pendientes</CardTitle>
        </div>
        <Link
          href="/pendientes"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {reminders.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Sin pendientes
          </p>
        ) : (
          <div className="space-y-1">
            {reminders.map((r) => (
              <ReminderItem key={r.id} reminder={r} compact />
            ))}
          </div>
        )}
        <ReminderQuickAdd />
      </CardContent>
    </Card>
  );
}
