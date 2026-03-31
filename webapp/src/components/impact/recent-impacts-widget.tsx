import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImpactEventCard } from "./impact-event-card";
import type { ImpactEvent } from "@/types/domain";

interface RecentImpactsWidgetProps {
  events: ImpactEvent[];
}

export function RecentImpactsWidget({ events }: RecentImpactsWidgetProps) {
  if (events.length === 0) return null;

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Sparkles className="h-4 w-4 text-z-income" />
        <CardTitle className="text-sm font-semibold">
          Movimientos inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.map((event, i) => (
          <ImpactEventCard key={`${event.accountId}-${event.date}-${i}`} event={event} compact />
        ))}
      </CardContent>
    </Card>
  );
}
